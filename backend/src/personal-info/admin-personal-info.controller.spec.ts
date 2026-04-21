import { Test } from '@nestjs/testing';
import { AdminPersonalInfoController } from './admin-personal-info.controller';
import { PersonalInfoService } from './personal-info.service';

describe('AdminPersonalInfoController', () => {
  it('forwards multipart payload to service.publish', async () => {
    const personalInfoService = {
      getConfig: jest.fn(),
      getSendStatus: jest.fn().mockReturnValue({ status: 'IDLE' }),
      publish: jest.fn().mockResolvedValue({ updatedCount: 1, sentCount: 1 }),
      listMemberRows: jest.fn(),
      getMemberRow: jest.fn(),
      upsertMemberInfo: jest.fn(),
    } as unknown as jest.Mocked<PersonalInfoService>;

    const module = await Test.createTestingModule({
      controllers: [AdminPersonalInfoController],
      providers: [{ provide: PersonalInfoService, useValue: personalInfoService }],
    }).compile();

    const controller = module.get(AdminPersonalInfoController);

    const recipients = {
      fieldname: 'recipients',
      originalname: 'recipients.txt',
      encoding: '7bit',
      mimetype: 'text/plain',
      size: 10,
      buffer: Buffer.from('a@chor.de'),
      stream: null,
      destination: '',
      filename: '',
      path: '',
    } as unknown as Express.Multer.File;
    const placeholder = {
      ...recipients,
      fieldname: 'placeholderValues',
      originalname: 'code.txt',
    } as Express.Multer.File;

    await controller.publishConfig(
      {
        markdownTemplate: 'Hi {{firstname}}',
        emailSubject: 'Betreff',
        sendEmail: 'true',
        deleteNonTargetedEntries: 'true',
        recipientMode: 'file',
        placeholderNames: JSON.stringify(['code']),
      },
      {
        recipients: [recipients],
        placeholderValues: [placeholder],
      },
    );

    expect(personalInfoService.publish).toHaveBeenCalledWith({
      markdownTemplate: 'Hi {{firstname}}',
      emailSubject: 'Betreff',
      sendEmail: true,
      deleteNonTargetedEntries: true,
      recipientMode: 'file',
      recipientFile: recipients,
      placeholderNamesJson: JSON.stringify(['code']),
      placeholderFiles: [placeholder],
    });
  });

  it('forwards getSendStatus', async () => {
    const personalInfoService = {
      getConfig: jest.fn(),
      getSendStatus: jest.fn().mockReturnValue({ status: 'RUNNING', total: 5 }),
      publish: jest.fn(),
      listMemberRows: jest.fn(),
      getMemberRow: jest.fn(),
      upsertMemberInfo: jest.fn(),
    } as unknown as jest.Mocked<PersonalInfoService>;

    const module = await Test.createTestingModule({
      controllers: [AdminPersonalInfoController],
      providers: [{ provide: PersonalInfoService, useValue: personalInfoService }],
    }).compile();

    const controller = module.get(AdminPersonalInfoController);
    const result = controller.getSendStatus();

    expect(personalInfoService.getSendStatus).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 'RUNNING', total: 5 });
  });
});
