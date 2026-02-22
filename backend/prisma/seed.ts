import { PrismaClient, ChoirVoice } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create default admin user
  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.adminUser.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash },
  });
  console.log('Admin created:', admin.username);

  // Create some sample rehearsals
  const rehearsalDates = [
    { date: new Date(Date.now() + 7 * 86400000), title: 'Wochenprobe 1', description: 'Einstudierung der neuen Stücke' },
    { date: new Date(Date.now() + 14 * 86400000), title: 'Wochenprobe 2', description: null },
    { date: new Date(Date.now() + 21 * 86400000), title: 'Hauptprobe', description: 'Vorbereitung für das Konzert' },
    { date: new Date(Date.now() - 7 * 86400000), title: 'Vergangene Probe 1', description: null },
    { date: new Date(Date.now() - 14 * 86400000), title: 'Vergangene Probe 2', description: null },
  ];

  for (const r of rehearsalDates) {
    await prisma.rehearsal.upsert({
      where: { id: r.title.toLowerCase().replace(/\s+/g, '-') },
      update: {},
      create: { ...r, id: r.title.toLowerCase().replace(/\s+/g, '-') },
    });
  }
  console.log('Sample rehearsals created');

  // Set some general info
  await prisma.generalInfo.upsert({
    where: { id: 'main' },
    create: {
      id: 'main',
      markdownContent: `# Willkommen im Chor!\n\n## Aktuelle Informationen\n\nHier stehen wichtige Informationen für alle Chormitglieder.\n\n## Nächstes Konzert\n\nUnser nächstes Konzert findet statt am **15. April 2025**.\n\n## Kontakt\n\nBei Fragen wenden Sie sich an die Chorleitung.`,
    },
    update: {},
  });
  console.log('General info set');

  console.log('\n✅ Seed completed!');
  console.log('Admin login: admin / admin123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
