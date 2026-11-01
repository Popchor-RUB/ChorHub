import { mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service';
import { ChoirVoicesService } from './choir-voices.service';

describe('ChoirVoicesService', () => {
  it('counts only active members in voice listings', async () => {
    const prisma = mockDeep<PrismaService>();
    prisma.choirVoice.findMany.mockResolvedValue([]);

    await new ChoirVoicesService(prisma).findAll();

    expect(prisma.choirVoice.findMany).toHaveBeenCalledWith({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { members: { where: { isDisabled: false } } } } },
    });
  });
});
