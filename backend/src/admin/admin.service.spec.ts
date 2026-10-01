import { Test } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuthService } from '../auth/auth.service';
import { MemberStatusService } from '../members/member-status.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '../generated/prisma/client';

const mockMember = (overrides: Partial<any> = {}) => ({
  id: 'member-1',
  firstName: 'Anna',
  lastName: 'Müller',
  email: 'anna@choir.de',
  choirVoiceId: null,
  lastLoginAt: null,
  isDisabled: false,
  disabledAt: null,
  disableReason: null,
  internalComment: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AdminService', () => {
  let service: AdminService;
  let prismaMock: DeepMockProxy<PrismaClient>;
  let mailService: jest.Mocked<MailService>;
  let authService: jest.Mocked<AuthService>;
  let memberStatusService: jest.Mocked<Pick<MemberStatusService, 'disable' | 'enable'>>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();
    prismaMock.rehearsal.findMany.mockResolvedValue([]);
    mailService = {
      sendMagicLink: jest.fn().mockResolvedValue(undefined),
      sendMemberInvite: jest.fn().mockResolvedValue(undefined),
      sendPushFallbackReminderMail: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MailService>;
    authService = {
      issueMemberMagicLink: jest.fn().mockResolvedValue({
        rawToken: 'raw-token',
        loginCode: '123456',
        magicUrl: 'http://localhost:5173/auth/verify?token=raw-token',
      }),
      requestMagicLink: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuthService>;
    memberStatusService = { disable: jest.fn(), enable: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MailService, useValue: mailService },
        { provide: AuthService, useValue: authService },
        { provide: MemberStatusService, useValue: memberStatusService },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  describe('updateMemberStatus', () => {
    it.each([
      { dto: { disabled: true, reason: undefined }, notifyMember: true, includeReasonInEmail: false },
      { dto: { disabled: true, notifyMember: false, includeReasonInEmail: true, reason: undefined }, notifyMember: false, includeReasonInEmail: true },
      { dto: { disabled: true, notifyMember: true, includeReasonInEmail: true, reason: 'Why' }, notifyMember: true, includeReasonInEmail: true },
    ])('forwards status options with defaults', async ({ dto, notifyMember, includeReasonInEmail }) => {
      memberStatusService.disable.mockResolvedValue(mockMember() as any);
      jest.spyOn(service, 'getMemberById').mockResolvedValue(mockMember() as any);
      await service.updateMemberStatus('member-1', dto);

      expect(memberStatusService.disable).toHaveBeenCalledWith('member-1', dto.reason, false, {
        notifyMember,
        includeReasonInEmail,
      });
      expect(memberStatusService.enable).not.toHaveBeenCalled();
    });

    it('ignores notification options when enabling member', async () => {
      memberStatusService.enable.mockResolvedValue(mockMember() as any);
      jest.spyOn(service, 'getMemberById').mockResolvedValue(mockMember() as any);
      await service.updateMemberStatus('member-1', {
        disabled: false,
        notifyMember: false,
        includeReasonInEmail: true,
      });

      expect(memberStatusService.enable).toHaveBeenCalledWith('member-1');
      expect(memberStatusService.disable).not.toHaveBeenCalled();
    });
  });

  describe('createMember', () => {
    const dto = { firstName: 'Peter', lastName: 'Meier', email: 'peter@choir.de' };
    const createdMember = mockMember({ email: 'peter@choir.de' });
    const pastRehearsal = { id: 'r-past-1' };

    it('rejects address lists before creating a member or issuing an invitation', async () => {
      await expect(service.createMember({ ...dto, email: 'member@example.test,external@example.test' }))
        .rejects.toThrow('Ungültige E-Mail-Adresse');
      expect(prismaMock.member.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.member.create).not.toHaveBeenCalled();
      expect(authService.issueMemberMagicLink).not.toHaveBeenCalled();
      expect(mailService.sendMemberInvite).not.toHaveBeenCalled();
    });

    beforeEach(() => {
      prismaMock.member.findUnique.mockResolvedValue(null);
      prismaMock.member.create.mockResolvedValue(createdMember);
      prismaMock.rehearsal.findMany.mockResolvedValue([pastRehearsal] as any);
      prismaMock.attendancePlan.createMany.mockResolvedValue({ count: 1 });
    });

    it('creates member with provided fields', async () => {
      await service.createMember(dto);
      expect(prismaMock.member.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            firstName: 'Peter',
            lastName: 'Meier',
            email: 'peter@choir.de',
          }),
        }),
      );
    });

    it('sends invite email to the new member', async () => {
      await service.createMember(dto);
      expect(mailService.sendMemberInvite).toHaveBeenCalledWith(
        createdMember,
        expect.stringContaining('/auth/verify?token='),
      );
    });

    it('creates DECLINED attendance plans for all past rehearsals', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        { id: 'r-1' }, { id: 'r-2' },
      ] as any);
      prismaMock.attendancePlan.createMany.mockResolvedValue({ count: 2 });

      await service.createMember(dto);

      expect(prismaMock.attendancePlan.createMany).toHaveBeenCalledWith({
        data: [
          { memberId: createdMember.id, rehearsalId: 'r-1', response: 'DECLINED' },
          { memberId: createdMember.id, rehearsalId: 'r-2', response: 'DECLINED' },
        ],
      });
    });

    it('skips createMany when there are no past rehearsals', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([]);

      await service.createMember(dto);

      expect(prismaMock.attendancePlan.createMany).not.toHaveBeenCalled();
    });

    it('throws ConflictException when email is already taken', async () => {
      prismaMock.member.findUnique.mockResolvedValue(createdMember);

      await expect(service.createMember(dto)).rejects.toThrow('E-Mail-Adresse bereits vergeben');
    });

    it('throws NotFoundException when voiceId does not exist', async () => {
      prismaMock.choirVoice.findUnique.mockResolvedValue(null);

      await expect(service.createMember({ ...dto, voiceId: 'unknown-voice' })).rejects.toThrow(
        'Stimmgruppe nicht gefunden',
      );
      expect(prismaMock.member.create).not.toHaveBeenCalled();
    });

    it('creates member with a valid voiceId', async () => {
      const voice = { id: 'v1', name: 'Sopran', sortOrder: 1, createdAt: new Date() };
      prismaMock.choirVoice.findUnique.mockResolvedValue(voice);

      await service.createMember({ ...dto, voiceId: 'v1' });

      expect(prismaMock.member.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ choirVoiceId: 'v1' }),
        }),
      );
    });
  });

  describe('importMembersFromCsv', () => {
    it.each([
      'member@example.test,external@example.test',
      'member@example.test;external@example.test',
      'Choir: member@example.test,external@example.test;',
      'Anna <member@example.test>',
      'not-an-email',
      'member@example.test\r\nBcc: external@example.test',
      '"member,external"@example.test',
    ])('rejects unsafe email field %s with either CSV delimiter', async (email) => {
      for (const delimiter of [',', ';']) {
        const field = `"${email.replaceAll('"', '""')}"`;
        const csv = Buffer.from(
          `firstName${delimiter}lastName${delimiter}email\nAnna${delimiter}Müller${delimiter}${field}\n`,
        );
        const result = await service.importMembersFromCsv(csv, true);
        expect(result).toEqual({
          created: 0, updated: 0,
          failed: [{ email, reason: 'Ungültige E-Mail-Adresse' }],
        });
      }
      expect(prismaMock.member.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.member.upsert).not.toHaveBeenCalled();
      expect(authService.issueMemberMagicLink).not.toHaveBeenCalled();
      expect(mailService.sendMemberInvite).not.toHaveBeenCalled();
    });

    it('rejects unquoted semicolon-CSV address lists and continues importing valid rows', async () => {
      const csv = Buffer.from(
        'firstName;lastName;email\nAnna;Müller;member@example.test,external@example.test\n' +
        'Ben;Meier;ben@example.test\n',
      );
      prismaMock.member.findUnique.mockResolvedValue(null);
      prismaMock.member.upsert.mockResolvedValue(mockMember({ email: 'ben@example.test' }));

      const result = await service.importMembersFromCsv(csv, true);
      expect(result.created).toBe(1);
      expect(result.failed).toEqual([{
        email: 'member@example.test,external@example.test', reason: 'Ungültige E-Mail-Adresse',
      }]);
      expect(prismaMock.member.upsert).toHaveBeenCalledTimes(1);
      expect(mailService.sendMemberInvite).toHaveBeenCalledTimes(1);
      expect(mailService.sendMemberInvite).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'ben@example.test' }), expect.any(String),
      );
    });

    it('normalizes a valid address before lookup and persistence', async () => {
      const csv = Buffer.from('firstName;lastName;email\nAnna;Müller;"  ANNA@CHOIR.DE  "\n');
      prismaMock.member.findUnique.mockResolvedValue(mockMember());
      prismaMock.member.upsert.mockResolvedValue(mockMember());

      expect(await service.importMembersFromCsv(csv)).toEqual({ created: 0, updated: 1, failed: [] });
      expect(prismaMock.member.findUnique).toHaveBeenCalledWith({ where: { email: 'anna@choir.de' } });
      expect(prismaMock.member.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { email: 'anna@choir.de' }, create: expect.objectContaining({ email: 'anna@choir.de' }),
      }));
    });
    const mockVoices = [
      { id: 'v1', name: 'Sopran', sortOrder: 1, createdAt: new Date() },
      { id: 'v2', name: 'Mezzosopran', sortOrder: 2, createdAt: new Date() },
      { id: 'v3', name: 'Alt', sortOrder: 3, createdAt: new Date() },
      { id: 'v4', name: 'Tenor', sortOrder: 4, createdAt: new Date() },
      { id: 'v5', name: 'Bariton', sortOrder: 5, createdAt: new Date() },
      { id: 'v6', name: 'Bass', sortOrder: 6, createdAt: new Date() },
    ];

    beforeEach(() => {
      prismaMock.choirVoice.findMany.mockResolvedValue(mockVoices);
    });

    it('reports a missing CSV header for an empty file', async () => {
      await expect(service.importMembersFromCsv(Buffer.from(''))).rejects.toThrow(
        'CSV-Kopfzeile fehlt. Erwartete Spalten: firstName, lastName, email',
      );
    });

    it('reports expected columns when the CSV header is invalid', async () => {
      const csv = Buffer.from('name;address\nAnna;anna@test.de\n');

      await expect(service.importMembersFromCsv(csv)).rejects.toThrow(
        'CSV-Kopfzeile fehlt oder ist ungültig. Erwartete Spalten: firstName, lastName, email',
      );
    });

    it('reports missing required CSV columns', async () => {
      const csv = Buffer.from('firstName;email\nAnna;anna@test.de\n');

      await expect(service.importMembersFromCsv(csv)).rejects.toThrow(
        'CSV-Kopfzeile unvollständig. Fehlende Spalten: lastName',
      );
    });

    it('reports an unknown CSV delimiter', async () => {
      const csv = Buffer.from('firstName lastName email\nAnna Müller anna@test.de\n');

      await expect(service.importMembersFromCsv(csv)).rejects.toThrow(
        "CSV-Trennzeichen konnte nicht erkannt werden. Verwenden Sie ',' oder ';'.",
      );
    });

    it('rejects malformed CSV rows', async () => {
      const csv = Buffer.from('firstName;lastName;email\n"Anna;Müller;anna@test.de\n');

      await expect(service.importMembersFromCsv(csv)).rejects.toThrow('Ungültiges CSV-Format');
    });

    it('creates member and sends invite for valid CSV row', async () => {
      const csv = Buffer.from(
        'firstName;lastName;email;choirVoice\nAnna;Müller;anna@choir.de;SOPRAN\n',
      );
      prismaMock.member.findUnique.mockResolvedValue(null);
      prismaMock.member.upsert.mockResolvedValue(mockMember());

      const result = await service.importMembersFromCsv(csv, true);

      expect(result.created).toBe(1);
      expect(result.failed).toHaveLength(0);
      expect(mailService.sendMemberInvite).toHaveBeenCalledTimes(1);
    });

    it('imports comma-delimited CSV with a quoted comma in a name', async () => {
      const csv = Buffer.from(
        '\uFEFFfirstName,lastName,email,choirVoice\nAnna,"Müller, Jr.",anna@choir.de,SOPRAN\n',
      );
      prismaMock.member.findUnique.mockResolvedValue(null);
      prismaMock.member.upsert.mockResolvedValue(mockMember());

      const result = await service.importMembersFromCsv(csv);

      expect(result.created).toBe(1);
      expect(result.failed).toHaveLength(0);
      expect(prismaMock.member.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ lastName: 'Müller, Jr.' }) }),
      );
    });

    it('keeps commas in unquoted values of semicolon-delimited CSV', async () => {
      const csv = Buffer.from(
        'firstName;lastName;email;choirVoice\nAnna;Müller, Jr.;anna@choir.de;SOPRAN\n',
      );
      prismaMock.member.findUnique.mockResolvedValue(null);
      prismaMock.member.upsert.mockResolvedValue(mockMember());

      const result = await service.importMembersFromCsv(csv);

      expect(result.created).toBe(1);
      expect(result.failed).toHaveLength(0);
      expect(prismaMock.member.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ lastName: 'Müller, Jr.' }) }),
      );
    });

    it('creates member but does not send invite when sendEmails is false', async () => {
      const csv = Buffer.from(
        'firstName;lastName;email;choirVoice\nAnna;Müller;anna@choir.de;SOPRAN\n',
      );
      prismaMock.member.findUnique.mockResolvedValue(null);
      prismaMock.member.upsert.mockResolvedValue(mockMember());

      const result = await service.importMembersFromCsv(csv);

      expect(result.created).toBe(1);
      expect(result.failed).toHaveLength(0);
      expect(mailService.sendMemberInvite).not.toHaveBeenCalled();
    });

    it('marks row as failed when choirVoice is invalid', async () => {
      const csv = Buffer.from(
        'firstName;lastName;email;choirVoice\nAnna;Müller;anna@choir.de;INVALIDVOICE\n',
      );
      const result = await service.importMembersFromCsv(csv);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toContain('Ungültige Stimmgruppe');
      expect(mailService.sendMemberInvite).not.toHaveBeenCalled();
    });

    it('imports row with empty choirVoice and stores null choirVoiceId', async () => {
      const csv = Buffer.from('firstName;lastName;email;choirVoice\nAnna;Müller;anna@choir.de;\n');
      prismaMock.member.findUnique.mockResolvedValue(null);
      prismaMock.member.upsert.mockResolvedValue(mockMember());

      const result = await service.importMembersFromCsv(csv);

      expect(result.created).toBe(1);
      expect(result.failed).toHaveLength(0);
      expect(prismaMock.member.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ choirVoiceId: null }),
          update: expect.objectContaining({ choirVoiceId: null }),
        }),
      );
    });

    it('imports row with "-" choirVoice and stores null choirVoiceId', async () => {
      const csv = Buffer.from('firstName;lastName;email;choirVoice\nAnna;Müller;anna@choir.de;-\n');
      prismaMock.member.findUnique.mockResolvedValue(null);
      prismaMock.member.upsert.mockResolvedValue(mockMember());

      const result = await service.importMembersFromCsv(csv);

      expect(result.created).toBe(1);
      expect(result.failed).toHaveLength(0);
      expect(prismaMock.member.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ choirVoiceId: null }),
          update: expect.objectContaining({ choirVoiceId: null }),
        }),
      );
    });

    it('marks row as failed when required fields are missing', async () => {
      const csv = Buffer.from(
        'firstName;lastName;email;choirVoice\nAnna;;anna@choir.de;SOPRAN\n',
      );
      const result = await service.importMembersFromCsv(csv);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toContain('Fehlende Pflichtfelder');
    });

    it('processes multiple rows and tracks results independently', async () => {
      const csv = Buffer.from(
        'firstName;lastName;email;choirVoice\n' +
        'Anna;Müller;anna@choir.de;SOPRAN\n' +
        'Max;Schmidt;max@choir.de;BASS\n' +
        'Bad;Row;bad@choir.de;INVALID\n',
      );
      prismaMock.member.findUnique.mockResolvedValue(null);
      prismaMock.member.upsert.mockResolvedValue(mockMember());

      const result = await service.importMembersFromCsv(csv);

      expect(result.created).toBe(2);
      expect(result.failed).toHaveLength(1);
    });

    it('increments updated count for existing members', async () => {
      const csv = Buffer.from(
        'firstName;lastName;email;choirVoice\nAnna;Müller;anna@choir.de;SOPRAN\n',
      );
      prismaMock.member.findUnique.mockResolvedValue(mockMember()); // existing
      prismaMock.member.upsert.mockResolvedValue(mockMember());

      const result = await service.importMembersFromCsv(csv);
      expect(result.updated).toBe(1);
      expect(result.created).toBe(0);
    });
  });

  describe('getMemberOverview', () => {
    const countableRehearsals = ['r-1', 'r-2', 'r-3'].map((id, index) => ({
      id,
      date: new Date(`2025-01-0${index + 1}T18:00:00Z`),
      isOptional: false,
      attendanceRecords: [{ id: `record-${id}` }],
    }));
    const mockMemberRow = (overrides: {
      attendanceRecords?: { rehearsalId: string }[];
      attendancePlans?: { rehearsalId: string }[];
      internalComment?: string | null;
    } = {}) => ({
      id: 'member-1',
      firstName: 'Anna',
      lastName: 'Müller',
      email: 'anna@choir.de',
      internalComment: overrides.internalComment ?? null,
      choirVoiceId: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      _count: { attendanceRecords: overrides.attendanceRecords?.length ?? 0 },
      attendanceRecords: overrides.attendanceRecords ?? [],
      attendancePlans: overrides.attendancePlans ?? [],
    });

    it('returns unexcusedAbsenceCount=0 when member attended all rehearsals', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue(countableRehearsals.slice(0, 2) as any);
      prismaMock.member.findMany.mockResolvedValue([
        mockMemberRow({
          attendanceRecords: [{ rehearsalId: 'r-1' }, { rehearsalId: 'r-2' }],
          internalComment: 'Bitte anrufen',
        }),
      ] as any);

      const result = await service.getMemberOverview();
      expect(result[0].unexcusedAbsenceCount).toBe(0);
      expect(result[0].internalComment).toBe('Bitte anrufen');
      expect(prismaMock.rehearsal.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ date: { lt: expect.any(Date) }, isOptional: false }),
      }));
    });

    it('counts missed rehearsals with no plan as unentschuldigt', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue(countableRehearsals as any);
      prismaMock.member.findMany.mockResolvedValue([
        mockMemberRow({
          attendanceRecords: [{ rehearsalId: 'r-1' }],
          attendancePlans: [],
        }),
      ] as any);

      const result = await service.getMemberOverview();
      // attended 1, no excuses → 2 unentschuldigt
      expect(result[0].unexcusedAbsenceCount).toBe(2);
    });

    it('reduces unexcusedAbsenceCount for DECLINED plans (entschuldigt)', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue(countableRehearsals as any);
      prismaMock.member.findMany.mockResolvedValue([
        mockMemberRow({
          attendanceRecords: [{ rehearsalId: 'r-1' }],
          attendancePlans: [{ rehearsalId: 'r-2' }], // DECLINED (only DECLINED is fetched)
        }),
      ] as any);

      const result = await service.getMemberOverview();
      // attended r-1, excused r-2 → only r-3 is unentschuldigt
      expect(result[0].unexcusedAbsenceCount).toBe(1);
    });

    it('does NOT reduce unexcusedAbsenceCount for CONFIRMED plans (unentschuldigt)', async () => {
      // The query filters attendancePlans to DECLINED only, so a CONFIRMED plan
      // never appears in attendancePlans here — absence remains unentschuldigt.
      prismaMock.rehearsal.findMany.mockResolvedValue(countableRehearsals.slice(0, 2) as any);
      prismaMock.member.findMany.mockResolvedValue([
        mockMemberRow({
          attendanceRecords: [],
          attendancePlans: [], // CONFIRMED plan is excluded by the DB query filter
        }),
      ] as any);

      const result = await service.getMemberOverview();
      expect(result[0].unexcusedAbsenceCount).toBe(2);
    });
  });

  describe('getMemberActivityStats', () => {
    const mockActivityMember = (overrides: {
      id?: string;
      choirVoice?: { id: string; name: string; sortOrder: number } | null;
      attendanceRecords?: { rehearsalId: string }[];
    } = {}) => ({
      id: overrides.id ?? 'member-1',
      choirVoice: overrides.choirVoice ?? null,
      attendanceRecords: overrides.attendanceRecords ?? [],
    });

    beforeEach(() => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        { id: 'r-1', title: 'Probe 1', date: new Date('2026-01-01') },
        { id: 'r-2', title: 'Probe 2', date: new Date('2026-01-08') },
      ] as any);
    });

    it('counts unique active members once across selected rehearsals', async () => {
      prismaMock.member.findMany.mockResolvedValue([
        mockActivityMember({
          id: 'm-1',
          attendanceRecords: [{ rehearsalId: 'r-1' }, { rehearsalId: 'r-2' }],
        }),
        mockActivityMember({
          id: 'm-2',
          attendanceRecords: [{ rehearsalId: 'r-2' }],
        }),
      ] as any);

      const result = await service.getMemberActivityStats(['r-1', 'r-2']);

      expect(result.activeMemberCount).toBe(2);
      expect(result.totalAttendances).toBe(3);
      expect(result.averageAttendancePerRehearsal).toBe(1.5);
    });

    it('computes inactive count and active rate from total members', async () => {
      prismaMock.member.findMany.mockResolvedValue([
        mockActivityMember({ id: 'm-1', attendanceRecords: [{ rehearsalId: 'r-1' }] }),
        mockActivityMember({ id: 'm-2' }),
        mockActivityMember({ id: 'm-3' }),
      ] as any);

      const result = await service.getMemberActivityStats(['r-1', 'r-2']);

      expect(result.memberCountTotal).toBe(3);
      expect(result.activeMemberCount).toBe(1);
      expect(result.inactiveMemberCount).toBe(2);
      expect(result.activeRate).toBeCloseTo(1 / 3);
    });

    it('groups active totals by voice including members without voice', async () => {
      prismaMock.member.findMany.mockResolvedValue([
        mockActivityMember({
          id: 'm-1',
          choirVoice: { id: 'v-1', name: 'Sopran', sortOrder: 1 },
          attendanceRecords: [{ rehearsalId: 'r-1' }],
        }),
        mockActivityMember({
          id: 'm-2',
          choirVoice: { id: 'v-1', name: 'Sopran', sortOrder: 1 },
        }),
        mockActivityMember({
          id: 'm-3',
          attendanceRecords: [{ rehearsalId: 'r-2' }],
        }),
      ] as any);

      const result = await service.getMemberActivityStats(['r-1', 'r-2']);

      expect(result.byVoice).toEqual([
        {
          voiceId: 'v-1',
          voiceName: 'Sopran',
          totalMembers: 2,
          activeMembers: 1,
          activeRate: 0.5,
        },
        {
          voiceId: null,
          voiceName: null,
          totalMembers: 1,
          activeMembers: 1,
          activeRate: 1,
        },
      ]);
    });

    it('ignores optional rehearsal ids', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        { id: 'r-required', title: 'Pflichtprobe', date: new Date('2026-01-08') },
      ] as any);
      prismaMock.member.findMany.mockResolvedValue([
        mockActivityMember({ id: 'm-1', attendanceRecords: [{ rehearsalId: 'r-required' }] }),
      ] as any);

      const result = await service.getMemberActivityStats(['r-required', 'r-optional']);

      expect(prismaMock.rehearsal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isOptional: false }),
        }),
      );
      expect(prismaMock.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            attendanceRecords: expect.objectContaining({
              where: { rehearsalId: { in: ['r-required'] } },
            }),
          }),
        }),
      );
      expect(result.selectedRehearsals).toHaveLength(1);
      expect(result.activeMemberCount).toBe(1);
    });

    it('returns zero-safe values when no valid rehearsals are selected', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([]);
      prismaMock.member.findMany.mockResolvedValue([
        mockActivityMember({ id: 'm-1' }),
        mockActivityMember({ id: 'm-2' }),
      ] as any);

      const result = await service.getMemberActivityStats(['r-optional']);

      expect(result.selectedRehearsals).toEqual([]);
      expect(result.activeMemberCount).toBe(0);
      expect(result.inactiveMemberCount).toBe(2);
      expect(result.activeRate).toBe(0);
      expect(result.averageAttendancePerRehearsal).toBe(0);
    });
  });

  describe('getMemberRehearsals', () => {
    const mockRehearsalRow = (overrides: {
      attendanceRecords?: { id: string }[];
      attendancePlans?: { response: string }[];
      isOptional?: boolean;
    } = {}) => ({
      id: 'rehearsal-1',
      date: new Date('2025-06-01'),
      title: 'Probe 1',
      description: null,
      isOptional: overrides.isOptional ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
      attendanceRecords: overrides.attendanceRecords ?? [],
      attendancePlans: overrides.attendancePlans ?? [],
    });

    it('returns attended=true when member has a record', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        mockRehearsalRow({ attendanceRecords: [{ id: 'rec-1' }] }),
      ] as any);

      const result = await service.getMemberRehearsals('member-1');
      expect(result[0].attended).toBe(true);
    });

    it('includes isOptional field in member rehearsal rows', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        mockRehearsalRow({ isOptional: true }),
      ] as any);
      const result = await service.getMemberRehearsals('member-1');
      expect(result[0].isOptional).toBe(true);
    });

    it('returns attended=false and plan=DECLINED → entschuldigt', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        mockRehearsalRow({ attendancePlans: [{ response: 'DECLINED' }] }),
      ] as any);

      const result = await service.getMemberRehearsals('member-1');
      expect(result[0].attended).toBe(false);
      expect(result[0].plan).toBe('DECLINED');
    });

    it('returns attended=false and plan=CONFIRMED → unentschuldigt', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        mockRehearsalRow({ attendancePlans: [{ response: 'CONFIRMED' }] }),
      ] as any);

      const result = await service.getMemberRehearsals('member-1');
      expect(result[0].attended).toBe(false);
      expect(result[0].plan).toBe('CONFIRMED');
    });

    it('returns attended=false and plan=null → unentschuldigt', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        mockRehearsalRow(),
      ] as any);

      const result = await service.getMemberRehearsals('member-1');
      expect(result[0].attended).toBe(false);
      expect(result[0].plan).toBeNull();
    });

    it('returns correct shape for a mix of past rehearsals', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        mockRehearsalRow({ attendanceRecords: [{ id: 'rec-1' }] }),
        mockRehearsalRow({ attendancePlans: [{ response: 'DECLINED' }] }),
        mockRehearsalRow({ attendancePlans: [{ response: 'CONFIRMED' }] }),
        mockRehearsalRow(),
      ] as any);

      const result = await service.getMemberRehearsals('member-1');
      expect(result[0]).toMatchObject({ attended: true, plan: null });
      expect(result[1]).toMatchObject({ attended: false, plan: 'DECLINED' });
      expect(result[2]).toMatchObject({ attended: false, plan: 'CONFIRMED' });
      expect(result[3]).toMatchObject({ attended: false, plan: null });
    });
  });

  describe('adminSetMemberAttendancePlan', () => {
    const memberId = 'member-1';
    const rehearsalId = 'rehearsal-1';

    beforeEach(() => {
      prismaMock.member.findUnique.mockResolvedValue(mockMember() as any);
      prismaMock.rehearsal.findUnique.mockResolvedValue({
        id: rehearsalId,
        isOptional: false,
        date: new Date('2025-01-01'),
        title: 'Probe',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
    });

    it('upserts DECLINED plan when response is DECLINED', async () => {
      prismaMock.attendancePlan.upsert.mockResolvedValue({} as any);
      const result = await service.adminSetMemberAttendancePlan(memberId, rehearsalId, 'DECLINED');
      expect(prismaMock.attendancePlan.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ response: 'DECLINED' }) }),
      );
      expect(result).toEqual({ plan: 'DECLINED' });
    });

    it('deletes the plan when response is null', async () => {
      prismaMock.attendancePlan.delete.mockResolvedValue({} as any);
      const result = await service.adminSetMemberAttendancePlan(memberId, rehearsalId, null);
      expect(prismaMock.attendancePlan.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { memberId_rehearsalId: { memberId, rehearsalId } } }),
      );
      expect(result).toEqual({ plan: null });
    });

    it('throws NotFoundException when member does not exist', async () => {
      prismaMock.member.findUnique.mockResolvedValue(null);
      await expect(
        service.adminSetMemberAttendancePlan('bad-id', rehearsalId, 'DECLINED'),
      ).rejects.toThrow('Mitglied nicht gefunden');
    });

    it('throws NotFoundException when rehearsal does not exist', async () => {
      prismaMock.rehearsal.findUnique.mockResolvedValue(null);
      await expect(
        service.adminSetMemberAttendancePlan(memberId, 'bad-id', 'DECLINED'),
      ).rejects.toThrow('Probe nicht gefunden');
    });

    it('allows DECLINED for optional rehearsal', async () => {
      prismaMock.rehearsal.findUnique.mockResolvedValue({
        id: rehearsalId,
        isOptional: true,
      } as any);

      prismaMock.attendancePlan.upsert.mockResolvedValue({} as any);
      const result = await service.adminSetMemberAttendancePlan(memberId, rehearsalId, 'DECLINED');

      expect(prismaMock.attendancePlan.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ response: 'DECLINED' }),
          update: expect.objectContaining({ response: 'DECLINED' }),
        }),
      );
      expect(result).toEqual({ plan: 'DECLINED' });
    });
  });

  describe('searchMembers', () => {
    it('returns empty array for empty query', async () => {
      const result = await service.searchMembers('');
      expect(result).toEqual([]);
      expect(prismaMock.member.findMany).not.toHaveBeenCalled();
    });

    it('calls prisma with case-insensitive search', async () => {
      prismaMock.member.findMany.mockResolvedValue([]);
      await service.searchMembers('anna');
      expect(prismaMock.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isDisabled: false, OR: expect.any(Array) }),
          take: 10,
        }),
      );
    });
  });

  describe('getMemberById', () => {
    it('returns member detail with counters', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue(
        ['r-1', 'r-2', 'r-3', 'r-4', 'r-5'].map((id) => ({
          id,
          date: new Date('2025-06-01T18:00:00Z'),
          isOptional: false,
          attendanceRecords: [{ id: `record-${id}` }],
        })) as any,
      );
      prismaMock.member.findUnique.mockResolvedValue({
        id: 'member-1',
        firstName: 'Anna',
        lastName: 'Müller',
        email: 'anna@choir.de',
        choirVoice: { id: 'v1', name: 'Sopran', sortOrder: 1 },
        internalComment: 'Bitte anrufen',
        createdAt: new Date('2025-01-01'),
        attendanceRecords: [{ rehearsalId: 'r-1' }, { rehearsalId: 'r-2' }],
        attendancePlans: [{ rehearsalId: 'r-3' }],
      } as any);

      const result = await service.getMemberById('member-1');
      expect(result).toMatchObject({
        id: 'member-1',
        firstName: 'Anna',
        internalComment: 'Bitte anrufen',
        attendanceCount: 2,
        unexcusedAbsenceCount: 2,
      });
    });

    it('throws NotFoundException when member does not exist', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([]);
      prismaMock.member.findUnique.mockResolvedValue(null);
      await expect(service.getMemberById('missing')).rejects.toThrow('Mitglied nicht gefunden');
    });

    it('trims member comments, clears blank comments, and reports missing members', async () => {
      prismaMock.member.updateMany.mockResolvedValue({ count: 1 } as any);
      await expect(service.updateMemberComment('member-1', '  Notiz  ')).resolves.toEqual({ comment: 'Notiz' });
      expect(prismaMock.member.updateMany).toHaveBeenLastCalledWith({
        where: { id: 'member-1' },
        data: { internalComment: 'Notiz' },
      });

      await expect(service.updateMemberComment('member-1', '   ')).resolves.toEqual({ comment: null });
      expect(prismaMock.member.updateMany).toHaveBeenLastCalledWith({
        where: { id: 'member-1' },
        data: { internalComment: null },
      });

      prismaMock.member.updateMany.mockResolvedValue({ count: 0 } as any);
      await expect(service.updateMemberComment('missing', 'note')).rejects.toThrow('Mitglied nicht gefunden');
    });
  });

  describe('updateMember', () => {
    const dto = { firstName: 'Neu', lastName: 'Name', email: 'new@choir.de' };

    it('rejects address lists before updating a member', async () => {
      prismaMock.member.findUnique.mockResolvedValue(mockMember());
      await expect(service.updateMember('member-1', {
        ...dto, email: 'member@example.test,external@example.test',
      })).rejects.toThrow('Ungültige E-Mail-Adresse');
      expect(prismaMock.member.update).not.toHaveBeenCalled();
    });

    it('updates member and returns refreshed detail', async () => {
      prismaMock.member.findUnique
        .mockResolvedValueOnce(mockMember({ id: 'member-1' }) as any)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'member-1',
          firstName: 'Neu',
          lastName: 'Name',
          email: 'new@choir.de',
          choirVoice: null,
          createdAt: new Date('2025-01-01'),
          attendanceRecords: [],
          attendancePlans: [],
        } as any);
      prismaMock.rehearsal.count.mockResolvedValue(0);
      prismaMock.member.update.mockResolvedValue({} as any);

      const result = await service.updateMember('member-1', dto);

      expect(prismaMock.member.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'member-1' },
          data: expect.objectContaining({ firstName: 'Neu', email: 'new@choir.de' }),
        }),
      );
      expect(result.firstName).toBe('Neu');
    });

    it('throws conflict on duplicate email', async () => {
      prismaMock.member.findUnique
        .mockResolvedValueOnce(mockMember({ id: 'member-1' }) as any)
        .mockResolvedValueOnce(mockMember({ id: 'member-2', email: 'new@choir.de' }) as any);

      await expect(service.updateMember('member-1', dto)).rejects.toThrow('E-Mail-Adresse bereits vergeben');
    });
  });

  describe('member mail actions', () => {
    it('sends invite mail', async () => {
      prismaMock.member.findUnique.mockResolvedValue(mockMember({ id: 'member-1' }) as any);
      await service.sendMemberInvite('member-1');
      expect(authService.issueMemberMagicLink).toHaveBeenCalledWith('member-1');
      expect(mailService.sendMemberInvite).toHaveBeenCalledTimes(1);
    });

    it('sends login mail via auth service', async () => {
      prismaMock.member.findUnique.mockResolvedValue(mockMember({ id: 'member-1', email: 'a@b.c' }) as any);
      await service.sendMemberLoginEmail('member-1');
      expect(authService.requestMagicLink).toHaveBeenCalledWith('a@b.c');
    });
  });
});
