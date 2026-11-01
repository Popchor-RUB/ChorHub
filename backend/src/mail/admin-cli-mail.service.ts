import { createHash, randomBytes, randomInt } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { MAIL_TEMPLATE_DEFINITIONS } from "./mail-template.catalog";
import { createMailTemplatePreviewContext } from "./mail-template-preview";
import { MailTemplateService } from "./mail-template.service";
import { filterActiveMailRecipients } from "./filter-active-mail-recipients";

interface MailMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

/** CLI sends use saved templates; non-auth templates use synthetic scenario data. */
export class AdminCliMailService {
  private readonly templates: MailTemplateService;
  private initialization?: Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.templates = new MailTemplateService(prisma, config);
  }

  validate(template: string, scenarioId?: string) {
    const definition = MAIL_TEMPLATE_DEFINITIONS.find(
      ({ key }) => key === template,
    );
    if (!definition) {
      throw new Error(
        `Unsupported template "${template}". Supported templates: ${MAIL_TEMPLATE_DEFINITIONS.map(
          ({ key }) => key,
        ).join(", ")}`,
      );
    }
    const scenario = definition.previewScenarios.find(
      ({ id }) => id === (scenarioId ?? definition.previewScenarios[0]?.id),
    );
    if (!scenario) {
      throw new Error(
        `Unknown scenario "${scenarioId}" for ${template}. Supported scenarios: ${definition.previewScenarios
          .map(({ id }) => id)
          .join(", ")}`,
      );
    }
    return { key: definition.key, scenarioId: scenario.id };
  }

  async build(template: string, member: MailMember, scenarioId?: string) {
    const selection = this.validate(template, scenarioId);
    this.initialization ??= this.templates.onModuleInit();
    await this.initialization;

    const context = createMailTemplatePreviewContext(
      selection.key,
      selection.scenarioId,
    );
    Object.assign(context, {
      firstName:
        selection.key === "personal-info" && selection.scenarioId === "bulk"
          ? ""
          : member.firstName,
      lastName: member.lastName,
      memberEmail: member.email,
      adminEmail:
        this.config.get<string>("CHOIR_ADMIN_EMAIL") ??
        "chor-admin@example.org",
    });

    if (selection.key === "invite" || selection.key === "magic-link") {
      const credentials = await this.createSessionCredentials(
        member.id,
        selection.key === "magic-link",
      );
      Object.assign(context, credentials, {
        magicUrl: `${this.config.getOrThrow<string>("APP_URL").replace(/\/+$/, "")}/auth/verify?token=${credentials.rawToken}`,
      });
    } else if (selection.key === "push-fallback-reminder") {
      context.magicUrl = `${this.config.getOrThrow<string>("APP_URL").replace(/\/+$/, "")}/login`;
    }

    const mail = await this.templates.render(selection.key, context);
    await filterActiveMailRecipients(this.prisma, selection.key, member.email);
    return mail;
  }

  async createSessionCredentials(memberId: string, includeCode = false) {
    const rawToken = randomBytes(32).toString("hex");
    const hashedToken = createHash("sha256").update(rawToken).digest("hex");
    const loginCode = includeCode
      ? randomInt(100000, 1000000).toString()
      : undefined;
    await this.prisma.$transaction(async (tx) => {
      const active = await tx.member.updateMany({
        where: { id: memberId, isDisabled: false },
        data: { updatedAt: new Date() },
      });
      if (active.count !== 1)
        throw new Error("Member account is disabled or missing");
      await tx.memberLoginToken.create({ data: { memberId, hashedToken } });
      if (loginCode) {
        await tx.memberLoginCode.deleteMany({
          where: { memberId, expiresAt: { lt: new Date() } },
        });
        await tx.memberLoginCode.create({
          data: {
            memberId,
            hashedCode: createHash("sha256").update(loginCode).digest("hex"),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          },
        });
      }
    });
    return { rawToken, loginCode };
  }
}
