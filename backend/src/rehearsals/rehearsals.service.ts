import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRehearsalDto } from './dto/create-rehearsal.dto';
import { UpdateRehearsalDto } from './dto/update-rehearsal.dto';

@Injectable()
export class RehearsalsService {
  constructor(private readonly prisma: PrismaService) {}

  async findUpcoming(memberId?: string) {
    return this.findForMember(memberId, false);
  }

  async findAllForMember(memberId: string) {
    return this.findForMember(memberId, true);
  }

  private async findForMember(memberId: string | undefined, includeAll: boolean) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const rehearsals = await this.prisma.rehearsal.findMany({
      where: includeAll ? undefined : { date: { gte: startOfToday } },
      orderBy: { date: includeAll ? 'desc' : 'asc' },
      include: memberId
        ? {
            attendancePlans: {
              where: { memberId },
              select: { response: true },
            },
            attendanceRecords: {
              where: { memberId },
              select: { id: true },
            },
            _count: {
              select: { attendanceRecords: true },
            },
          }
        : undefined,
    });
    return rehearsals.map((r) => {
      const anyRecorded = memberId ? (r as any)._count.attendanceRecords > 0 : false;
      return {
        id: r.id,
        date: r.date,
        title: r.title,
        description: r.description,
        myPlan: memberId
          ? ((r as any).attendancePlans[0]?.response ?? null)
          : undefined,
        myAttended: memberId
          ? (anyRecorded ? (r as any).attendanceRecords.length > 0 : null)
          : undefined,
      };
    });
  }

  async findAll() {
    return this.prisma.rehearsal.findMany({
      orderBy: { date: 'desc' },
    });
  }

  async create(dto: CreateRehearsalDto) {
    return this.prisma.rehearsal.create({
      data: {
        date: new Date(dto.date),
        title: dto.title,
        description: dto.description,
      },
    });
  }

  async update(id: string, dto: UpdateRehearsalDto) {
    await this.ensureExists(id);
    return this.prisma.rehearsal.update({
      where: { id },
      data: {
        ...(dto.date && { date: new Date(dto.date) }),
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.rehearsal.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const rehearsal = await this.prisma.rehearsal.findUnique({ where: { id } });
    if (!rehearsal) throw new NotFoundException('Probe nicht gefunden');
    return rehearsal;
  }
}
