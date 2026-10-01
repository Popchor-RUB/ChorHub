import { mockDeep } from 'jest-mock-extended';
import { SentEmailKind, SentEmailStatus } from '../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailJobsWorker } from './email-jobs.worker';
import { InvalidMailRecipientError } from '../common/invalid-mail-recipient.error';

describe('EmailJobsWorker', () => {
  const prisma = mockDeep<PrismaService>();
  const mail = mockDeep<MailService>();
  let worker: EmailJobsWorker;

  function queuedJob(kind: SentEmailKind = SentEmailKind.BULK) {
    const token = prisma.$queryRaw.mock.calls[0]?.[1] as string;
    return {
      id: 'job-1', subject: 'Summer', markdownContent: 'Body', signatureMarkdown: '',
      kind, status: SentEmailStatus.SENDING, processingToken: token, recipients: {
        to: 'admin@choir.test', bcc: [' MEMBER@choir.test ', 'disabled@choir.test'],
      }, attachments: [],
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new EmailJobsWorker(prisma, mail);
    prisma.$queryRaw.mockResolvedValue([{ id: 'job-1' }] as never);
    prisma.sentEmail.updateMany.mockResolvedValue({ count: 1 } as never);
    prisma.sentEmail.findUnique.mockImplementation((() => Promise.resolve(queuedJob() as never)) as never);
    prisma.member.findMany.mockResolvedValue([{ email: 'member@choir.test' }] as never);
    mail.sendInformationEmail.mockResolvedValue('[Custom] Summer');
  });

  afterEach(() => worker.onModuleDestroy());

  it('claims one pending row atomically and sends only recipients still active', async () => {
    await worker.poll();

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mail.sendInformationEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'admin@choir.test', bcc: [' MEMBER@choir.test '], subject: 'Summer', rawSubject: 'Summer',
    }));
    expect(prisma.sentEmail.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: SentEmailStatus.SENT, renderedSubject: '[Custom] Summer', processingToken: null }),
    }));
  });

  it('sends test jobs only to administrator and records sent status', async () => {
    prisma.sentEmail.findUnique.mockImplementation((() => Promise.resolve(queuedJob(SentEmailKind.TEST) as never)) as never);
    await worker.poll();
    expect(prisma.member.findMany).not.toHaveBeenCalled();
    expect(mail.sendInformationEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'admin@choir.test', bcc: [], subject: 'Summer', rawSubject: 'Summer',
    }));
  });

  it('marks explicit SMTP rejection failed and ambiguous transport error unknown', async () => {
    mail.sendInformationEmail.mockRejectedValueOnce(Object.assign(new Error('rejected'), { responseCode: 550 }));
    await worker.poll();
    expect(prisma.sentEmail.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: SentEmailStatus.FAILED, failureCode: 'SMTP_REJECTED' }),
    }));

    jest.clearAllMocks();
    prisma.$queryRaw.mockResolvedValue([{ id: 'job-1' }] as never);
    prisma.sentEmail.updateMany.mockResolvedValue({ count: 1 } as never);
    prisma.sentEmail.findUnique.mockImplementation((() => Promise.resolve(queuedJob() as never)) as never);
    prisma.member.findMany.mockResolvedValue([{ email: 'member@choir.test' }] as never);
    mail.sendInformationEmail.mockRejectedValueOnce(new Error('connection reset'));
    await worker.poll();
    expect(prisma.sentEmail.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: SentEmailStatus.UNKNOWN, failureCode: 'DELIVERY_OUTCOME_UNKNOWN' }),
    }));
  });

  it('marks legacy jobs rejected by recipient validation as failed before SMTP', async () => {
    const email = 'member@example.test,external@example.test';
    prisma.member.findMany.mockResolvedValue([{ email }] as never);
    prisma.sentEmail.findUnique.mockImplementation((() => Promise.resolve({
      ...queuedJob(), recipients: { to: 'admin@choir.test', bcc: [email] },
    } as never)) as never);
    mail.sendInformationEmail.mockRejectedValueOnce(new InvalidMailRecipientError());

    await worker.poll();
    expect(prisma.sentEmail.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: SentEmailStatus.FAILED, failureCode: 'INVALID_RECIPIENT' }),
    }));
  });

  it('does not send after losing processing ownership before SMTP', async () => {
    prisma.sentEmail.updateMany.mockResolvedValueOnce({ count: 0 } as never).mockResolvedValueOnce({ count: 0 } as never);
    await worker.poll();
    expect(mail.sendInformationEmail).not.toHaveBeenCalled();
  });

  it('does not resend SMTP when sent-state persistence fails', async () => {
    let updateCount = 0;
    prisma.sentEmail.updateMany.mockImplementation((() => {
      updateCount += 1;
      if (updateCount >= 3) return Promise.reject(new Error('database unavailable')) as never;
      return Promise.resolve({ count: 1 } as never);
    }) as never);
    await worker.poll();
    expect(mail.sendInformationEmail).toHaveBeenCalledTimes(1);
    expect(prisma.sentEmail.updateMany).toHaveBeenCalledTimes(7);
  });

  it('keeps heartbeat alive while SMTP waits and prevents overlapping work', async () => {
    jest.useFakeTimers();
    let finishSend: ((subject: string) => void) | undefined;
    mail.sendInformationEmail.mockReturnValueOnce(new Promise<string>((resolve) => { finishSend = resolve; }));
    const processing = worker.poll();
    await Promise.resolve();
    await Promise.resolve();
    const initialClaims = prisma.$queryRaw.mock.calls.length;
    await jest.advanceTimersByTimeAsync(10_000);
    await worker.poll();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(initialClaims);
    expect(prisma.sentEmail.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ processingToken: expect.any(String) }),
      data: expect.objectContaining({ heartbeatAt: expect.any(Date) }),
    }));
    finishSend?.('[Custom] Summer');
    await processing;
    jest.useRealTimers();
  });

  it('stops claiming after shutdown and turns stale claims into UNKNOWN', async () => {
    worker.onModuleDestroy();
    await worker.poll();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();

    const anotherWorker = new EmailJobsWorker(prisma, mail);
    prisma.sentEmail.updateMany.mockResolvedValueOnce({ count: 1 } as never);
    prisma.$queryRaw.mockResolvedValueOnce([] as never);
    await anotherWorker.poll();
    expect(prisma.sentEmail.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: SentEmailStatus.SENDING }),
      data: expect.objectContaining({ status: SentEmailStatus.UNKNOWN }),
    }));
    anotherWorker.onModuleDestroy();
  });

  it('leaves a failed database read claim for stale-job recovery without sending', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'job-1' }] as never);
    prisma.sentEmail.findUnique.mockRejectedValue(new Error('database read failed'));
    await worker.poll();
    expect(mail.sendInformationEmail).not.toHaveBeenCalled();
  });
});
