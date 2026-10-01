import { validate } from 'class-validator';
import { CreateEmailDto } from './create-email.dto';

describe('CreateEmailDto', () => {
  it('accepts required text fields and optional signature', async () => {
    const dto = Object.assign(new CreateEmailDto(), { subject: 'Subject', markdownContent: 'Body' });
    await expect(validate(dto)).resolves.toHaveLength(0);

    dto.signatureMarkdown = '**Thanks**';
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects absent or non-string required fields and non-string signature', async () => {
    const dto = Object.assign(new CreateEmailDto(), { subject: 123, markdownContent: null, signatureMarkdown: false });
    const errors = await validate(dto);
    expect(errors.map(({ property }) => property).sort()).toEqual(['markdownContent', 'signatureMarkdown', 'subject']);
  });
});
