import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { normalizeSingleMailbox } from '../src/common/single-mailbox';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const members = await prisma.member.findMany({
      select: { id: true, email: true, isDisabled: true },
      orderBy: { id: 'asc' },
    });
    const invalid = members.filter(({ email }) => !normalizeSingleMailbox(email));
    for (const member of invalid) console.log(JSON.stringify(member));
    console.log(`Checked ${members.length} member(s); ${invalid.length} invalid email address(es).`);
    if (invalid.length > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
