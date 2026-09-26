import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { createHash } from "node:crypto";
import request from "supertest";
import { App } from "supertest/types";
import { PrismaService } from "../prisma/prisma.service";
import { MemberTokenGuard } from "../auth/guards/member-token.guard";
import { JwtAdminGuard } from "../auth/guards/jwt-admin.guard";
import { JwtAdminStrategy } from "../auth/strategies/jwt-admin.strategy";
import { AdminService } from "../admin/admin.service";
import { AdminController } from "../admin/admin.controller";
import { CheckinService } from "../checkin/checkin.service";
import { AttendanceService } from "./attendance.service";
import { AttendanceController } from "./attendance.controller";
import { VoiceAdminController } from "./voice-admin.controller";
import { VoiceAdminService } from "./voice-admin.service";

describe("VoiceAdminController HTTP security", () => {
  let app: INestApplication<App>;
  const prisma = {
    memberLoginToken: { findUnique: jest.fn() },
    member: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    voiceAdminGrant: { findMany: jest.fn().mockResolvedValue([]) },
    adminUser: { findUnique: jest.fn() },
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        VoiceAdminController,
        AdminController,
        AttendanceController,
      ],
      providers: [
        MemberTokenGuard,
        JwtAdminGuard,
        JwtAdminStrategy,
        VoiceAdminService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: () => "test-secret-for-http-tests" },
        },
        {
          provide: AttendanceService,
          useValue: { getPublicKeyBase64: () => "public-key" },
        },
        {
          provide: CheckinService,
          useValue: { getPublicKeyBase64: () => "public-key" },
        },
        {
          provide: AdminService,
          useValue: {
            getMemberById: jest.fn(),
            replaceVoiceAdminVoices: jest.fn(),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => app.close());

  it("rejects anonymous and ordinary member requests on scoped routes", async () => {
    const rawToken = "voice-admin-http-token";
    prisma.memberLoginToken.findUnique.mockResolvedValue({
      id: "token-1",
      memberId: "ordinary-member",
      hashedToken: createHash("sha256").update(rawToken).digest("hex"),
      createdAt: new Date(),
      member: {
        id: "ordinary-member",
        firstName: "Normal",
        lastName: "Member",
        email: "private@example.test",
        lastLoginAt: new Date(),
      },
    });

    const scopedRequests = [
      { method: "get", path: "/attendance/voice-admin/checkin/public-key" },
      { method: "get", path: "/attendance/voice-admin/records/rehearsal-1" },
      {
        method: "put",
        path: "/attendance/voice-admin/records/rehearsal-1",
        body: { memberId: "target-member", attended: true },
      },
      {
        method: "get",
        path: "/attendance/voice-admin/members/target-member/rehearsals",
      },
      {
        method: "put",
        path: "/attendance/voice-admin/members/target-member/attendance-plans/rehearsal-1",
        body: { response: "CONFIRMED" },
      },
    ] as const;

    for (const route of scopedRequests) {
      const anonymousRequest =
        route.method === "get"
          ? request(app.getHttpServer()).get(route.path)
          : request(app.getHttpServer()).put(route.path).send(route.body);
      await anonymousRequest.expect(401);

      const memberRequest =
        route.method === "get"
          ? request(app.getHttpServer()).get(route.path)
          : request(app.getHttpServer()).put(route.path).send(route.body);
      await memberRequest.set("X-Member-Token", rawToken).expect(403);
    }
  });

  it("rejects anonymous and member-token requests on admin detail and grant-write routes", async () => {
    const rawToken = "voice-admin-http-token";
    prisma.memberLoginToken.findUnique.mockResolvedValue({
      id: "token-1",
      memberId: "ordinary-member",
      hashedToken: createHash("sha256").update(rawToken).digest("hex"),
      createdAt: new Date(),
      member: {
        id: "ordinary-member",
        firstName: "Normal",
        lastName: "Member",
        email: "private@example.test",
        lastLoginAt: new Date(),
      },
    });

    const protectedRequests = [
      { method: "get", path: "/admin/members/target-member" },
      {
        method: "put",
        path: "/admin/members/target-member/voice-admin-voices",
        body: { voiceIds: [] },
      },
    ] as const;

    for (const route of protectedRequests) {
      const anonymousRequest =
        route.method === "get"
          ? request(app.getHttpServer()).get(route.path)
          : request(app.getHttpServer()).put(route.path).send(route.body);
      await anonymousRequest.expect(401);

      const memberRequest =
        route.method === "get"
          ? request(app.getHttpServer()).get(route.path)
          : request(app.getHttpServer()).put(route.path).send(route.body);
      await memberRequest.set("X-Member-Token", rawToken).expect(401);
    }
  });
});
