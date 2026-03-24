import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, AttendanceResponse } from '../generated/prisma/client';

const mockRehearsal = {
  id: 'rehearsal-1',
  date: new Date('2030-01-01'),
  title: 'Probe 1',
  description: null,
  location: null,
  durationMinutes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockMember = {
  id: 'member-1',
  firstName: 'Anna',
  lastName: 'Müller',
  choirVoice: 'SOPRAN' as const,
  email: 'anna@choir.de',
  loginToken: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prismaMock: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();
    const module = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(AttendanceService);
  });

  describe('setAttendancePlan', () => {
    it('throws NotFoundException when rehearsal does not exist', async () => {
      prismaMock.rehearsal.findUnique.mockResolvedValue(null);
      await expect(
        service.setAttendancePlan('m1', 'bad-id', { response: AttendanceResponse.CONFIRMED }),
      ).rejects.toThrow(NotFoundException);
    });

    it('upserts attendance plan for existing rehearsal', async () => {
      prismaMock.rehearsal.findUnique.mockResolvedValue(mockRehearsal);
      prismaMock.attendancePlan.upsert.mockResolvedValue({} as any);

      await service.setAttendancePlan('member-1', 'rehearsal-1', {
        response: AttendanceResponse.CONFIRMED,
      });

      expect(prismaMock.attendancePlan.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { memberId_rehearsalId: { memberId: 'member-1', rehearsalId: 'rehearsal-1' } },
          create: expect.objectContaining({ response: AttendanceResponse.CONFIRMED }),
          update: expect.objectContaining({ response: AttendanceResponse.CONFIRMED }),
        }),
      );
    });
  });

  describe('getRecordsForRehearsal', () => {
    const rehearsalA = { ...mockRehearsal, id: 'r-a', date: new Date('2025-01-01') };
    const rehearsalB = { ...mockRehearsal, id: 'r-b', date: new Date('2025-02-01') };
    const rehearsalC = { ...mockRehearsal, id: 'r-c', date: new Date('2025-03-01') };

    it('throws NotFoundException when rehearsal does not exist', async () => {
      prismaMock.rehearsal.findUnique.mockResolvedValue(null);
      await expect(service.getRecordsForRehearsal('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('computes lastAttendedRehearsalsAgo correctly', async () => {
      // Current rehearsal is C; past rehearsals are B (1 ago) and A (2 ago)
      prismaMock.rehearsal.findUnique.mockResolvedValue(rehearsalC);
      prismaMock.rehearsal.findMany.mockResolvedValue([rehearsalB, rehearsalA] as any);
      prismaMock.member.findMany.mockResolvedValue([
        { ...mockMember, attendanceRecords: [], attendancePlans: [] },
      ] as any);
      // Member attended rehearsal A (2 ago) and B (1 ago)
      prismaMock.attendanceRecord.findMany.mockResolvedValue([
        { memberId: mockMember.id, rehearsalId: 'r-b' },
        { memberId: mockMember.id, rehearsalId: 'r-a' },
      ] as any);

      const result = await service.getRecordsForRehearsal('r-c');

      // Most recent past attendance is B = 1 ago
      expect(result[0].lastAttendedRehearsalsAgo).toBe(1);
    });

    it('returns null when member has never attended', async () => {
      prismaMock.rehearsal.findUnique.mockResolvedValue(rehearsalC);
      prismaMock.rehearsal.findMany.mockResolvedValue([rehearsalB] as any);
      prismaMock.member.findMany.mockResolvedValue([
        { ...mockMember, attendanceRecords: [], attendancePlans: [] },
      ] as any);
      prismaMock.attendanceRecord.findMany.mockResolvedValue([] as any);

      const result = await service.getRecordsForRehearsal('r-c');

      expect(result[0].lastAttendedRehearsalsAgo).toBeNull();
    });

    it('returns null when there are no past rehearsals', async () => {
      prismaMock.rehearsal.findUnique.mockResolvedValue(rehearsalA);
      prismaMock.rehearsal.findMany.mockResolvedValue([] as any);
      prismaMock.member.findMany.mockResolvedValue([
        { ...mockMember, attendanceRecords: [{ id: 'rec-1' }], attendancePlans: [] },
      ] as any);

      const result = await service.getRecordsForRehearsal('r-a');

      expect(result[0].attended).toBe(true);
      expect(result[0].lastAttendedRehearsalsAgo).toBeNull();
    });
  });

  describe('bulkSetAttendanceRecords', () => {
    it('throws NotFoundException when rehearsal does not exist', async () => {
      prismaMock.rehearsal.findUnique.mockResolvedValue(null);
      await expect(
        service.bulkSetAttendanceRecords('bad-id', ['m1']),
      ).rejects.toThrow(NotFoundException);
    });

    it('deletes existing records and creates new ones', async () => {
      prismaMock.rehearsal.findUnique.mockResolvedValue(mockRehearsal);
      prismaMock.attendanceRecord.deleteMany.mockResolvedValue({ count: 2 });
      prismaMock.attendanceRecord.createMany.mockResolvedValue({ count: 2 });

      await service.bulkSetAttendanceRecords('rehearsal-1', ['m1', 'm2']);

      expect(prismaMock.attendanceRecord.deleteMany).toHaveBeenCalledWith({
        where: { rehearsalId: 'rehearsal-1' },
      });
      expect(prismaMock.attendanceRecord.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            { memberId: 'm1', rehearsalId: 'rehearsal-1' },
            { memberId: 'm2', rehearsalId: 'rehearsal-1' },
          ],
        }),
      );
    });

    it('does not call createMany when memberIds is empty', async () => {
      prismaMock.rehearsal.findUnique.mockResolvedValue(mockRehearsal);
      prismaMock.attendanceRecord.deleteMany.mockResolvedValue({ count: 0 });

      await service.bulkSetAttendanceRecords('rehearsal-1', []);

      expect(prismaMock.attendanceRecord.createMany).not.toHaveBeenCalled();
    });
  });

  describe('getFutureOverview', () => {
    it('groups confirmed attendances by choir voice', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        {
          ...mockRehearsal,
          date: new Date(Date.now() + 86400000),
          attendancePlans: [
            { response: 'CONFIRMED', member: { choirVoice: { name: 'Sopran' } } },
            { response: 'CONFIRMED', member: { choirVoice: { name: 'Sopran' } } },
            { response: 'CONFIRMED', member: { choirVoice: { name: 'Bass' } } },
          ],
        },
      ] as any);

      const result = await service.getFutureOverview();

      expect(result[0].totalConfirmed).toBe(3);
      expect(result[0].byVoice['Sopran']).toBe(2);
      expect(result[0].byVoice['Bass']).toBe(1);
    });
  });

  describe('getPastOverview', () => {
    it('groups actual attendance records by choir voice', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        {
          ...mockRehearsal,
          date: new Date('2024-01-01'),
          attendanceRecords: [
            { member: { choirVoice: { name: 'Alt' } } },
            { member: { choirVoice: { name: 'Tenor' } } },
            { member: { choirVoice: { name: 'Alt' } } },
          ],
        },
      ] as any);

      const result = await service.getPastOverview();

      expect(result[0].totalAttended).toBe(3);
      expect(result[0].byVoice['Alt']).toBe(2);
      expect(result[0].byVoice['Tenor']).toBe(1);
    });
  });
});
