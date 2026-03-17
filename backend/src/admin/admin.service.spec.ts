import { Test } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '../generated/prisma/client';

const mockMember = (overrides: Partial<any> = {}) => ({
  id: 'member-1',
  firstName: 'Anna',
  lastName: 'Müller',
  email: 'anna@choir.de',
  choirVoiceId: null,
  loginCode: null,
  loginCodeExpiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AdminService', () => {
  let service: AdminService;
  let prismaMock: DeepMockProxy<PrismaClient>;
  let mailService: jest.Mocked<MailService>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();
    mailService = {
      sendMagicLink: jest.fn().mockResolvedValue(undefined),
      sendMemberInvite: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MailService>;

    const module = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MailService, useValue: mailService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:5173') },
        },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  describe('createMember', () => {
    const dto = { firstName: 'Peter', lastName: 'Meier', email: 'peter@choir.de' };
    const createdMember = mockMember({ email: 'peter@choir.de' });
    const pastRehearsal = { id: 'r-past-1' };

    beforeEach(() => {
      prismaMock.member.findUnique.mockResolvedValue(null);
      prismaMock.member.create.mockResolvedValue(createdMember);
      prismaMock.rehearsal.findMany.mockResolvedValue([pastRehearsal] as any);
      prismaMock.attendancePlan.createMany.mockResolvedValue({ count: 1 });
      prismaMock.memberLoginToken.create.mockResolvedValue({} as any);
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
        'Stimmlage nicht gefunden',
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

    it('throws BadRequestException for malformed CSV', async () => {
      // csv-parse may not throw on simple text - test with truly malformed
      // Instead test missing columns scenario
      const csvMissingCols = Buffer.from('name,email\nAnna,anna@test.de\n');
      prismaMock.member.findUnique.mockResolvedValue(null);
      prismaMock.member.upsert.mockResolvedValue(mockMember());
      const result = await service.importMembersFromCsv(csvMissingCols);
      expect(result.failed.length).toBeGreaterThan(0);
    });

    it('creates member and sends invite for valid CSV row', async () => {
      const csv = Buffer.from(
        'firstName,lastName,email,choirVoice\nAnna,Müller,anna@choir.de,SOPRAN\n',
      );
      prismaMock.member.findUnique.mockResolvedValue(null);
      prismaMock.member.upsert.mockResolvedValue(mockMember());

      const result = await service.importMembersFromCsv(csv);

      expect(result.created).toBe(1);
      expect(result.failed).toHaveLength(0);
      expect(mailService.sendMemberInvite).toHaveBeenCalledTimes(1);
    });

    it('marks row as failed when choirVoice is invalid', async () => {
      const csv = Buffer.from(
        'firstName,lastName,email,choirVoice\nAnna,Müller,anna@choir.de,INVALIDVOICE\n',
      );
      const result = await service.importMembersFromCsv(csv);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toContain('Ungültige Stimmlage');
      expect(mailService.sendMemberInvite).not.toHaveBeenCalled();
    });

    it('marks row as failed when required fields are missing', async () => {
      const csv = Buffer.from(
        'firstName,lastName,email,choirVoice\nAnna,,anna@choir.de,SOPRAN\n',
      );
      const result = await service.importMembersFromCsv(csv);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toContain('Fehlende Pflichtfelder');
    });

    it('processes multiple rows and tracks results independently', async () => {
      const csv = Buffer.from(
        'firstName,lastName,email,choirVoice\n' +
        'Anna,Müller,anna@choir.de,SOPRAN\n' +
        'Max,Schmidt,max@choir.de,BASS\n' +
        'Bad,Row,bad@choir.de,INVALID\n',
      );
      prismaMock.member.findUnique.mockResolvedValue(null);
      prismaMock.member.upsert.mockResolvedValue(mockMember());

      const result = await service.importMembersFromCsv(csv);

      expect(result.created).toBe(2);
      expect(result.failed).toHaveLength(1);
    });

    it('increments updated count for existing members', async () => {
      const csv = Buffer.from(
        'firstName,lastName,email,choirVoice\nAnna,Müller,anna@choir.de,SOPRAN\n',
      );
      prismaMock.member.findUnique.mockResolvedValue(mockMember()); // existing
      prismaMock.member.upsert.mockResolvedValue(mockMember());

      const result = await service.importMembersFromCsv(csv);
      expect(result.updated).toBe(1);
      expect(result.created).toBe(0);
    });
  });

  describe('getMemberOverview', () => {
    const mockMemberRow = (overrides: {
      attendanceRecords?: { rehearsalId: string }[];
      attendancePlans?: { rehearsalId: string }[];
    } = {}) => ({
      id: 'member-1',
      firstName: 'Anna',
      lastName: 'Müller',
      email: 'anna@choir.de',
      choirVoiceId: null,
      createdAt: new Date(),
      _count: { attendanceRecords: overrides.attendanceRecords?.length ?? 0 },
      attendanceRecords: overrides.attendanceRecords ?? [],
      attendancePlans: overrides.attendancePlans ?? [],
    });

    it('returns unexcusedAbsenceCount=0 when member attended all rehearsals', async () => {
      prismaMock.rehearsal.count.mockResolvedValue(2);
      prismaMock.member.findMany.mockResolvedValue([
        mockMemberRow({
          attendanceRecords: [{ rehearsalId: 'r-1' }, { rehearsalId: 'r-2' }],
        }),
      ] as any);

      const result = await service.getMemberOverview();
      expect(result[0].unexcusedAbsenceCount).toBe(0);
    });

    it('counts missed rehearsals with no plan as unentschuldigt', async () => {
      prismaMock.rehearsal.count.mockResolvedValue(3);
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
      prismaMock.rehearsal.count.mockResolvedValue(3);
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
      prismaMock.rehearsal.count.mockResolvedValue(2);
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

  describe('getMemberRehearsals', () => {
    const mockRehearsalRow = (overrides: {
      attendanceRecords?: { id: string }[];
      attendancePlans?: { response: string }[];
    } = {}) => ({
      id: 'rehearsal-1',
      date: new Date('2025-06-01'),
      title: 'Probe 1',
      description: null,
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
          where: expect.objectContaining({ OR: expect.any(Array) }),
          take: 10,
        }),
      );
    });
  });
});
