import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mockDeep } from 'jest-mock-extended';
import { ConfigService } from '@nestjs/config';
import { loadMailTemplateDefaults } from './load-mail-template-defaults';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MAIL_TEMPLATE_DEFINITIONS } from './mail-template.catalog';
import { MailTemplateService } from './mail-template.service';
import { createMailTemplatePreviewContext } from './mail-template-preview';

describe('MailTemplateService', () => {
  const prisma = mockDeep<PrismaService>();
  const config = new ConfigService({ APP_URL: 'https://chorhub.test' });
  const service = new MailTemplateService(prisma, config);

  function row(key: string, subjectTemplate: string, htmlTemplate: string) {
    return {
      key,
      subjectTemplate,
      htmlTemplate,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    } as Prisma.MailTemplateGetPayload<object>;
  }

  beforeEach(() => jest.clearAllMocks());

  it('imports packaged defaults with conflict-safe inserts', async () => {
    prisma.mailTemplate.createMany.mockResolvedValue({ count: 6 });

    await service.onModuleInit();

    expect(prisma.mailTemplate.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ key: 'magic-link', subjectTemplate: 'Dein ChorHub Anmeldelink' }),
        expect.objectContaining({ key: 'personal-info', subjectTemplate: '{{subject}}' }),
      ]),
      skipDuplicates: true,
    });
    expect(prisma.mailTemplate.createMany.mock.calls[0]?.[0]?.data).toHaveLength(6);
  });

  it('propagates startup import failure', async () => {
    const databaseError = new Error('database unavailable');
    prisma.mailTemplate.createMany.mockRejectedValue(databaseError);

    await expect(service.onModuleInit()).rejects.toBe(databaseError);
  });

  it('renders all packaged defaults across their synthetic scenarios', async () => {
    const defaults = await loadMailTemplateDefaults();
    for (const definition of MAIL_TEMPLATE_DEFINITIONS) {
      const htmlTemplate = defaults.find(({ key }) => key === definition.key)!.htmlTemplate;
      for (const scenario of definition.previewScenarios) {
        const result = service.preview(definition.key, {
          subjectTemplate: definition.subjectTemplate,
          htmlTemplate,
        }, scenario.id);
        expect(result.subject).toBeTruthy();
        expect(result.html).toContain('ChorHub öffnen');
        expect(result.html).toContain('https://chorhub.example');
        expect(htmlTemplate).not.toContain('{{>');
        prisma.mailTemplate.findUnique.mockResolvedValue(row(definition.key, definition.subjectTemplate, htmlTemplate));
        const delivered = await service.render(definition.key, createMailTemplatePreviewContext(definition.key, scenario.id));
        expect(delivered.html).toContain('https://chorhub.test');
      }
    }
  });

  it('loads database version on each send render and escapes HTML placeholders', async () => {
    prisma.mailTemplate.findUnique
      .mockResolvedValueOnce(row('magic-link', 'First {{firstName}}', '<p>{{firstName}} {{magicUrl}}</p>'))
      .mockResolvedValueOnce(row('magic-link', 'Changed {{firstName}}', '<p>{{firstName}} {{magicUrl}}</p>'));
    const context = { firstName: 'A & B', magicUrl: 'https://example.test/?a=1&b=2', rawToken: 't', loginCode: '123456' };

    const first = await service.render('magic-link', context);
    const second = await service.render('magic-link', context);

    expect(first.subject).toBe('First A & B');
    expect(first.html).toContain('A &amp; B https://example.test/?a=1&amp;b=2');
    expect(second.subject).toBe('Changed A & B');
    expect(prisma.mailTemplate.findUnique).toHaveBeenCalledTimes(2);
  });

  it('fails when template row is missing or the database read fails', async () => {
    prisma.mailTemplate.findUnique.mockResolvedValueOnce(null);
    await expect(service.render('magic-link', {})).rejects.toBeInstanceOf(NotFoundException);

    const databaseError = new Error('database read failed');
    prisma.mailTemplate.findUnique.mockRejectedValueOnce(databaseError);
    await expect(service.render('magic-link', {})).rejects.toBe(databaseError);
  });

  it('rejects unsupported helpers, invalid loop scope, and unsafe subjects', () => {
    expect(() => service.preview('magic-link', {
      subjectTemplate: '{{lookup this "firstName"}}', htmlTemplate: '<p>{{firstName}}</p>',
    })).toThrow(/Unsupported/);
    expect(() => service.preview('push-fallback-reminder', {
      subjectTemplate: '{{subject}}', htmlTemplate: '{{#each items}}{{firstName}}{{/each}}',
    })).toThrow(/Unsupported placeholder in items/);
    expect(() => service.preview('magic-link', {
      subjectTemplate: 'Hi\r\nBcc: someone@example.org', htmlTemplate: '<p>{{firstName}}</p>',
    })).toThrow(BadRequestException);
    expect(() => service.preview('magic-link', {
      subjectTemplate: 'Subject', htmlTemplate: '   ',
    })).toThrow(BadRequestException);
    expect(() => service.preview('magic-link', {
      subjectTemplate: 'Subject', htmlTemplate: '{{#if firstName}}{{unsupported}}{{/if}}',
    })).toThrow(/Unsupported placeholder: unsupported/);
    expect(() => service.preview('magic-link', {
      subjectTemplate: 'Subject', htmlTemplate: '{{#if firstName}}',
    })).toThrow(/HTML template:/);
  });

  it('accepts supported nested placeholders and previews synthetic reminder branches', () => {
    const templates = {
      subjectTemplate: '{{subject}}',
      htmlTemplate: '<p>{{#each items}}{{label}} {{this.label}} {{@index}} {{../firstName}}{{/each}}</p>{{#if question}}<b>{{question}}</b>{{else}}<i>No question</i>{{/if}}',
    };

    const actions = service.preview('push-fallback-reminder', templates, 'with-actions');
    const generic = service.preview('push-fallback-reminder', templates, 'generic-login');

    expect(actions.subject).toBe('ChorHub Erinnerung: Anwesenheit eintragen');
    expect(actions.html).toContain('Chorprobe am Dienstag');
    expect(generic.html).toContain('<i>No question</i>');
    expect(prisma.mailTemplate.upsert).not.toHaveBeenCalled();
    expect(prisma.mailTemplate.createMany).not.toHaveBeenCalled();
    expect(prisma.mailTemplate.findUnique).not.toHaveBeenCalled();
  });

  it('validates every synthetic scenario before updating stored content', async () => {
    const updated = row('push-fallback-reminder', '{{subject}}', '<p>{{#if showGenericLogin}}{{magicUrl}}{{else}}No link{{/if}}</p>');
    prisma.mailTemplate.upsert.mockResolvedValue(updated);

    const result = await service.update('push-fallback-reminder', {
      subjectTemplate: '{{subject}}',
      htmlTemplate: '<p>{{#if showGenericLogin}}{{magicUrl}}{{else}}No link{{/if}}</p>',
    });

    expect(result.key).toBe('push-fallback-reminder');
    expect(prisma.mailTemplate.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: 'push-fallback-reminder' },
      update: expect.objectContaining({ htmlTemplate: expect.stringContaining('showGenericLogin') }),
    }));
  });
});
