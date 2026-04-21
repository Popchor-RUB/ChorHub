import { Test } from '@nestjs/testing';
import { ConflictException, Logger } from '@nestjs/common';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailQueueService } from '../mail/mail-queue.service';
import { MailService } from '../mail/mail.service';
import { PersonalInfoService } from './personal-info.service';

const txtFile = (name: string, lines: string[]) => ({
  fieldname: name,
  originalname: `${name}.txt`,
  encoding: '7bit',
  mimetype: 'text/plain',
  size: 1,
  buffer: Buffer.from(lines.join('\n'), 'utf8'),
  stream: null,
  destination: '',
  filename: '',
  path: '',
}) as unknown as Express.Multer.File;

describe('PersonalInfoService', () => {
  let service: PersonalInfoService;
  let prismaMock: DeepMockProxy<PrismaClient>;
  let mailService: jest.Mocked<MailService>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();
    prismaMock.$transaction.mockImplementation(async (callback: any) => callback(prismaMock));

    mailService = {
      sendMagicLink: jest.fn(),
      sendMemberInvite: jest.fn(),
      sendPushFallbackReminderMail: jest.fn(),
      sendPersonalInfo: jest.fn(),
    } as unknown as jest.Mocked<MailService>;

    const module = await Test.createTestingModule({
      providers: [
        PersonalInfoService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MailService, useValue: mailService },
        MailQueueService,
      ],
    }).compile();

    service = module.get(PersonalInfoService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders global and custom placeholders and upserts entries', async () => {
    prismaMock.member.findFirst
      .mockResolvedValueOnce({
        id: 'm-1',
        firstName: 'Anna',
        lastName: 'Müller',
        email: 'anna@choir.de',
      } as any)
      .mockResolvedValueOnce({
        id: 'm-2',
        firstName: 'Max',
        lastName: 'Schmidt',
        email: 'max@choir.de',
      } as any);

    await service.publish({
      markdownTemplate: 'Hallo {{ firstname }} {{lastname}}, dein Wert: {{code}}',
      emailSubject: 'Persönlich',
      sendEmail: false,
      recipientMode: 'file',
      recipientFile: txtFile('recipients', ['anna@choir.de', 'max@choir.de']),
      placeholderNamesJson: JSON.stringify(['code']),
      placeholderFiles: [txtFile('code', ['A1', 'B2'])],
    });

    expect(prismaMock.personalInfoEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { memberId: 'm-1' },
        create: expect.objectContaining({
          markdownContent: 'Hallo Anna Müller, dein Wert: A1',
        }),
      }),
    );
    expect(prismaMock.personalInfoEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { memberId: 'm-2' },
        create: expect.objectContaining({
          markdownContent: 'Hallo Max Schmidt, dein Wert: B2',
        }),
      }),
    );
  });

  it('throws when placeholder file line count differs from recipients', async () => {
    prismaMock.member.findFirst
      .mockResolvedValueOnce({
        id: 'm-1',
        firstName: 'A',
        lastName: 'A',
        email: 'a@a.de',
      } as any)
      .mockResolvedValueOnce({
        id: 'm-2',
        firstName: 'B',
        lastName: 'B',
        email: 'b@b.de',
      } as any);

    await expect(service.publish({
      markdownTemplate: 'Hi {{firstname}} {{code}}',
      emailSubject: 'x',
      sendEmail: false,
      recipientMode: 'file',
      recipientFile: txtFile('recipients', ['a@a.de', 'b@b.de']),
      placeholderNamesJson: JSON.stringify(['code']),
      placeholderFiles: [txtFile('code', ['only-one-line'])],
    })).rejects.toThrow('Zeilenanzahl');
  });

  it('throws when template contains unknown placeholders', async () => {
    prismaMock.member.findFirst.mockResolvedValue({
      id: 'm-1',
      firstName: 'A',
      lastName: 'A',
      email: 'a@a.de',
    } as any);

    await expect(service.publish({
      markdownTemplate: 'Hi {{firstname}} {{unknown}}',
      emailSubject: 'x',
      sendEmail: false,
      recipientMode: 'file',
      recipientFile: txtFile('recipients', ['a@a.de']),
      placeholderNamesJson: JSON.stringify([]),
      placeholderFiles: [],
    })).rejects.toThrow('Unbekannte Placeholder');
  });

  it('throws when recipient email does not match member', async () => {
    prismaMock.member.findFirst.mockResolvedValue(null);

    await expect(service.publish({
      markdownTemplate: 'Hi {{firstname}}',
      emailSubject: 'x',
      sendEmail: false,
      recipientMode: 'file',
      recipientFile: txtFile('recipients', ['missing@choir.de']),
      placeholderNamesJson: JSON.stringify([]),
      placeholderFiles: [],
    })).rejects.toThrow('Empfänger nicht gefunden');
  });

  it('throws when recipient file contains invalid email addresses', async () => {
    prismaMock.member.findFirst.mockResolvedValue(null);

    await expect(service.publish({
      markdownTemplate: 'Hi {{firstname}}',
      emailSubject: 'x',
      sendEmail: false,
      recipientMode: 'file',
      recipientFile: txtFile('recipients', ['not-an-email']),
      placeholderNamesJson: JSON.stringify([]),
      placeholderFiles: [],
    })).rejects.toThrow('Empfänger nicht gefunden');
  });

  it('throws when number of placeholder names and files differs', async () => {
    prismaMock.member.findFirst.mockResolvedValue({
      id: 'm-1',
      firstName: 'A',
      lastName: 'A',
      email: 'a@a.de',
    } as any);

    await expect(service.publish({
      markdownTemplate: 'Hi {{firstname}}',
      emailSubject: 'x',
      sendEmail: false,
      recipientMode: 'file',
      recipientFile: txtFile('recipients', ['a@a.de']),
      placeholderNamesJson: JSON.stringify(['code']),
      placeholderFiles: [],
    })).rejects.toThrow('Anzahl Placeholder-Namen und Dateien stimmt nicht überein');
  });

  it('throws when placeholder names are invalid', async () => {
    prismaMock.member.findFirst.mockResolvedValue({
      id: 'm-1',
      firstName: 'A',
      lastName: 'A',
      email: 'a@a.de',
    } as any);

    await expect(service.publish({
      markdownTemplate: 'Hi {{firstname}}',
      emailSubject: 'x',
      sendEmail: false,
      recipientMode: 'file',
      recipientFile: txtFile('recipients', ['a@a.de']),
      placeholderNamesJson: JSON.stringify(['invalid-name']),
      placeholderFiles: [txtFile('invalid-name', ['foo'])],
    })).rejects.toThrow('Ungültiger Placeholder-Name');
  });

  it('does not delete non-targeted entries by default', async () => {
    prismaMock.member.findFirst.mockResolvedValue({
      id: 'm-1',
      firstName: 'Anna',
      lastName: 'Müller',
      email: 'anna@choir.de',
    } as any);

    await service.publish({
      markdownTemplate: 'Hi {{firstname}}',
      emailSubject: 'x',
      sendEmail: false,
      recipientMode: 'file',
      recipientFile: txtFile('recipients', ['anna@choir.de']),
      placeholderNamesJson: JSON.stringify([]),
      placeholderFiles: [],
    });

    expect(prismaMock.personalInfoEntry.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes non-targeted entries when explicitly requested', async () => {
    prismaMock.member.findFirst.mockResolvedValue({
      id: 'm-1',
      firstName: 'Anna',
      lastName: 'Müller',
      email: 'anna@choir.de',
    } as any);

    await service.publish({
      markdownTemplate: 'Hi {{firstname}}',
      emailSubject: 'x',
      sendEmail: false,
      deleteNonTargetedEntries: true,
      recipientMode: 'file',
      recipientFile: txtFile('recipients', ['anna@choir.de']),
      placeholderNamesJson: JSON.stringify([]),
      placeholderFiles: [],
    });

    expect(prismaMock.personalInfoEntry.deleteMany).toHaveBeenCalledWith({
      where: { memberId: { notIn: ['m-1'] } },
    });
  });

  it('starts optional email sending asynchronously when requested', async () => {
    prismaMock.member.findFirst.mockResolvedValue({
      id: 'm-1',
      firstName: 'Anna',
      lastName: 'Müller',
      email: 'anna@choir.de',
    } as any);

    await service.publish({
      markdownTemplate: 'Hi {{firstname}}',
      emailSubject: 'Mail Subject',
      sendEmail: false,
      recipientMode: 'file',
      recipientFile: txtFile('recipients', ['anna@choir.de']),
      placeholderNamesJson: JSON.stringify([]),
      placeholderFiles: [],
    });
    expect(mailService.sendPersonalInfo).not.toHaveBeenCalled();

    let resolveMail: (() => void) | undefined;
    mailService.sendPersonalInfo.mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveMail = resolve;
      }),
    );

    await expect(service.publish({
      markdownTemplate: 'Hi {{firstname}}',
      emailSubject: 'Mail Subject',
      sendEmail: true,
      recipientMode: 'file',
      recipientFile: txtFile('recipients', ['anna@choir.de']),
      placeholderNamesJson: JSON.stringify([]),
      placeholderFiles: [],
    })).resolves.toEqual({
      updatedCount: 1,
      sentCount: 0,
    });

    expect(mailService.sendPersonalInfo).toHaveBeenCalledTimes(1);
    expect(mailService.sendPersonalInfo).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'm-1' }),
      'Mail Subject',
      'Hi Anna',
    );
    expect(resolveMail).toBeDefined();
    resolveMail?.();
  });

  it('rejects when a second email campaign is started while one is running', async () => {
    prismaMock.member.findFirst.mockResolvedValue({
      id: 'm-1',
      firstName: 'Anna',
      lastName: 'Müller',
      email: 'anna@choir.de',
    } as any);

    mailService.sendPersonalInfo.mockImplementation(
      () => new Promise<void>(() => {
        // Keep first campaign running.
      }),
    );

    await service.publish({
      markdownTemplate: 'Hi {{firstname}}',
      emailSubject: 'Mail Subject',
      sendEmail: true,
      recipientMode: 'file',
      recipientFile: txtFile('recipients', ['anna@choir.de']),
      placeholderNamesJson: JSON.stringify([]),
      placeholderFiles: [],
    });

    await expect(service.publish({
      markdownTemplate: 'Hi {{firstname}}',
      emailSubject: 'Mail Subject',
      sendEmail: true,
      recipientMode: 'file',
      recipientFile: txtFile('recipients', ['anna@choir.de']),
      placeholderNamesJson: JSON.stringify([]),
      placeholderFiles: [],
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('enforces one personal-info email per minute', async () => {
    jest.useFakeTimers();
    prismaMock.member.findMany.mockResolvedValue([
      { id: 'm-1', firstName: 'Anna', lastName: 'Müller', email: 'anna@choir.de' },
      { id: 'm-2', firstName: 'Max', lastName: 'Schmidt', email: 'max@choir.de' },
    ] as any);
    mailService.sendPersonalInfo.mockResolvedValue(undefined);

    await service.publish({
      markdownTemplate: 'Hi {{firstname}}',
      emailSubject: 'Mail Subject',
      sendEmail: true,
      recipientMode: 'all',
      placeholderNamesJson: JSON.stringify([]),
      placeholderFiles: [],
    });

    expect(mailService.sendPersonalInfo).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(59_000);
    expect(mailService.sendPersonalInfo).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1_000);
    expect(mailService.sendPersonalInfo).toHaveBeenCalledTimes(2);
  });

  it('reports aggregate send status counters including failures', async () => {
    jest.useFakeTimers();
    const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    prismaMock.member.findMany.mockResolvedValue([
      { id: 'm-1', firstName: 'Anna', lastName: 'Müller', email: 'anna@choir.de' },
      { id: 'm-2', firstName: 'Max', lastName: 'Schmidt', email: 'max@choir.de' },
    ] as any);
    mailService.sendPersonalInfo
      .mockRejectedValueOnce(new Error('SMTP down'))
      .mockResolvedValueOnce(undefined);

    await service.publish({
      markdownTemplate: 'Hi {{firstname}}',
      emailSubject: 'Mail Subject',
      sendEmail: true,
      recipientMode: 'all',
      placeholderNamesJson: JSON.stringify([]),
      placeholderFiles: [],
    });

    expect(service.getSendStatus()).toEqual(expect.objectContaining({
      status: 'RUNNING',
      total: 2,
      sent: 0,
      failed: 1,
      remaining: 1,
      lastError: 'SMTP down',
    }));
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Failed to send personal info email to anna@choir.de: SMTP down',
    );
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.any(Error));

    await jest.advanceTimersByTimeAsync(60_000);

    expect(service.getSendStatus()).toEqual(expect.objectContaining({
      status: 'FAILED',
      total: 2,
      sent: 1,
      failed: 1,
      remaining: 0,
      lastError: 'SMTP down',
    }));
    expect(service.getSendStatus().finishedAt).toBeTruthy();
    loggerErrorSpy.mockRestore();
  });

  it('supports selecting all members as recipients', async () => {
    prismaMock.member.findMany.mockResolvedValue([
      { id: 'm-1', firstName: 'Anna', lastName: 'Müller', email: 'anna@choir.de' },
      { id: 'm-2', firstName: 'Max', lastName: 'Schmidt', email: 'max@choir.de' },
    ] as any);

    await service.publish({
      markdownTemplate: 'Hi {{firstname}} {{code}}',
      emailSubject: 'All',
      sendEmail: false,
      recipientMode: 'all',
      placeholderNamesJson: JSON.stringify(['code']),
      placeholderFiles: [txtFile('code', ['A1', 'B2'])],
    });

    expect(prismaMock.member.findMany).toHaveBeenCalledWith({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    expect(prismaMock.personalInfoEntry.upsert).toHaveBeenCalledTimes(2);
  });
});
