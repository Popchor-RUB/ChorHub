import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';
import { generateVAPIDKeys } from 'web-push';
import { MailTemplateService } from '../mail/mail-template.service';
import { DisableUnexcusedMembersTask } from '../members/disable-unexcused-members.task';
import { PrismaService } from '../prisma/prisma.service';
import { RehearsalReminderTask } from '../push/rehearsal-reminder.task';
import { ScheduledTaskModule } from './scheduled-task.module';

describe('ScheduledTaskModule', () => {
  it('boots the real module graph without database or mail side effects', async () => {
    const prisma = mockDeep<PrismaService>();
    prisma.memberDisableNotice.findMany.mockResolvedValue([]);
    const keys = generateVAPIDKeys();
    const app = await Test.createTestingModule({ imports: [ScheduledTaskModule] })
      .overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(MailTemplateService).useValue(mockDeep<MailTemplateService>())
      .overrideProvider(ConfigService).useValue(new ConfigService({
        JWT_SECRET: 'scheduled-task-test-secret',
        CHOIR_ADMIN_EMAIL: 'admin@example.test',
        VAPID_PUBLIC_KEY: keys.publicKey,
        VAPID_PRIVATE_KEY: keys.privateKey,
        VAPID_EMAIL: 'mailto:admin@example.test',
      }))
      .compile();

    try {
      await app.init();
      expect(app.get(RehearsalReminderTask)).toBeInstanceOf(RehearsalReminderTask);
      expect(app.get(DisableUnexcusedMembersTask)).toBeInstanceOf(DisableUnexcusedMembersTask);
      expect(prisma.member.updateMany).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
