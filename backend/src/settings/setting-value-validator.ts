import { BadRequestException } from '@nestjs/common';

type SettingValueValidator = (value: string) => string;

const validateCloudUrl: SettingValueValidator = (value) => {
  const trimmedValue = value.trim();
  if (!/^https?:\/\//i.test(trimmedValue) || trimmedValue.includes('\\')) {
    throw new BadRequestException('cloud.url must be a non-empty HTTP or HTTPS URL');
  }

  let url: URL;
  try {
    url = new URL(trimmedValue);
  } catch {
    throw new BadRequestException('cloud.url must be a non-empty HTTP or HTTPS URL');
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw new BadRequestException('cloud.url must be a non-empty HTTP or HTTPS URL without credentials');
  }

  return trimmedValue;
};

const settingValueValidators: ReadonlyMap<string, SettingValueValidator> = new Map([
  ['cloud.url', validateCloudUrl],
]);

export function validateSettingValue(key: string, value: string): string {
  return settingValueValidators.get(key)?.(value) ?? value;
}
