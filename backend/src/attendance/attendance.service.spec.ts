import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockDeep } from 'jest-mock-extended';
import { AttendanceResponse } from '@prisma/client';

const mockRehearsal = {
  id: 'rehearsal-1',
  date: new Date('2025-03-01'),
  title: 'Probe 1',
  description: null,
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
  let prismaMock: ReturnType<typeof mockDeep<any>>;

  beforeEach(async () => {
    prismaMock = mockDeep();
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
            { response: 'CONFIRMED', member: { choirVoice: 'SOPRAN' } },
            { response: 'CONFIRMED', member: { choirVoice: 'SOPRAN' } },
            { response: 'CONFIRMED', member: { choirVoice: 'BASS' } },
          ],
        },
      ] as any);

      const result = await service.getFutureOverview();

      expect(result[0].totalConfirmed).toBe(3);
      expect(result[0].byVoice.SOPRAN).toBe(2);
      expect(result[0].byVoice.BASS).toBe(1);
    });
  });

  describe('getPastOverview', () => {
    it('groups actual attendance records by choir voice', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        {
          ...mockRehearsal,
          date: new Date('2024-01-01'),
          attendanceRecords: [
            { member: { choirVoice: 'ALT' } },
            { member: { choirVoice: 'TENOR' } },
            { member: { choirVoice: 'ALT' } },
          ],
        },
      ] as any);

      const result = await service.getPastOverview();

      expect(result[0].totalAttended).toBe(3);
      expect(result[0].byVoice.ALT).toBe(2);
      expect(result[0].byVoice.TENOR).toBe(1);
    });
  });
});
