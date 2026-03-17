import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChoirVoiceDto, UpdateChoirVoiceDto } from './dto/choir-voice.dto';

@Injectable()
export class ChoirVoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const voices = await this.prisma.choirVoice.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { members: true } } },
    });
    return voices.map(({ _count, ...voice }) => ({ ...voice, memberCount: _count.members }));
  }

  async create(dto: CreateChoirVoiceDto) {
    const sortOrder = dto.sortOrder ?? (await this.nextSortOrder());
    return this.prisma.choirVoice.create({
      data: { name: dto.name, sortOrder },
    });
  }

  async update(id: string, dto: UpdateChoirVoiceDto) {
    await this.ensureExists(id);
    return this.prisma.choirVoice.update({
      where: { id },
      data: { ...(dto.name !== undefined && { name: dto.name }), ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }) },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    const memberCount = await this.prisma.member.count({ where: { choirVoiceId: id } });
    if (memberCount > 0) {
      throw new BadRequestException(
        `Diese Stimmlage kann nicht gelöscht werden, da ihr ${memberCount} Mitglied(er) zugeordnet sind.`,
      );
    }
    await this.prisma.choirVoice.delete({ where: { id } });
    return { deleted: true };
  }

  private async ensureExists(id: string) {
    const voice = await this.prisma.choirVoice.findUnique({ where: { id } });
    if (!voice) throw new NotFoundException('Stimmlage nicht gefunden');
    return voice;
  }

  private async nextSortOrder() {
    const last = await this.prisma.choirVoice.findFirst({ orderBy: { sortOrder: 'desc' } });
    return (last?.sortOrder ?? 0) + 1;
  }
}
