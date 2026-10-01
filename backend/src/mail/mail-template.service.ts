import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { inline } from '@css-inline/css-inline';
import Handlebars from 'handlebars';
import { ConfigService } from '@nestjs/config';
import { loadMailTemplateDefaults } from './load-mail-template-defaults';
import { PrismaService } from '../prisma/prisma.service';
import { MAIL_TEMPLATE_BY_KEY, MAIL_TEMPLATE_DEFINITIONS } from './mail-template.catalog';
import type {
  MailTemplateDetail,
  MailTemplateKey,
  MailTemplatePreviewResponse,
  MailTemplatePreviewScenario,
} from './mail-template.types';
import type { UpdateMailTemplateDto } from './update-mail-template.dto';
import { createMailTemplatePreviewContext } from './mail-template-preview';

const TEMPLATE_KEYS = MAIL_TEMPLATE_DEFINITIONS.map(({ key }) => key);
type AstStatement = ReturnType<typeof Handlebars.parse>['body'][number];

type AstPathExpression = {
  type: 'PathExpression';
  original: string;
};

type AstMustacheStatement = AstStatement & {
  type: 'MustacheStatement';
  path: AstPathExpression | { type: string };
  params: unknown[];
  hash: { pairs: unknown[] };
};

type AstBlockStatement = AstStatement & {
  type: 'BlockStatement';
  path: AstPathExpression;
  params: Array<AstPathExpression | { type: string }>;
  hash: { pairs: unknown[] };
  program: ReturnType<typeof Handlebars.parse>;
  inverse: ReturnType<typeof Handlebars.parse>;
};

export type MailRenderResult = MailTemplatePreviewResponse;

