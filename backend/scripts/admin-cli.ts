/**
 * Admin user management CLI
 *
 * Usage (from the backend/ directory):
 *   npm run admin -- create <username> [password]
 *   npm run admin -- delete <username>
 *   npm run admin -- list
 *   npm run admin -- passwd <username>
 *   npm run admin -- invite [--all]
 *   npm run admin -- impersonate <member-email>
 *   npm run admin -- mailtemplate <template> <user e-mail>
 *
 * Or directly:
 *   npx tsx scripts/admin-cli.ts create <username> [password]
 *   npx tsx scripts/admin-cli.ts passwd <username>
 *   npx tsx scripts/admin-cli.ts invite [--all]
 *   npx tsx scripts/admin-cli.ts impersonate <member-email>
 *   npx tsx scripts/admin-cli.ts mailtemplate <template> <user e-mail>
 *
 * If no password is supplied for "create" or "passwd", a secure random one is generated
 * and printed to stdout.
 *
 * Requires DATABASE_URL to be set in the environment (e.g. via .env).
 */

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import * as readline from 'readline';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import * as Handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';

type SupportedMailTemplate = 'invite' | 'magic-link';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function promptPassword(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);

    let input = '';
    process.stdin.on('data', function onData(char: Buffer) {
      const c = char.toString();
      if (c === '\r' || c === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        rl.close();
        resolve(input);
      } else if (c === '\u0003') {
        // Ctrl+C
        process.stdout.write('\n');
        process.exit(1);
      } else if (c === '\u007f' || c === '\b') {
        // Backspace
        input = input.slice(0, -1);
      } else {
        input += c;
      }
    });
  });
}

function usage(): never {
  console.error('Usage:');
  console.error('  npx ts-node scripts/admin-cli.ts create <username> [password]');
  console.error('  npx ts-node scripts/admin-cli.ts delete <username>');
  console.error('  npx ts-node scripts/admin-cli.ts list');
  console.error('  npx ts-node scripts/admin-cli.ts passwd <username>');
  console.error('  npx ts-node scripts/admin-cli.ts invite [--all]');
  console.error('  npx ts-node scripts/admin-cli.ts impersonate <member-email>');
  console.error('  npx ts-node scripts/admin-cli.ts mailtemplate <template> <user e-mail>');
  console.error('  templates: invite, magic-link');
  process.exit(1);
}

function getMailTransporter(): nodemailer.Transporter {
  const smtpHost = process.env.SMTP_HOST;
  if (!smtpHost) {
    console.error('Error: SMTP_HOST is not set.');
    process.exit(1);
  }

  const smtpPort = Number(process.env.SMTP_PORT ?? 587);
  const smtpSecure = `${process.env.SMTP_SECURE ?? 'false'}`.toLowerCase() === 'true';
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    // Keep behavior consistent with backend runtime config.
    ignoreTLS: !smtpSecure,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS ?? '',
        }
      : undefined,
  });
}

async function getMemberByEmail(email: string) {
  return prisma.member.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
}

async function renderTemplate(template: SupportedMailTemplate, context: Record<string, string>) {
  const templateSource = await readFile(
    resolve(process.cwd(), `src/mail/templates/${template}.hbs`),
    'utf8',
  );
  return Handlebars.compile(templateSource, { strict: true })(context);
}

