import type { MailTemplateKey } from './mail-template.types';

export const MAIL_TEMPLATE_HASHES: Record<MailTemplateKey, readonly string[]> = {
  "admin-member-disabled": [
    "fe8b9dffdb5635701162f4f886f197fb44cf2d115078c90ba71e89faaffb4f36",
  ],
  "invite": [
    "7a89d3e3aa45cfb8ec4ffa4a7a2c9082275d4ef5773c7937609d9131a07bf97c",
  ],
  "magic-link": [
    "1ca610f0e07fbe56b102d24018d2b2f98d08da52c92ce27cefff82bb273ad301",
  ],
  "member-automatically-disabled": [
    "d5cb43aaf1efe24e5a5750c5b676afb3d23207d33105a79bc6ffdbf949e60b74",
  ],
  "member-disabled": [
    "7b9dafafc5252ea108122ee837f74719dfbf01abb71c66fe9c2a58f6a4f48883",
  ],
  "personal-info": [
    "0d5e2143ef80b61a93e87f5e8ce8011dc7d5ae7f11dc1a44d14d24314190ebd7",
  ],
  "push-fallback-reminder": [
    "a5605ae0d55581d3441f1ff9fcab13debe89c932683b162544853f3b8a77d3b7",
  ],
};
