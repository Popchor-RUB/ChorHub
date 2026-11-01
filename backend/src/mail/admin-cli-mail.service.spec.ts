import { createHash } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { mockDeep } from "jest-mock-extended";
import { PrismaService } from "../prisma/prisma.service";
import { AdminCliMailService } from "./admin-cli-mail.service";
import { MAIL_TEMPLATE_DEFINITIONS } from "./mail-template.catalog";
import { loadMailTemplateDefaults } from "./load-mail-template-defaults";

describe("AdminCliMailService", () => {
  const member = {
    id: "member-1",
    firstName: "Chris",
    lastName: "Test",
    email: "chris@example.org",
  };
  const config = new ConfigService({
    APP_URL: "https://chorhub.test/",
    CHOIR_ADMIN_EMAIL: "admin@chorhub.test",
  });
  let prisma: ReturnType<typeof mockDeep<PrismaService>>;
  let service: AdminCliMailService;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    service = new AdminCliMailService(prisma, config);
    const defaults = await loadMailTemplateDefaults();
    const template = defaults.find(({ key }) => key === "member-disabled")!;
    prisma.mailTemplate.findUnique.mockResolvedValue({
      ...template,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.mailTemplate.findMany.mockResolvedValue([]);
    prisma.mailTemplate.updateMany.mockResolvedValue({ count: 0 });
    prisma.member.updateMany.mockResolvedValue({ count: 1 });
    prisma.member.findMany.mockResolvedValue([]);
    jest
      .spyOn(prisma, "$transaction")
      .mockImplementation((callback) => callback(prisma));
  });

  it.each(
    MAIL_TEMPLATE_DEFINITIONS.flatMap(({ key, previewScenarios }) =>
      previewScenarios.map(({ id }) => [key, id]),
    ),
  )(
    "renders %s / %s using packaged defaults and expanded footer",
    async (key, scenario) => {
      const defaults = await loadMailTemplateDefaults();
      const template = defaults.find((definition) => definition.key === key)!;
      prisma.mailTemplate.findUnique.mockResolvedValue({
        ...template,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const mail = await service.build(key, member, scenario);
      expect(mail.subject).toBeTruthy();
      expect(mail.html).toContain("https://chorhub.test/");
      expect(mail.html).not.toContain("{{");
      if (key === "invite" || key === "magic-link") {
        expect(mail.html).toContain("https://chorhub.test/auth/verify?token=");
        expect(mail.html).not.toContain("preview-token");
        expect(prisma.memberLoginToken.create).toHaveBeenCalledTimes(1);
        expect(prisma.memberLoginCode.create).toHaveBeenCalledTimes(
          key === "magic-link" ? 1 : 0,
        );
      } else {
        expect(prisma.$transaction).not.toHaveBeenCalled();
      }
    },
  );

  it("renders saved customizations with member data and configured admin contact", async () => {
    prisma.mailTemplate.findUnique.mockResolvedValue({
      key: "member-disabled",
      subjectTemplate: "Custom {{firstName}}",
      htmlTemplate: "<p>{{firstName}} {{adminEmail}} {{appUrl}}</p>",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const mail = await service.build("member-disabled", member);
    expect(mail.subject).toBe("Custom Chris");
    expect(mail.html).toContain(
      "Chris admin@chorhub.test https://chorhub.test/",
    );
  });

  it("initializes defaults once for repeated sends", async () => {
    await service.build("member-disabled", member);
    await service.build("member-disabled", member);
    expect(prisma.mailTemplate.createMany).toHaveBeenCalledTimes(1);
  });

  it("rejects unknown templates and scenarios before database changes", async () => {
    await expect(service.build("../invite", member)).rejects.toThrow(
      "Unsupported template",
    );
    await expect(service.build("invite", member, "bad")).rejects.toThrow(
      "Unknown scenario",
    );
    expect(prisma.mailTemplate.createMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("blocks credentials for disabled members", async () => {
    prisma.member.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.build("magic-link", member)).rejects.toThrow(
      "disabled or missing",
    );
    expect(prisma.memberLoginToken.create).not.toHaveBeenCalled();
    expect(prisma.memberLoginCode.create).not.toHaveBeenCalled();
  });

  it.each(["personal-info", "push-fallback-reminder"])("blocks CLI %s mail to disabled members", async (key) => {
    const defaults = await loadMailTemplateDefaults();
    const template = defaults.find((definition) => definition.key === key)!;
    prisma.mailTemplate.findUnique.mockResolvedValue({
      ...template, createdAt: new Date(), updatedAt: new Date(),
    });
    prisma.member.findMany.mockResolvedValue([{
      ...member, choirVoiceId: null, lastLoginAt: null, isDisabled: true,
      disabledAt: new Date(), disableReason: null, internalComment: null,
      createdAt: new Date(), updatedAt: new Date(),
    }]);
    await expect(service.build(key, member)).rejects.toThrow("Disabled members cannot receive email");
  });

  it("stores hashed credentials with a fifteen-minute code expiry", async () => {
    const before = Date.now();
    const credentials = await service.createSessionCredentials(member.id, true);
    expect(credentials.loginCode).toMatch(/^\d{6}$/);
    expect(prisma.memberLoginToken.create).toHaveBeenCalledWith({
      data: {
        memberId: member.id,
        hashedToken: createHash("sha256")
          .update(credentials.rawToken)
          .digest("hex"),
      },
    });
    const code = prisma.memberLoginCode.create.mock.calls[0]?.[0]?.data;
    expect(code?.hashedCode).toBe(
      createHash("sha256").update(credentials.loginCode!).digest("hex"),
    );
    expect(code?.expiresAt).toBeInstanceOf(Date);
    expect(new Date(code.expiresAt).getTime()).toBeGreaterThanOrEqual(
      before + 15 * 60 * 1000,
    );
    expect(new Date(code.expiresAt).getTime()).toBeLessThanOrEqual(
      Date.now() + 15 * 60 * 1000,
    );
  });
});
