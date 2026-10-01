import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { mockDeep } from 'jest-mock-extended';
import { SentEmailKind, SentEmailStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailsService } from './emails.service';

describe('EmailsService durable jobs', () => {
  const prisma = mockDeep<PrismaService>();
  const service = new EmailsService(prisma);
  const key = '66b3f5b2-39ec-4dcc-9878-b24c38683712';
  const createdAt = new Date('2026-09-27T10:00:00.000Z');
  const acceptance = { id: 'mail-1', kind: SentEmailKind.BULK, status: SentEmailStatus.PENDING, createdAt };

  function member(email: string, isDisabled = false) {
    return { email, isDisabled };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CHOIR_ADMIN_EMAIL = 'admin@choir.test';
    prisma.sentEmail.findUnique.mockResolvedValue(null);
    prisma.sentEmail.create.mockResolvedValue(acceptance as never);
    prisma.member.findMany.mockResolvedValue([
      member('admin@choir.test'), member('member@choir.test'), member('MEMBER@choir.test'),
      member('other@choir.test'),
    ] as never);
  });

  afterAll(() => { delete process.env.CHOIR_ADMIN_EMAIL; });

  it('persists bulk message and recipient snapshot, then returns acceptance without SMTP work', async () => {
    const result = await service.enqueueEmail(SentEmailKind.BULK, ' [Popchor Mitglieder] Sommerfest ', 'Hallo\n', 'Gruß', [], key);

    expect(result).toEqual(acceptance);
    expect(prisma.sentEmail.create).toHaveBeenCalledTimes(1);
    expect(prisma.sentEmail.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        subject: 'Sommerfest', markdownContent: 'Hallo\n', signatureMarkdown: 'Gruß',
        status: SentEmailStatus.PENDING, kind: SentEmailKind.BULK,
        recipients: { to: 'admin@choir.test', bcc: ['member@choir.test', 'other@choir.test'] },
        payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    }));
  });

  it('stores test job only for administrator and does not query members', async () => {
    prisma.sentEmail.create.mockResolvedValue({ ...acceptance, kind: SentEmailKind.TEST } as never);
    const result = await service.enqueueEmail(SentEmailKind.TEST, 'Sample', 'Body', undefined, [], key);
    expect(result.kind).toBe(SentEmailKind.TEST);
    expect(prisma.member.findMany).not.toHaveBeenCalled();
    expect(prisma.sentEmail.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ kind: SentEmailKind.TEST, recipients: { to: 'admin@choir.test', bcc: [] } }),
    }));
  });

  it('replays same key and payload without creating duplicate job', async () => {
    const body = { subject: 'Summer', content: 'Body', signature: '', attachments: [] as Express.Multer.File[] };
    await service.enqueueEmail(SentEmailKind.BULK, body.subject, body.content, body.signature, body.attachments, key);
    const createData = prisma.sentEmail.create.mock.calls[0][0].data;
    prisma.sentEmail.findUnique.mockResolvedValue({
      ...acceptance, payloadHash: createData.payloadHash, idempotencyKey: key,
    } as never);

    const duplicate = await service.enqueueEmail(SentEmailKind.BULK, body.subject, body.content, body.signature, body.attachments, key);
    expect(duplicate).toEqual(acceptance);
    expect(prisma.sentEmail.create).toHaveBeenCalledTimes(1);
  });

  it('preserves Markdown whitespace for body and nonempty signature', async () => {
    const markdownContent = '  Intro\n\n```text\n  indented\n```\n';
    const signatureMarkdown = '\n**Viele Grüße**\n';
    await service.enqueueEmail(SentEmailKind.TEST, 'Subject', markdownContent, signatureMarkdown, [], key);
    expect(prisma.sentEmail.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ markdownContent, signatureMarkdown }),
    }));
  });

  it('rejects reused key with changed body and invalid key', async () => {
    await service.enqueueEmail(SentEmailKind.BULK, 'Summer', 'Body', '', [], key);
    const storedHash = prisma.sentEmail.create.mock.calls[0][0].data.payloadHash;
    prisma.sentEmail.findUnique.mockResolvedValue({ ...acceptance, payloadHash: storedHash } as never);
    await expect(service.enqueueEmail(SentEmailKind.BULK, 'Summer', 'Changed', '', [], key))
      .rejects.toBeInstanceOf(ConflictException);
    await expect(service.enqueueEmail(SentEmailKind.BULK, 'Summer', 'Body', '', [], 'not-a-uuid'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects changed attachment bytes under same idempotency key', async () => {
    const firstFile = {
      originalname: 'agenda.pdf', mimetype: 'application/pdf', size: 3, buffer: Buffer.from('one'),
    } as Express.Multer.File;
    await service.enqueueEmail(SentEmailKind.TEST, 'Summer', 'Body', '', [firstFile], key);
    const storedHash = prisma.sentEmail.create.mock.calls[0][0].data.payloadHash;
    prisma.sentEmail.findUnique.mockResolvedValue({ ...acceptance, payloadHash: storedHash } as never);
    const changedFile = { ...firstFile, buffer: Buffer.from('two') } as Express.Multer.File;
    await expect(service.enqueueEmail(SentEmailKind.TEST, 'Summer', 'Body', '', [changedFile], key))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('recovers simultaneous first submissions through unique idempotency index', async () => {
    let hash: string | undefined;
    prisma.sentEmail.findUnique.mockImplementation((() => Promise.resolve(hash
      ? { ...acceptance, payloadHash: hash } as never
      : null)) as never);
    prisma.sentEmail.create.mockImplementation(((args) => {
      hash = args.data.payloadHash ?? undefined;
      return Promise.reject(new Error('duplicate unique key')) as never;
    }) as never);
    const result = await service.enqueueEmail(SentEmailKind.BULK, 'Summer', 'Body', '', [], key);
    expect(result).toEqual(acceptance);
    expect(prisma.sentEmail.create).toHaveBeenCalledTimes(1);
  });

  it('surfaces persistence failure without returning a job acceptance', async () => {
    prisma.sentEmail.create.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.enqueueEmail(SentEmailKind.BULK, 'Summer', 'Body', '', [], key))
      .rejects.toThrow('database unavailable');
  });

  it('rejects invalid message and total attachment size before persistence', async () => {
    await expect(service.enqueueEmail(SentEmailKind.BULK, ' ', 'Body', '', [], key)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.enqueueEmail(SentEmailKind.BULK, 'Subject', ' ', '', [], key)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.enqueueEmail(SentEmailKind.BULK, 'Subject', 'Body', '', [
      { size: 20 * 1024 * 1024 + 1 } as Express.Multer.File,
    ], key)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.sentEmail.create).not.toHaveBeenCalled();
  });

  it('creates one replacement job for eligible failed work and rejects second replacement', async () => {
    const source = {
      id: 'mail-failed', subject: 'Summer', markdownContent: 'Body', signatureMarkdown: '',
      status: SentEmailStatus.FAILED, kind: SentEmailKind.BULK, attachments: [],
    };
    prisma.sentEmail.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(source as never);
    prisma.sentEmail.create.mockResolvedValue(acceptance as never);
    const result = await service.retryJob(source.id, key);
    expect(result).toEqual(acceptance);
    expect(prisma.sentEmail.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ retrySourceId: source.id, status: SentEmailStatus.PENDING }),
    }));

    prisma.sentEmail.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(source as never)
      .mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'replacement' } as never);
    prisma.sentEmail.create.mockRejectedValueOnce(new Error('unique constraint'));
    await expect(service.retryJob(source.id, '88b3f5b2-39ec-4dcc-9878-b24c38683712'))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('requires duplicate risk acknowledgement for unknown outcome and a new UUID key', async () => {
    const source = {
      id: 'mail-unknown', status: SentEmailStatus.UNKNOWN, kind: SentEmailKind.TEST,
      attachments: [], subject: 'Subject', markdownContent: 'Body', signatureMarkdown: '',
    };
    prisma.sentEmail.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(source as never);
    await expect(service.retryJob('mail-unknown', key)).rejects.toBeInstanceOf(BadRequestException);
    prisma.sentEmail.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(source as never);
    await service.retryJob('mail-unknown', '88b3f5b2-39ec-4dcc-9878-b24c38683712', true);
    expect(prisma.member.findMany).not.toHaveBeenCalled();
  });

  it('only returns successful bulk email and attachments through member archive queries', async () => {
    prisma.sentEmail.findMany.mockResolvedValue([]);
    await service.listSentEmails();
    expect(prisma.sentEmail.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: SentEmailStatus.SENT, kind: SentEmailKind.BULK },
    }));
    prisma.sentEmail.findFirst.mockResolvedValue(null);
    await expect(service.getSentEmail('test-job')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.sentEmail.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'test-job', status: SentEmailStatus.SENT, kind: SentEmailKind.BULK },
    }));
    prisma.sentEmailAttachment.findFirst.mockResolvedValue(null);
    await expect(service.getAttachment('test-job', 'attachment')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns safe job DTO without recipient snapshot or attachment bytes', async () => {
    prisma.sentEmail.findUnique.mockResolvedValue({
      ...acceptance,
      id: 'job-detail',
      kind: SentEmailKind.TEST,
      sentAt: null,
      subject: 'Subject',
      markdownContent: 'Body',
      signatureMarkdown: '',
      failureCode: null,
      idempotencyKey: key,
      recipients: { to: 'admin@choir.test', bcc: [] },
      attachments: [{ id: 'attachment-1', filename: 'file.pdf', contentType: 'application/pdf', size: 3, content: Buffer.from('pdf') }],
      retryJob: null,
    } as never);
    const result = await service.getJob('job-detail');
    expect(result).toEqual(expect.objectContaining({
      id: 'job-detail', idempotencyKey: key, rawSubject: 'Subject',
      attachments: [{ id: 'attachment-1', filename: 'file.pdf', contentType: 'application/pdf', size: 3 }],
      failureCode: null, retryJobId: null,
    }));
    expect(result).not.toHaveProperty('recipients');
    expect(result.attachments[0]).not.toHaveProperty('content');
  });
});
