import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AdminController } from '../admin/admin.controller';
import { AdminService } from '../admin/admin.service';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { AdminEmailsController } from '../emails/admin-emails.controller';
import { EmailsService } from '../emails/emails.service';
import { AdminPersonalInfoController } from '../personal-info/admin-personal-info.controller';
import { PersonalInfoService } from '../personal-info/personal-info.service';

const routes = [
  { method: 'post', path: '/admin/emails', file: 'attachments', fields: 3 },
  {
    method: 'post',
    path: '/admin/emails/test',
    file: 'attachments',
    fields: 3,
  },
  { method: 'post', path: '/admin/members/import', file: 'file', fields: 1 },
  {
    method: 'patch',
    path: '/admin/personal-info/config',
    file: 'recipients',
    fields: 6,
  },
] as const;

describe('Multipart upload HTTP handling', () => {
  let app: INestApplication<Server>;
  const enqueueEmail = jest.fn().mockResolvedValue({ id: 'job' });
  const importMembersFromCsv = jest.fn().mockResolvedValue({ imported: 1 });
  const publish = jest.fn().mockResolvedValue({ published: true });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        AdminController,
        AdminEmailsController,
        AdminPersonalInfoController,
      ],
      providers: [
        { provide: AdminService, useValue: { importMembersFromCsv } },
        { provide: EmailsService, useValue: { enqueueEmail } },
        { provide: PersonalInfoService, useValue: { publish } },
      ],
    })
      .overrideGuard(JwtAdminGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context
            .switchToHttp()
            .getRequest<{ headers: { authorization?: string } }>();
          if (req.headers.authorization !== 'Bearer test-admin') {
            throw new UnauthorizedException();
          }
          return true;
        },
      })
      .compile();
    app = module.createNestApplication<INestApplication<Server>>();
    await app.listen(0, '127.0.0.1');
  });

  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => app.close());

  describe.each(routes)('$method $path', (route) => {
    function upload(authenticated = true) {
      const req = request(app.getHttpServer())[route.method](route.path);
      return authenticated
        ? req.set('Authorization', 'Bearer test-admin')
        : req;
    }

    it('authorizes before multipart parsing', async () => {
      await upload(false)
        .field('a[4294967295]', 'x')
        .field('a[]', 'y')
        .expect(401);
    });

    it.each(['a[4294967295]', 'a[]', 'a[b][c]', 'x'.repeat(101)])(
      'rejects crafted field name %s without invoking the service',
      async (field) => {
        await upload().field(field, 'x').expect(400);
        expect(enqueueEmail).not.toHaveBeenCalled();
        expect(importMembersFromCsv).not.toHaveBeenCalled();
        expect(publish).not.toHaveBeenCalled();
      },
    );

    it('rejects excess text fields', async () => {
      let req = upload();
      for (let i = 0; i <= route.fields; i++) req = req.field(`field${i}`, 'x');
      await req.expect(400);
    });

    it('rejects oversized field values', async () => {
      await upload()
        .field('subject', 'x'.repeat(1024 * 1024 + 1))
        .expect(400);
    });

    it('rejects oversized files', async () => {
      await upload()
        .attach(route.file, Buffer.alloc(5 * 1024 * 1024 + 1), 'large.csv')
        .expect(413);
    });

    it('rejects unexpected files', async () => {
      await upload()
        .attach('unexpected', Buffer.from('x'), 'small.txt')
        .expect(400);
    });
  });

  it.each(['/admin/emails', '/admin/emails/test'])(
    'accepts full email form at file/field limits: %s',
    async (path) => {
      let req = request(app.getHttpServer())
        .post(path)
        .set('Authorization', 'Bearer test-admin')
        .set('Idempotency-Key', 'test-key')
        .field('subject', 'Hello')
        .field('markdownContent', 'Content')
        .field('signatureMarkdown', 'Signature');
      for (let i = 0; i < 10; i++)
        req = req.attach('attachments', Buffer.from('x'), `file${i}.txt`);
      await req.expect(202);
      expect(enqueueEmail).toHaveBeenCalledTimes(1);
      expect(enqueueEmail.mock.calls[0][4]).toHaveLength(10);
    },
  );

  it('accepts CSV import at its limits', async () => {
    await request(app.getHttpServer())
      .post('/admin/members/import')
      .set('Authorization', 'Bearer test-admin')
      .field('sendEmails', 'false')
      .attach('file', Buffer.from('firstName,lastName,email\n'), 'members.csv')
      .expect(201);
    expect(importMembersFromCsv).toHaveBeenCalledWith(
      expect.any(Buffer),
      false,
    );
  });

  it('accepts all personal-information fields and supported file count', async () => {
    let req = request(app.getHttpServer())
      .patch('/admin/personal-info/config')
      .set('Authorization', 'Bearer test-admin')
      .field('markdownTemplate', 'Hello')
      .field('emailSubject', 'Subject')
      .field('sendEmail', 'false')
      .field('deleteNonTargetedEntries', 'false')
      .field('recipientMode', 'file')
      .field('placeholderNames', '[]')
      .attach('recipients', Buffer.from('email\n'), 'recipients.csv');
    for (let i = 0; i < 100; i++)
      req = req.attach('placeholderValues', Buffer.from('x'), `value${i}.csv`);
    await req.expect(200);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ placeholderFiles: expect.any(Array) }),
    );
    expect(publish.mock.calls[0][0].placeholderFiles).toHaveLength(100);
  });
});
