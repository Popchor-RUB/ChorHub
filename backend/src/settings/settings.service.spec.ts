import { BadRequestException } from '@nestjs/common';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new SettingsService(prisma);
  });

  it('returns settings in key order and missing keys as null', async () => {
    prisma.settings.findMany.mockResolvedValue([
      { key: 'cloud.url', value: 'https://cloud.example.test', updatedAt: new Date() },
    ]);
    prisma.settings.findUnique.mockResolvedValue(null);

    await expect(service.list()).resolves.toEqual({
      settings: [{ key: 'cloud.url', value: 'https://cloud.example.test' }],
    });
    await expect(service.get('missing')).resolves.toEqual({ key: 'missing', value: null });
    expect(prisma.settings.findMany).toHaveBeenCalledWith({ orderBy: { key: 'asc' } });
  });

  it('upserts generic values unchanged, including empty strings', async () => {
    prisma.settings.upsert.mockResolvedValue({
      key: 'feature.flag',
      value: '',
      updatedAt: new Date(),
    });

    await expect(service.set('feature.flag', '')).resolves.toEqual({ key: 'feature.flag', value: '' });
    expect(prisma.settings.upsert).toHaveBeenCalledWith({
      where: { key: 'feature.flag' },
      create: { key: 'feature.flag', value: '' },
      update: { value: '' },
    });
  });

  it('trims valid cloud URLs before saving', async () => {
    prisma.settings.upsert.mockResolvedValue({
      key: 'cloud.url',
      value: 'https://cloud.example.test/path',
      updatedAt: new Date(),
    });

    await service.set('cloud.url', '  https://cloud.example.test/path  ');

    expect(prisma.settings.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { key: 'cloud.url', value: 'https://cloud.example.test/path' },
      update: { value: 'https://cloud.example.test/path' },
    }));
  });

  it.each([
    '',
    '   ',
    '/relative/path',
    'https:cloud.example.test',
    'https:/cloud.example.test',
    'https:\\cloud.example.test',
    'ftp://cloud.example.test',
    'https://user:secret@cloud.example.test',
  ])('rejects invalid cloud URL %j without writing', async (value) => {
    await expect(service.set('cloud.url', value)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.settings.upsert).not.toHaveBeenCalled();
  });

  it('deletes idempotently by key', async () => {
    prisma.settings.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.delete('missing')).resolves.toBeUndefined();
    expect(prisma.settings.deleteMany).toHaveBeenCalledWith({ where: { key: 'missing' } });
  });

  it.each(['constructor', 'toString', '__proto__'])('preserves generic value for key %s', async (key) => {
    prisma.settings.upsert.mockResolvedValue({ key, value: 'saved', updatedAt: new Date() });

    await expect(service.set(key, 'saved')).resolves.toEqual({ key, value: 'saved' });
    expect(prisma.settings.upsert).toHaveBeenCalled();
  });
});
