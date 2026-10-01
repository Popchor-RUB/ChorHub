import { validate } from 'class-validator';
import { RetryEmailDto } from './retry-email.dto';

describe('RetryEmailDto', () => {
  it('accepts omitted or boolean duplicate-risk acknowledgement', async () => {
    await expect(validate(new RetryEmailDto())).resolves.toHaveLength(0);
    const dto = Object.assign(new RetryEmailDto(), { acknowledgeDuplicateRisk: true });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects string, number, and null acknowledgements', async () => {
    for (const value of ['true', 1, null]) {
      const dto = Object.assign(new RetryEmailDto(), { acknowledgeDuplicateRisk: value });
      await expect(validate(dto)).resolves.toHaveLength(1);
    }
  });
});