@Injectable()
export class MailTemplateService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const defaults = await loadMailTemplateDefaults();
    await this.prisma.mailTemplate.createMany({ data: defaults, skipDuplicates: true });
  }

  async list(): Promise<{ templates: MailTemplateDetail[] }> {
    const rows = await this.prisma.mailTemplate.findMany({ orderBy: { key: 'asc' } });
    return {
      templates: rows.map((row) => {
        const definition = MAIL_TEMPLATE_BY_KEY.get(row.key as MailTemplateKey);
        if (!definition) {
          throw new InternalServerErrorException(`Unknown mail template key: ${row.key}`);
        }
        return {
          ...definition,
          subjectTemplate: row.subjectTemplate,
          htmlTemplate: row.htmlTemplate,
          updatedAt: row.updatedAt,
          placeholders: definition.placeholders.some(({ name }) => name === 'subject')
            ? definition.placeholders
            : [
                ...definition.placeholders,
                {
                  name: 'subject',
                  description: { de: 'Gerenderter Betreff der Nachricht.', en: 'Rendered message subject.' },
                  example: 'Deine ChorHub Nachricht',
                  syntax: '{{subject}}',
                },
              ],
        };
      }),
    };
  }

  async update(key: string, dto: UpdateMailTemplateDto): Promise<MailTemplateDetail> {
    const definition = this.getDefinition(key);
    this.validateTemplates(definition.key, dto);
    for (const scenario of definition.previewScenarios) {
      this.renderTemplates(
        definition.key,
        dto,
        createMailTemplatePreviewContext(definition.key, scenario.id),
      );
    }
    const row = await this.prisma.mailTemplate.upsert({
      where: { key: definition.key },
      create: { key: definition.key, ...dto },
      update: dto,
    });
    return {
      ...definition,
      subjectTemplate: row.subjectTemplate,
      htmlTemplate: row.htmlTemplate,
      updatedAt: row.updatedAt,
    };
  }

  preview(key: string, dto: UpdateMailTemplateDto, scenarioId?: string): MailRenderResult {
    const definition = this.getDefinition(key);
    this.validateTemplates(definition.key, dto);
    const scenario = this.getScenario(definition.previewScenarios, scenarioId);
    return this.renderTemplates(definition.key, dto, createMailTemplatePreviewContext(definition.key, scenario.id));
  }

  async render(key: MailTemplateKey, context: Record<string, unknown>): Promise<MailRenderResult> {
    const row = await this.prisma.mailTemplate.findUnique({ where: { key } });
    if (!row) {
      throw new NotFoundException(`Mail template '${key}' is not configured`);
    }
    return this.renderTemplates(key, row, {
      ...context,
      appUrl: this.config.getOrThrow<string>('APP_URL'),
    });
  }

  private renderTemplates(
    key: MailTemplateKey,
    templates: UpdateMailTemplateDto,
    context: Record<string, unknown>,
  ): MailRenderResult {
    this.validateTemplates(key, templates);
    context = { appUrl: 'https://chorhub.example', ...context };
    const subject = Handlebars.compile(templates.subjectTemplate, { strict: true, noEscape: true })(context).trim();
    if (!subject || /[\r\n]/.test(subject)) {
      throw new BadRequestException('Rendered email subject must be non-empty and contain no line breaks');
    }
    const html = Handlebars.compile(templates.htmlTemplate, { strict: true })({ ...context, subject });
    return { subject, html: inline(html, { loadRemoteStylesheets: false }) };
  }

  private validateTemplates(key: MailTemplateKey, templates: UpdateMailTemplateDto): void {
    if (!templates || typeof templates.subjectTemplate !== 'string' || typeof templates.htmlTemplate !== 'string') {
      throw new BadRequestException('subjectTemplate and htmlTemplate must be strings');
    }
    if (!templates.subjectTemplate.trim() || /[\r\n]/.test(templates.subjectTemplate)) {
      throw new BadRequestException('Subject template must be non-empty and contain no line breaks');
    }
    if (!templates.htmlTemplate.trim()) {
      throw new BadRequestException('HTML template must not be empty');
    }

    const allowedPaths = new Set(MAIL_TEMPLATE_BY_KEY.get(key)?.placeholders.map(({ name }) => name) ?? []);
    for (const [field, template] of [
      ['Subject template', templates.subjectTemplate],
      ['HTML template', templates.htmlTemplate],
    ] as const) {
      try {
        const ast = Handlebars.parse(template);
        this.validateProgram(ast, key, allowedPaths, false, field === 'HTML template');
        Handlebars.precompile(template, { strict: true });
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw new BadRequestException(`${field}: ${error.message}`);
        }
        const message = error instanceof Error ? error.message : 'Invalid Handlebars template';
        throw new BadRequestException(`${field}: ${message}`);
      }
    }
  }

  private validateProgram(
    program: ReturnType<typeof Handlebars.parse> | null | undefined,
    key: MailTemplateKey,
    allowedPaths: Set<string>,
    inItems: boolean,
    allowRenderedSubject: boolean,
  ): void {
    if (!program) return;
    for (const statement of program.body) {
      if (statement.type === 'CommentStatement' || statement.type === 'ContentStatement') {
        continue;
      }
      if (statement.type === 'MustacheStatement') {
        const mustache = statement as AstMustacheStatement;
        if (mustache.params.length > 0 || (mustache.hash?.pairs.length ?? 0) > 0 || mustache.path.type !== 'PathExpression') {
          throw new BadRequestException('Unsupported Handlebars helper or placeholder arguments');
        }
        this.validatePath((mustache.path as AstPathExpression).original, key, allowedPaths, inItems, allowRenderedSubject);
        continue;
      }
      if (statement.type === 'BlockStatement') {
        const block = statement as AstBlockStatement;
        const helper = block.path.original;
        if (helper !== 'if' && helper !== 'each') {
          throw new BadRequestException(`Unsupported Handlebars helper: ${helper}`);
        }
        if (block.params.length !== 1 || (block.hash?.pairs.length ?? 0) > 0 || block.params[0]?.type !== 'PathExpression') {
          throw new BadRequestException(`Unsupported ${helper} expression`);
        }
        const blockPath = (block.params[0] as AstPathExpression).original;
        if (helper === 'each') {
          if (key !== 'push-fallback-reminder' || blockPath !== 'items' || inItems) {
            throw new BadRequestException('Only {{#each items}} is supported, outside another loop');
          }
          this.validateProgram(block.program, key, allowedPaths, true, allowRenderedSubject);
          this.validateProgram(block.inverse, key, allowedPaths, inItems, allowRenderedSubject);
        } else {
          this.validatePath(blockPath, key, allowedPaths, inItems, allowRenderedSubject);
          this.validateProgram(block.program, key, allowedPaths, inItems, allowRenderedSubject);
          this.validateProgram(block.inverse, key, allowedPaths, inItems, allowRenderedSubject);
        }
        continue;
      }
      throw new BadRequestException(`Unsupported Handlebars node: ${statement.type}`);
    }
  }

  private validatePath(
    path: string,
    key: MailTemplateKey,
    allowedPaths: Set<string>,
    inItems: boolean,
    allowRenderedSubject: boolean,
  ): void {
    const itemPaths = new Set(['label', 'confirmUrl', 'declineUrl']);
    if (inItems) {
      if (
        key === 'push-fallback-reminder' &&
        (itemPaths.has(path) || ['this.label', 'this.confirmUrl', 'this.declineUrl', '@index', '@first', '@last'].includes(path))
      ) return;
      if (path.startsWith('../') && !path.slice(3).includes('/') && allowedPaths.has(path.slice(3))) return;
      throw new BadRequestException(`Unsupported placeholder in items: ${path}`);
    }
    if (path === 'subject' && allowRenderedSubject) return;
    if (path.startsWith('../') || path.includes('/') || !allowedPaths.has(path)) {
      throw new BadRequestException(`Unsupported placeholder: ${path}`);
    }
  }

  private getDefinition(key: string) {
    const definition = MAIL_TEMPLATE_BY_KEY.get(key as MailTemplateKey);
    if (!definition || !TEMPLATE_KEYS.includes(definition.key)) {
      throw new NotFoundException(`Mail template '${key}' not found`);
    }
    return definition;
  }

  private getScenario(scenarios: MailTemplatePreviewScenario[], scenarioId?: string) {
    const scenario = scenarios.find((candidate) => candidate.id === (scenarioId ?? scenarios[0]?.id));
    if (!scenario) {
      throw new BadRequestException(`Unknown preview scenario: ${scenarioId ?? ''}`);
    }
    return scenario;
  }
}
