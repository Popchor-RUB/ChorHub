import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        choirVoice: { select: { id: true, name: true, sortOrder: true } },
        createdAt: true,
      },
    });
    if (!member) throw new NotFoundException('Mitglied nicht gefunden');
    return member;
  }

  async updateVoice(memberId: string, voiceId: string | null) {
    if (voiceId !== null) {
      const voice = await this.prisma.choirVoice.findUnique({ where: { id: voiceId } });
      if (!voice) throw new NotFoundException('Stimmlage nicht gefunden');
    }
    return this.prisma.member.update({
      where: { id: memberId },
      data: { choirVoiceId: voiceId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        choirVoice: { select: { id: true, name: true, sortOrder: true } },
        createdAt: true,
      },
    });
  }
}
