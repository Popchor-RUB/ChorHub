import { Test } from "@nestjs/testing";
import { mockDeep, DeepMockProxy } from "jest-mock-extended";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MembersService } from "./members.service";

describe("MembersService", () => {
  let service: MembersService;
  let prismaMock: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();
    const module = await Test.createTestingModule({
      providers: [
        MembersService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(MembersService);
  });

  it("returns assigned voice admin voices in member profile response", async () => {
    const memberWithGrants = {
      id: "member-1",
      firstName: "Anna",
      lastName: "Müller",
      email: "anna@example.test",
      choirVoice: { id: "voice-a", name: "Sopran", sortOrder: 1 },
      choirVoiceId: "voice-a",
      lastLoginAt: null,
      isDisabled: false,
      disabledAt: null,
      disableReason: null,
      internalComment: null,
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      voiceAdminGrants: [
        { choirVoice: { id: "voice-a", name: "Sopran" } },
        { choirVoice: { id: "voice-b", name: "Alt" } },
      ],
      createdAt: new Date("2026-01-01T00:00:00Z"),
    };
    prismaMock.member.findUnique.mockResolvedValue(memberWithGrants);

    await expect(service.findById("member-1")).resolves.toMatchObject({
      id: "member-1",
      voiceAdminVoices: [
        { id: "voice-a", name: "Sopran" },
        { id: "voice-b", name: "Alt" },
      ],
    });
  });
});
