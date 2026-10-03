import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { validateSettingValue } from './setting-value-validator';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const settings = await this.prisma.settings.findMany({
      orderBy: { key: 'asc' },
    });
    return { settings: settings.map(({ key, value }) => ({ key, value })) };
  }

  async get(key: string): Promise<{ key: string; value: string | null }> {
    const setting = await this.prisma.settings.findUnique({ where: { key } });
    return { key, value: setting?.value ?? null };
  }

  async set(key: string, value: string): Promise<{ key: string; value: string }> {
    const validatedValue = validateSettingValue(key, value);
    const setting = await this.prisma.settings.upsert({
      where: { key },
      create: { key, value: validatedValue },
      update: { value: validatedValue },
    });
    return { key: setting.key, value: setting.value };
  }

  async delete(key: string): Promise<void> {
    await this.prisma.settings.deleteMany({ where: { key } });
  }
}
