import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateGeneralInfoDto } from './dto/update-general-info.dto';

const SINGLETON_ID = 'main';

@Injectable()
export class GeneralInfoService {
  constructor(private readonly prisma: PrismaService) {}

  async getInfo() {
    return this.prisma.generalInfo.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, markdownContent: '' },
      update: {},
    });
  }

  async updateInfo(dto: UpdateGeneralInfoDto) {
    return this.prisma.generalInfo.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, markdownContent: dto.markdownContent },
      update: { markdownContent: dto.markdownContent },
    });
  }
}
