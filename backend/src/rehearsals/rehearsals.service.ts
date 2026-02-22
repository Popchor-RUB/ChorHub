import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRehearsalDto } from './dto/create-rehearsal.dto';
import { UpdateRehearsalDto } from './dto/update-rehearsal.dto';

@Injectable()
export class RehearsalsService {
  constructor(private readonly prisma: PrismaService) {}

  async findUpcoming(memberId?: string) {
    const rehearsals = await this.prisma.rehearsal.findMany({
      where: { date: { gte: new Date() } },
      orderBy: { date: 'asc' },
      include: memberId
        ? {
            attendancePlans: {
              where: { memberId },
              select: { response: true },
            },
          }
        : undefined,
    });
    return rehearsals.map((r) => ({
      id: r.id,
      date: r.date,
      title: r.title,
      description: r.description,
      myPlan: memberId
        ? ((r as any).attendancePlans[0]?.response ?? null)
        : undefined,
    }));
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
