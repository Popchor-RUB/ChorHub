import { validate } from 'class-validator';
import { UpdateMemberStatusDto } from './update-member-status.dto';

describe('UpdateMemberStatusDto', () => {
  it('accepts omitted optional email options', async () => {
    const dto = Object.assign(new UpdateMemberStatusDto(), { disabled: true });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepts boolean email options', async () => {
    const dto = Object.assign(new UpdateMemberStatusDto(), {
      disabled: true,
      notifyMember: false,
      includeReasonInEmail: true,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects nonboolean email options', async () => {
    const dto = Object.assign(new UpdateMemberStatusDto(), {
      disabled: true,
      notifyMember: "false",
      includeReasonInEmail: 1,
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['notifyMember', 'includeReasonInEmail']),
    );
  });
});
