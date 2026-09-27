import { ForbiddenException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { mockDeep, DeepMockProxy } from "jest-mock-extended";
import { PrismaClient } from "../generated/prisma/client";
import { AdminService } from "../admin/admin.service";
import { CheckinService } from "../checkin/checkin.service";
import { PrismaService } from "../prisma/prisma.service";
import { AttendanceService } from "./attendance.service";
import { VoiceAdminService } from "./voice-admin.service";

describe("VoiceAdminService", () => {
  let service: VoiceAdminService;
  let prismaMock: DeepMockProxy<PrismaClient>;
  let attendanceService: jest.Mocked<
    Pick<
      AttendanceService,
      "getVoiceAdminRecordsForRehearsal" | "setAttendanceRecord"
    >
  >;
  let adminService: jest.Mocked<
    Pick<AdminService, "getMemberRehearsals" | "adminSetMemberAttendancePlan">
  >;
  let checkinService: jest.Mocked<Pick<CheckinService, "getPublicKeyBase64">>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();
    attendanceService = {
      getVoiceAdminRecordsForRehearsal: jest.fn().mockResolvedValue([]),
      setAttendanceRecord: jest
        .fn()
        .mockResolvedValue({
          rehearsalId: "r1",
          memberId: "target",
          attended: true,
        }),
    };
    adminService = {
      getMemberRehearsals: jest.fn().mockResolvedValue([]),
      adminSetMemberAttendancePlan: jest
        .fn()
        .mockResolvedValue({ plan: "CONFIRMED" }),
    };
    checkinService = {
      getPublicKeyBase64: jest.fn().mockReturnValue("public-key"),
    };

    const module = await Test.createTestingModule({
      providers: [
        VoiceAdminService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AttendanceService, useValue: attendanceService },
        { provide: AdminService, useValue: adminService },
        { provide: CheckinService, useValue: checkinService },
      ],
    }).compile();
    service = module.get(VoiceAdminService);
  });

  it("uses every current grant for records and drops revoked grants on next request", async () => {
    prismaMock.voiceAdminGrant.findMany
      .mockResolvedValueOnce([
        { memberId: "admin-member", choirVoiceId: "voice-a" },
        { memberId: "admin-member", choirVoiceId: "voice-b" },
      ])
      .mockResolvedValueOnce([
        { memberId: "admin-member", choirVoiceId: "voice-b" },
      ]);
    prismaMock.member.findUnique.mockResolvedValue({
      id: "target",
      firstName: "Target",
      lastName: "Member",
      email: "target@example.test",
      choirVoiceId: "voice-a",
      lastLoginAt: null,
      isDisabled: false,
      disabledAt: null,
      disableReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.getRecords("admin-member", "rehearsal-1");
    expect(
      attendanceService.getVoiceAdminRecordsForRehearsal,
    ).toHaveBeenCalledWith("rehearsal-1", ["voice-a", "voice-b"]);

    await expect(
      service.setRecord("admin-member", "rehearsal-1", "target", true),
    ).rejects.toThrow(ForbiddenException);
    expect(attendanceService.setAttendanceRecord).not.toHaveBeenCalled();
  });

  it("allows target with any currently granted voice and reuses attendance writes", async () => {
    prismaMock.voiceAdminGrant.findMany.mockResolvedValue([
      { memberId: "admin-member", choirVoiceId: "voice-a" },
      { memberId: "admin-member", choirVoiceId: "voice-b" },
    ]);
    prismaMock.member.findUnique.mockResolvedValue({
      id: "target",
      firstName: "Target",
      lastName: "Member",
      email: "target@example.test",
      choirVoiceId: "voice-b",
      lastLoginAt: null,
      isDisabled: false,
      disabledAt: null,
      disableReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.setRecord("admin-member", "rehearsal-1", "target", true);

    expect(attendanceService.setAttendanceRecord).toHaveBeenCalledWith(
      "rehearsal-1",
      "target",
      true,
    );
  });

  it("rejects members without a voice and voices outside current grants", async () => {
    prismaMock.voiceAdminGrant.findMany.mockResolvedValue([
      { memberId: "admin-member", choirVoiceId: "voice-a" },
    ]);
    prismaMock.member.findUnique
      .mockResolvedValueOnce({
        id: "target",
        firstName: "Target",
        lastName: "Member",
        email: "target@example.test",
        choirVoiceId: null,
        lastLoginAt: null,
        isDisabled: false,
        disabledAt: null,
        disableReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: "target",
        firstName: "Target",
        lastName: "Member",
        email: "target@example.test",
        choirVoiceId: "voice-b",
        lastLoginAt: null,
        isDisabled: false,
        disabledAt: null,
        disableReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    await expect(
      service.getMemberRehearsals("admin-member", "target"),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.getMemberRehearsals("admin-member", "target"),
    ).rejects.toThrow(ForbiddenException);
    expect(adminService.getMemberRehearsals).not.toHaveBeenCalled();
  });

  it("denies ordinary members access to the public check-in key", async () => {
    prismaMock.voiceAdminGrant.findMany.mockResolvedValue([]);
    await expect(
      service.getCheckinPublicKey("ordinary-member"),
    ).rejects.toThrow(ForbiddenException);
    expect(checkinService.getPublicKeyBase64).not.toHaveBeenCalled();
  });

  it("returns public key only after confirming at least one grant", async () => {
    prismaMock.voiceAdminGrant.findMany.mockResolvedValue([
      { memberId: "admin-member", choirVoiceId: "voice-a" },
    ]);
    await expect(service.getCheckinPublicKey("admin-member")).resolves.toEqual({
      publicKey: "public-key",
    });
    expect(checkinService.getPublicKeyBase64).toHaveBeenCalledTimes(1);
  });
});
