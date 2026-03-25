import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RehearsalsService } from './rehearsals.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '../generated/prisma/client';

const mockRehearsal = {
  id: 'rehearsal-1',
  date: new Date('2025-06-01'),
  title: 'Probe 1',
  description: null,
  location: null,
  durationMinutes: null,
  isOptional: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('RehearsalsService', () => {
  let service: RehearsalsService;
  let prismaMock: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();
    const module = await Test.createTestingModule({
      providers: [
        RehearsalsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: { get: jest.fn(() => 'https://app.chorhub.test') } },
      ],
    }).compile();
    service = module.get(RehearsalsService);
  });

  describe('findUpcoming', () => {
    it('queries rehearsals with date >= now', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([]);
      await service.findUpcoming();
      expect(prismaMock.rehearsal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { date: { gte: expect.any(Date) } },
          orderBy: { date: 'asc' },
        }),
      );
    });

    it('includes attendancePlans when memberId provided', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        { ...mockRehearsal, attendancePlans: [], attendanceRecords: [], _count: { attendanceRecords: 0 } },
      ] as any);
      await service.findUpcoming('member-1');
      const call = prismaMock.rehearsal.findMany.mock.calls[0][0];
      expect(call?.include).toBeDefined();
    });

    it('maps myPlan from attendancePlans', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        {
          ...mockRehearsal,
          attendancePlans: [{ response: 'CONFIRMED' }],
          attendanceRecords: [],
          _count: { attendanceRecords: 0 },
        },
      ] as any);
      const result = await service.findUpcoming('member-1');
      expect(result[0].myPlan).toBe('CONFIRMED');
    });

    it('maps isOptional from rehearsal payload', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        { ...mockRehearsal, isOptional: true, attendancePlans: [], attendanceRecords: [], _count: { attendanceRecords: 0 } },
      ] as any);
      const result = await service.findUpcoming('member-1');
      expect(result[0].isOptional).toBe(true);
    });

    it('returns null myPlan when no plan set', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        { ...mockRehearsal, attendancePlans: [], attendanceRecords: [], _count: { attendanceRecords: 0 } },
      ] as any);
      const result = await service.findUpcoming('member-1');
      expect(result[0].myPlan).toBeNull();
    });
  });

  describe('findAllForMember', () => {
    const pastRehearsal = {
      ...mockRehearsal,
      date: new Date('2020-01-01'), // clearly in the past (> 1 hour ago)
    };
    const recentRehearsal = {
      ...mockRehearsal,
      date: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago (< 1 hour)
    };

    it('returns myAttended=null when admin has not recorded attendance for anyone', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        { ...pastRehearsal, attendancePlans: [], attendanceRecords: [], _count: { attendanceRecords: 0 } },
      ] as any);
      const result = await service.findAllForMember('member-1');
      expect(result[0].myAttended).toBeNull();
    });

    it('returns myAttended=true when this member has an attendance record', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        {
          ...pastRehearsal,
          attendancePlans: [],
          attendanceRecords: [{ id: 'rec-1' }],
          _count: { attendanceRecords: 1 },
        },
      ] as any);
      const result = await service.findAllForMember('member-1');
      expect(result[0].myAttended).toBe(true);
    });

    it('returns myAttended=false when admin recorded others but not this member', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        {
          ...pastRehearsal,
          attendancePlans: [],
          attendanceRecords: [], // this member not recorded
          _count: { attendanceRecords: 3 }, // but others were
        },
      ] as any);
      const result = await service.findAllForMember('member-1');
      expect(result[0].myAttended).toBe(false);
    });

    it('returns myPlan=DECLINED when member declined — counts as entschuldigt', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        {
          ...pastRehearsal,
          attendancePlans: [{ response: 'DECLINED' }],
          attendanceRecords: [],
          _count: { attendanceRecords: 1 },
        },
      ] as any);
      const result = await service.findAllForMember('member-1');
      expect(result[0].myAttended).toBe(false);
      expect(result[0].myPlan).toBe('DECLINED');
    });

    it('returns myPlan=CONFIRMED when member confirmed but did not attend — counts as unentschuldigt', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        {
          ...pastRehearsal,
          attendancePlans: [{ response: 'CONFIRMED' }],
          attendanceRecords: [],
          _count: { attendanceRecords: 1 },
        },
      ] as any);
      const result = await service.findAllForMember('member-1');
      expect(result[0].myAttended).toBe(false);
      expect(result[0].myPlan).toBe('CONFIRMED');
    });

    it('returns myAttended=null when admin recorded others but rehearsal started < 1 hour ago', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        {
          ...recentRehearsal,
          attendancePlans: [],
          attendanceRecords: [], // this member not recorded
          _count: { attendanceRecords: 3 }, // but others were
        },
      ] as any);
      const result = await service.findAllForMember('member-1');
      expect(result[0].myAttended).toBeNull();
    });

    it('returns myPlan=null when member set no plan and did not attend — counts as unentschuldigt', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        {
          ...pastRehearsal,
          attendancePlans: [],
          attendanceRecords: [],
          _count: { attendanceRecords: 1 },
        },
      ] as any);
      const result = await service.findAllForMember('member-1');
      expect(result[0].myAttended).toBe(false);
      expect(result[0].myPlan).toBeNull();
    });
  });

  describe('create', () => {
    it('creates rehearsal with correct data', async () => {
      prismaMock.rehearsal.create.mockResolvedValue(mockRehearsal);
      await service.create({
        date: '2025-06-01',
        title: 'Probe 1',
        location: 'Gemeindesaal',
        durationMinutes: 90,
        isOptional: true,
      });
      expect(prismaMock.rehearsal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Probe 1',
            location: 'Gemeindesaal',
            durationMinutes: 90,
            isOptional: true,
          }),
        }),
      );
    });
  });

  describe('getMemberCalendar', () => {
    it('returns iCalendar payload with stable UID and updated timestamp fields', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        {
          ...mockRehearsal,
          id: 'abc-123',
          title: 'General rehearsal',
          description: 'Bring folder',
          location: 'Community Hall',
          date: new Date('2026-03-30T18:30:00.000Z'),
          durationMinutes: 90,
          updatedAt: new Date('2026-03-24T10:00:00.000Z'),
        },
      ] as any);

      const result = await service.getMemberCalendar();

      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).toContain('BEGIN:VEVENT');
      expect(result).toContain('UID:rehearsal-abc-123@app.chorhub.test');
      expect(result).toContain('DTSTART:20260330T183000Z');
      expect(result).toContain('DTEND:20260330T200000Z');
      expect(result).toContain('LAST-MODIFIED:20260324T100000Z');
      expect(result).toContain('LOCATION:Community Hall');
      expect(result).toContain('SUMMARY:General rehearsal');
      expect(result).toContain('DESCRIPTION:Bring folder');
      expect(result).toContain('END:VCALENDAR');
    });
  });

  describe('update', () => {
    it('throws NotFoundException when rehearsal not found', async () => {
      prismaMock.rehearsal.findUnique.mockResolvedValue(null);
      await expect(service.update('bad-id', { title: 'New Title' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates rehearsal when found', async () => {
      prismaMock.rehearsal.findUnique.mockResolvedValue(mockRehearsal);
      prismaMock.rehearsal.update.mockResolvedValue({ ...mockRehearsal, title: 'Updated' });
      const result = await service.update('rehearsal-1', { title: 'Updated' });
      expect(prismaMock.rehearsal.update).toHaveBeenCalled();
      expect(result.title).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when rehearsal not found', async () => {
      prismaMock.rehearsal.findUnique.mockResolvedValue(null);
      await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('deletes rehearsal when found', async () => {
      prismaMock.rehearsal.findUnique.mockResolvedValue(mockRehearsal);
      prismaMock.rehearsal.delete.mockResolvedValue(mockRehearsal);
      await service.remove('rehearsal-1');
      expect(prismaMock.rehearsal.delete).toHaveBeenCalledWith({ where: { id: 'rehearsal-1' } });
    });
  });
});
