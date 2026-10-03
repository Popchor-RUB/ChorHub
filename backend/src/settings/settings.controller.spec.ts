import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { MemberTokenGuard } from '../auth/guards/member-token.guard';
import { OrGuard } from '../auth/guards/or.guard';
import { JwtAdminStrategy } from '../auth/strategies/jwt-admin.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

describe('SettingsController HTTP access', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  const memberToken = 'settings-member-token';
  const jwtService = new JwtService({ secret: 'settings-http-test-secret' });
  const prisma = {
    adminUser: { findUnique: jest.fn() },
    memberLoginToken: { findUnique: jest.fn() },
    member: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const settingsService = {
    list: jest.fn().mockResolvedValue({ settings: [{ key: 'cloud.url', value: 'https://cloud.test' }] }),
    get: jest.fn((key: string) => Promise.resolve({ key, value: null as string | null })),
    set: jest.fn((key: string, value: string) => Promise.resolve({ key, value })),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        { provide: SettingsService, useValue: settingsService },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => 'settings-http-test-secret' } },
        JwtAdminStrategy,
        JwtAdminGuard,
        MemberTokenGuard,
        OrGuard,
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    adminToken = jwtService.sign({ sub: 'admin-1', username: 'admin', role: 'admin' });
  });

  afterAll(async () => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.adminUser.findUnique.mockResolvedValue({ id: 'admin-1', username: 'admin' });
    prisma.memberLoginToken.findUnique.mockImplementation(({ where }: { where: { hashedToken: string } }) => {
      if (where.hashedToken !== createHash('sha256').update(memberToken).digest('hex')) return Promise.resolve(null);
      return Promise.resolve({
        id: 'token-1',
        memberId: 'member-1',
        hashedToken: where.hashedToken,
        createdAt: new Date(),
        member: {
          id: 'member-1',
          firstName: 'Test',
          lastName: 'Member',
          email: 'member@example.test',
          choirVoiceId: null,
          lastLoginAt: new Date(),
          isDisabled: false,
          disabledAt: null,
          disableReason: null,
          internalComment: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    });
  });

  it('allows only admins to list settings', async () => {
    await request(app.getHttpServer()).get('/settings').expect(401);
    await request(app.getHttpServer()).get('/settings').set('X-Member-Token', memberToken).expect(401);
    await request(app.getHttpServer()).get('/settings').set('Authorization', `Bearer ${adminToken}`)
      .expect(200, { settings: [{ key: 'cloud.url', value: 'https://cloud.test' }] });
  });

  it('allows admins and members to read cloud.url, including a missing value', async () => {
    await request(app.getHttpServer()).get('/settings/cloud.url').set('X-Member-Token', memberToken)
      .expect(200, { key: 'cloud.url', value: null });
    await request(app.getHttpServer()).get('/settings/cloud.url').set('Authorization', `Bearer ${adminToken}`)
      .expect(200, { key: 'cloud.url', value: null });
  });

  it('forbids members from reading other keys before looking up whether they exist', async () => {
    await request(app.getHttpServer()).get('/settings/private.flag').set('X-Member-Token', memberToken).expect(403);
    expect(settingsService.get).not.toHaveBeenCalled();
  });

  it('validates keys and requires a string value for writes', async () => {
    await request(app.getHttpServer()).get('/settings/bad%2Fkey').set('Authorization', `Bearer ${adminToken}`).expect(400);
    await request(app.getHttpServer()).put('/settings/some.key').set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 42 }).expect(400);
    expect(settingsService.set).not.toHaveBeenCalled();
  });

  it('restricts writes and deletes to admins; delete is repeatable', async () => {
    await request(app.getHttpServer()).put('/settings/feature.flag').set('X-Member-Token', memberToken)
      .send({ value: 'on' }).expect(401);
    await request(app.getHttpServer()).put('/settings/feature.flag').set('Authorization', `Bearer ${adminToken}`)
      .send({ value: '' }).expect(200, { key: 'feature.flag', value: '' });
    await request(app.getHttpServer()).delete('/settings/feature.flag').set('Authorization', `Bearer ${adminToken}`).expect(204);
    await request(app.getHttpServer()).delete('/settings/feature.flag').set('Authorization', `Bearer ${adminToken}`).expect(204);
    expect(settingsService.delete).toHaveBeenCalledTimes(2);
  });
});
