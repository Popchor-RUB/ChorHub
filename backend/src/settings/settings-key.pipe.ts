import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const SETTING_KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;

@Injectable()
export class SettingsKeyPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!SETTING_KEY_PATTERN.test(value)) {
      throw new BadRequestException('Invalid setting key');
    }
    return value;
  }
}
