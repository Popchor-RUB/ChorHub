import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RehearsalsService } from './rehearsals.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '../generated/prisma/client';

const mockRehearsal = {
  id: 'rehearsal-1',
  date: new Date('2025-06-01'),
  title: 'Probe 1',
  description: null,
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

    it('returns null myPlan when no plan set', async () => {
      prismaMock.rehearsal.findMany.mockResolvedValue([
        { ...mockRehearsal, attendancePlans: [], attendanceRecords: [], _count: { attendanceRecords: 0 } },
      ] as any);
      const result = await service.findUpcoming('member-1');
      expect(result[0].myPlan).toBeNull();
    });
  });

  describe('create', () => {
    it('creates rehearsal with correct data', async () => {
      prismaMock.rehearsal.create.mockResolvedValue(mockRehearsal);
      await service.create({ date: '2025-06-01', title: 'Probe 1' });
      expect(prismaMock.rehearsal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'Probe 1' }),
        }),
      );
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