async function buildInviteMail(member: { id: string; firstName: string; lastName: string; email: string }) {
  const rawToken = await createMemberSessionToken(member.id);
  const appUrl = (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
  return {
    subject: 'Willkommen bei ChorHub - Dein Zugangslink',
    html: await renderTemplate('invite', {
      firstName: member.firstName,
      lastName: member.lastName,
      magicUrl: `${appUrl}/auth/verify?token=${rawToken}`,
    }),
  };
}

async function buildMagicLinkMail(member: { id: string; firstName: string; email: string }) {
  const rawToken = randomBytes(32).toString('hex');
  const hashedToken = createHash('sha256').update(rawToken).digest('hex');
  const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedCode = createHash('sha256').update(rawCode).digest('hex');
  const codeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.$transaction([
    prisma.memberLoginCode.deleteMany({
      where: { memberId: member.id, expiresAt: { lt: new Date() } },
    }),
    prisma.memberLoginToken.create({
      data: { memberId: member.id, hashedToken },
    }),
    prisma.memberLoginCode.create({
      data: { memberId: member.id, hashedCode, expiresAt: codeExpiresAt },
    }),
  ]);

  const appUrl = (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
  return {
    subject: 'Dein ChorHub Anmeldelink',
    html: await renderTemplate('magic-link', {
      firstName: member.firstName,
      magicUrl: `${appUrl}/auth/verify?token=${rawToken}`,
      rawToken,
      loginCode: rawCode,
    }),
  };
}

async function createMemberSessionToken(memberId: string): Promise<string> {
  const rawToken = randomBytes(32).toString('hex');
  const hashedToken = createHash('sha256').update(rawToken).digest('hex');
  await prisma.memberLoginToken.create({
    data: { memberId, hashedToken },
  });
  return rawToken;
}

function buildMemberVerifyUrl(rawToken: string): string {
  const appUrl = (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
  return `${appUrl}/auth/verify?token=${rawToken}`;
}

async function impersonateMember(email: string): Promise<void> {
  const member = await getMemberByEmail(email);
  if (!member) {
    console.error(`Error: no member found for e-mail "${email}".`);
    process.exit(1);
  }

  const rawToken = await createMemberSessionToken(member.id);
  const verifyUrl = buildMemberVerifyUrl(rawToken);

  console.log('════════════════════════════════════════');
  console.log('  MEMBER IMPERSONATION LINK');
  console.log(`  Member : ${member.firstName} ${member.lastName}`);
  console.log(`  E-Mail : ${member.email}`);
  console.log('  Verify :');
  console.log(`  ${verifyUrl}`);
  console.log('════════════════════════════════════════');
}

async function sendTemplateMail(template: SupportedMailTemplate, email: string): Promise<void> {
  const member = await getMemberByEmail(email);
  if (!member) {
    console.error(`Error: no member found for e-mail "${email}".`);
    process.exit(1);
  }

  const transporter = getMailTransporter();
  const from = process.env.MAIL_FROM ?? 'noreply@chorhub.de';
  const mail =
    template === 'invite'
      ? await buildInviteMail(member)
      : template === 'magic-link'
        ? await buildMagicLinkMail(member)
        : null;

  if (!mail) {
    console.error(`Error: unsupported template "${template}".`);
    console.error('Supported templates: invite, magic-link');
    process.exit(1);
  }

  await transporter.sendMail({
    from,
    to: member.email,
    subject: mail.subject,
    html: mail.html,
  });

  console.log('════════════════════════════════════════');
  console.log('  TEMPLATE MAIL SENT');
  console.log(`  Template : ${template}`);
  console.log(`  Member   : ${member.firstName} ${member.lastName}`);
  console.log(`  E-Mail   : ${member.email}`);
  console.log('════════════════════════════════════════');
}

async function createAdmin(username: string, plaintextPassword?: string): Promise<void> {
  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) {
    console.error(`Error: admin user "${username}" already exists.`);
    process.exit(1);
  }

  const password = plaintextPassword ?? randomBytes(12).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.adminUser.create({ data: { username, passwordHash } });

  console.log('════════════════════════════════════════');
  console.log('  ADMIN USER CREATED');
  console.log(`  Username : ${username}`);
  if (!plaintextPassword) {
    console.log(`  Password : ${password}`);
    console.log('  Change this password after first login!');
  } else {
    console.log('  Password : (as supplied)');
  }
  console.log('════════════════════════════════════════');
}

async function deleteAdmin(username: string): Promise<void> {
  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (!existing) {
    console.error(`Error: admin user "${username}" not found.`);
    process.exit(1);
  }

  await prisma.adminUser.delete({ where: { username } });
  console.log(`Admin user "${username}" deleted.`);
}

async function changePassword(username: string): Promise<void> {
  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (!existing) {
    console.error(`Error: admin user "${username}" not found.`);
    process.exit(1);
  }

  const input = await promptPassword('New password (leave empty to generate): ');
  const generated = input === '';
  const password = generated ? randomBytes(12).toString('base64url') : input;
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.adminUser.update({ where: { username }, data: { passwordHash } });

  console.log('════════════════════════════════════════');
  console.log('  PASSWORD CHANGED');
  console.log(`  Username : ${username}`);
  if (generated) {
    console.log(`  Password : ${password}`);
  } else {
    console.log('  Password : (as supplied)');
  }
  console.log('════════════════════════════════════════');
}

async function listAdmins(): Promise<void> {
  const admins = await prisma.adminUser.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, username: true, createdAt: true },
  });

  if (admins.length === 0) {
    console.log('No admin users found.');
    return;
  }

  console.log(`${'Username'.padEnd(30)} ${'Created'.padEnd(30)} ID`);
  console.log('─'.repeat(90));
  for (const a of admins) {
    console.log(`${a.username.padEnd(30)} ${a.createdAt.toISOString().padEnd(30)} ${a.id}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderProgress(current: number, total: number): void {
  const width = 30;
  const ratio = total === 0 ? 1 : current / total;
  const filled = Math.round(width * ratio);
  const bar = `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
  process.stdout.write(`\r[${bar}] ${current}/${total}`);
}

async function inviteMembers(sendToAll: boolean): Promise<void> {
  const SENT_INTERVAL=60000
  const members = await prisma.member.findMany({
    where: sendToAll ? undefined : { lastLoginAt: null },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  if (members.length === 0) {
    console.log(sendToAll ? 'No members found.' : 'No members found who have not logged in yet.');
    return;
  }
  const transporter = getMailTransporter();
  const from = process.env.MAIL_FROM ?? 'noreply@chorhub.de';

  let sent = 0;
  let failed = 0;
  let processed = 0;
  let nextAllowedAt = Date.now();

  console.log(`Starting invite run for ${members.length} member(s)${sendToAll ? ' (all)' : ' (never logged in)'}.`);
  renderProgress(processed, members.length);

  for (const member of members) {
    const waitMs = nextAllowedAt - Date.now();
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    try {
      const mail = await buildInviteMail(member);
      await transporter.sendMail({
        from,
        to: member.email,
        subject: mail.subject,
        html: mail.html,
      });
      sent++;
    } catch (err) {
      failed++;
      process.stdout.write('\n');
      console.error(`[${processed + 1}/${members.length}] Failed invite for ${member.email}`);
      console.error(err);
    }
    processed++;
    renderProgress(processed, members.length);
    nextAllowedAt = Date.now() + SENT_INTERVAL;
  }

  process.stdout.write('\n');
  console.log('════════════════════════════════════════');
  console.log('  INVITE RUN COMPLETE');
  console.log(`  Total   : ${members.length}`);
  console.log(`  Sent    : ${sent}`);
  console.log(`  Failed  : ${failed}`);
  console.log('════════════════════════════════════════');
}

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;

  switch (command) {
    case 'create':
      if (!args[0]) usage();
      await createAdmin(args[0], args[1]);
      break;
    case 'delete':
      if (!args[0]) usage();
      await deleteAdmin(args[0]);
      break;
    case 'list':
      await listAdmins();
      break;
    case 'passwd':
      if (!args[0]) usage();
      await changePassword(args[0]);
      break;
    case 'invite':
      await inviteMembers(args.includes('--all'));
      break;
    case 'impersonate':
      if (!args[0]) usage();
      await impersonateMember(args[0]);
      break;
    case 'mailtemplate':
      if (!args[0] || !args[1]) usage();
      await sendTemplateMail(args[0] as SupportedMailTemplate, args[1]);
      break;
    default:
      usage();
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
