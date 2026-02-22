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
        choirVoice: true,
        createdAt: true,
      },
    });
    if (!member) throw new NotFoundException('Mitglied nicht gefunden');
    return member;
  }
}
