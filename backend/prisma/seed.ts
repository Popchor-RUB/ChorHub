import { PrismaClient, ChoirVoice, AttendanceResponse } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Deterministic pseudo-random in [0, 1) based on two integer seeds
function rand(a: number, b: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ── Name pools ────────────────────────────────────────────────────────────────

const FEMALE_FIRST = [
  'Anna', 'Maria', 'Sophie', 'Lena', 'Julia', 'Lisa', 'Emma', 'Clara',
  'Hannah', 'Lea', 'Sara', 'Nina', 'Petra', 'Ursula', 'Helga', 'Brigitte',
  'Elisabeth', 'Inge', 'Monika', 'Claudia', 'Sabine', 'Sandra', 'Andrea',
  'Stefanie', 'Katrin', 'Susanne', 'Christine', 'Daniela', 'Martina',
  'Nicole', 'Franziska', 'Laura', 'Katharina', 'Johanna', 'Luisa', 'Mia',
  'Amelie', 'Elisa', 'Vera', 'Birgit', 'Karin', 'Renate', 'Heidi', 'Ilse',
  'Gertrud', 'Waltraud', 'Hildegard', 'Uta', 'Elfriede', 'Ingrid',
];

const MALE_FIRST = [
  'Thomas', 'Michael', 'Stefan', 'Andreas', 'Markus', 'Klaus', 'Wolfgang',
  'Hans', 'Peter', 'Jürgen', 'Frank', 'Rainer', 'Bernd', 'Horst', 'Dieter',
  'Werner', 'Günter', 'Gerhard', 'Karl', 'Fritz', 'Lukas', 'David', 'Simon',
  'Jonas', 'Felix', 'Jan', 'Paul', 'Christian', 'Christoph', 'Martin',
  'Daniel', 'Sebastian', 'Tobias', 'Philipp', 'Alexander', 'Florian',
  'Benedikt', 'Dominik', 'Maximilian', 'Tim', 'Lars', 'Nico', 'Georg',
  'Rudolf', 'Heinrich', 'Ottmar', 'Manfred', 'Ulrich', 'Reinhard', 'Jochen',
];

const LAST_NAMES = [
  'Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner',
  'Becker', 'Schulz', 'Hoffmann', 'Schäfer', 'Koch', 'Bauer', 'Richter',
  'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Zimmermann', 'Braun',
  'Krüger', 'Hofmann', 'Hartmann', 'Lange', 'Schmitt', 'Werner', 'Krause',
  'Meier', 'Lehmann', 'Schmid', 'Schulze', 'Maier', 'Köhler', 'Herrmann',
  'König', 'Walter', 'Mayer', 'Huber', 'Kaiser', 'Fuchs', 'Peters', 'Lang',
  'Scholz', 'Möller', 'Weiß', 'Jung', 'Hahn', 'Schubert', 'Vogel',
  'Friedrich', 'Keller', 'Günther', 'Frank', 'Berger', 'Winkler', 'Roth',
  'Beck', 'Lorenz', 'Baumann', 'Franke', 'Albrecht', 'Schumann', 'Simon',
  'Thomas', 'Haas', 'Busch', 'Seidel', 'Ziegler', 'Brandt', 'Vogt',
  'Arnold', 'Engel', 'Winter', 'Kremer', 'Sommer', 'Stein', 'Bergmann',
];

// ── Voice distribution (total = 200) ─────────────────────────────────────────
// Female voices: SOPRAN 52, MEZZOSOPRAN 20, ALT 38  → 110
// Male voices:   TENOR 28, BARITON 30, BASS 32       →  90

const VOICE_SLOTS: ChoirVoice[] = [
  ...Array(52).fill(ChoirVoice.SOPRAN),
  ...Array(20).fill(ChoirVoice.MEZZOSOPRAN),
  ...Array(38).fill(ChoirVoice.ALT),
  ...Array(28).fill(ChoirVoice.TENOR),
  ...Array(30).fill(ChoirVoice.BARITON),
  ...Array(32).fill(ChoirVoice.BASS),
];

// Whether a voice is female (determines name pool)
function isFemaleVoice(v: ChoirVoice): boolean {
  return v === ChoirVoice.SOPRAN || v === ChoirVoice.MEZZOSOPRAN || v === ChoirVoice.ALT;
}

// ── Rehearsal data ────────────────────────────────────────────────────────────

const TODAY = new Date();
TODAY.setHours(19, 0, 0, 0); // rehearsals at 7 pm

function daysFromNow(days: number): Date {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + days);
  return d;
}

const PAST_REHEARSALS = [
  { date: daysFromNow(-63), title: 'Wochenprobe', description: 'Einstimmung nach der Sommerpause – leichte Aufwärmstücke' },
  { date: daysFromNow(-49), title: 'Wochenprobe', description: 'Einstudierung: Bach – Jesu, Joy of Man\'s Desiring' },
  { date: daysFromNow(-35), title: 'Wochenprobe', description: 'Stimmbildung und Intonation' },
  { date: daysFromNow(-21), title: 'Wochenprobe', description: 'Gemeinsames Proben der Konzertstücke' },
  { date: daysFromNow(-7),  title: 'Hauptprobe',  description: 'Generalprobe vor dem Herbstkonzert – vollständiges Programm' },
];

const UPCOMING_REHEARSALS = [
  { date: daysFromNow(7),  title: 'Wochenprobe', description: 'Rückblick auf das Konzert, neue Stücke für Advent' },
  { date: daysFromNow(14), title: 'Wochenprobe', description: 'Adventsprogramm: erste Einstudierung' },
  { date: daysFromNow(21), title: 'Wochenprobe', description: 'Adventsprogramm: Feinschliff Dynamik & Tempi' },
  { date: daysFromNow(28), title: 'Wochenprobe', description: null },
  { date: daysFromNow(35), title: 'Hauptprobe',  description: 'Hauptprobe Adventskonzert – bitte pünktlich erscheinen!' },
];

// ── Attendance helpers ────────────────────────────────────────────────────────

/**
 * Returns attendance plan decision for member i at rehearsal j.
 * Probability distribution:
 *   70 % → CONFIRMED
 *   15 % → DECLINED
 *   15 % → no plan (undefined)
 */
function planResponse(memberIdx: number, rehearsalIdx: number): AttendanceResponse | null {
  const r = rand(memberIdx, rehearsalIdx);
  if (r < 0.70) return AttendanceResponse.CONFIRMED;
  if (r < 0.85) return AttendanceResponse.DECLINED;
  return null; // no response
}

/**
 * Returns true if a member who CONFIRMED actually showed up.
 * ~88 % show-up rate (life happens).
 */
function didAttend(memberIdx: number, rehearsalIdx: number): boolean {
  return rand(memberIdx + 1000, rehearsalIdx) < 0.88;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🧹 Cleaning database…');
  // Delete in dependency order (cascade would handle most, but explicit is safer)
  await prisma.attendanceRecord.deleteMany();
  await prisma.attendancePlan.deleteMany();
  await prisma.rehearsal.deleteMany();
  await prisma.member.deleteMany();
  await prisma.passkeyCredential.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.generalInfo.deleteMany();
  console.log('   Done.');

  // ── Admin ──────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.adminUser.create({ data: { username: 'admin', passwordHash } });
  console.log('👤 Admin created (admin / admin123)');

  // ── Members ───────────────────────────────────────────────────────────────
  console.log('👥 Creating 200 members…');
  const usedEmails = new Set<string>();

  const memberData = VOICE_SLOTS.map((voice, i) => {
    const female = isFemaleVoice(voice);
    const firstPool = female ? FEMALE_FIRST : MALE_FIRST;

    const firstName = firstPool[Math.floor(rand(i, 0) * firstPool.length)];
    const lastName  = LAST_NAMES[Math.floor(rand(i, 1) * LAST_NAMES.length)];

    // Unique email: firstname.lastname+suffix@example.com
    const base = `${firstName.toLowerCase().replace(/[äöüß ]/g, c =>
      ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', ' ': '.' }[c] ?? c)
    )}.${lastName.toLowerCase().replace(/[äöüß ]/g, c =>
      ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', ' ': '.' }[c] ?? c)
    )}`;
    let email = `${base}@example.com`;
    let suffix = 2;
    while (usedEmails.has(email)) {
      email = `${base}${suffix}@example.com`;
      suffix++;
    }
    usedEmails.add(email);

    return { firstName, lastName, email, choirVoice: voice };
  });

  const members = await prisma.$transaction(
    memberData.map(d => prisma.member.create({ data: d })),
  );
  console.log(`   ${members.length} members created.`);

  // ── Rehearsals ────────────────────────────────────────────────────────────
  console.log('🎵 Creating rehearsals…');
  const pastRehearsals = await prisma.$transaction(
    PAST_REHEARSALS.map(r => prisma.rehearsal.create({ data: r })),
  );
  const upcomingRehearsals = await prisma.$transaction(
    UPCOMING_REHEARSALS.map(r => prisma.rehearsal.create({ data: r })),
  );
  const allRehearsals = [...pastRehearsals, ...upcomingRehearsals];
  console.log(`   ${allRehearsals.length} rehearsals created.`);

  // ── Attendance plans (all rehearsals) ─────────────────────────────────────
  console.log('📋 Generating attendance plans…');
  const plans: { memberId: string; rehearsalId: string; response: AttendanceResponse }[] = [];

  members.forEach((member, mi) => {
    allRehearsals.forEach((rehearsal, ri) => {
      const response = planResponse(mi, ri);
      if (response !== null) {
        plans.push({ memberId: member.id, rehearsalId: rehearsal.id, response });
      }
    });
  });

  // Insert in batches of 500 to avoid huge single transactions
  const BATCH = 500;
  for (let i = 0; i < plans.length; i += BATCH) {
    await prisma.attendancePlan.createMany({ data: plans.slice(i, i + BATCH) });
  }
  console.log(`   ${plans.length} attendance plans created.`);

  // ── Attendance records (past rehearsals only) ─────────────────────────────
  console.log('✅ Generating attendance records for past rehearsals…');
  const records: { memberId: string; rehearsalId: string }[] = [];

  members.forEach((member, mi) => {
    pastRehearsals.forEach((rehearsal, ri) => {
      const plan = plans.find(
        p => p.memberId === member.id && p.rehearsalId === rehearsal.id,
      );
      if (plan?.response === AttendanceResponse.CONFIRMED && didAttend(mi, ri)) {
        records.push({ memberId: member.id, rehearsalId: rehearsal.id });
      }
    });
  });

  for (let i = 0; i < records.length; i += BATCH) {
    await prisma.attendanceRecord.createMany({ data: records.slice(i, i + BATCH) });
  }
  console.log(`   ${records.length} attendance records created.`);

  // ── General info ──────────────────────────────────────────────────────────
  await prisma.generalInfo.create({
    data: {
      id: 'main',
      markdownContent: [
        '# Willkommen beim Chor Harmonia!',
        '',
        '## Aktuelle Informationen',
        '',
        'Liebe Chormitglieder, herzlich willkommen in unserem Chorportal.',
        'Hier findet ihr alle wichtigen Infos zu Proben und Auftritten.',
        '',
        '## Nächstes Konzert',
        '',
        'Unser **Adventskonzert** findet am **14. Dezember 2026** um 17:00 Uhr',
        'in der Stadtkirche statt. Bitte tragt den Termin in eure Kalender ein!',
        '',
        '## Probenzeiten',
        '',
        'Wir proben jeden **Donnerstag** von **19:00 – 21:00 Uhr** im Gemeindesaal.',
        '',
        '## Kontakt',
        '',
        'Bei Fragen wendet euch an die Chorleitung: **chorleitung@harmonia.de**',
      ].join('\n'),
    },
  });

  console.log('\n✅ Demo seed completed!');
  console.log('   Admin login : admin / admin123');
  console.log(`   Members     : ${members.length}`);
  console.log(`   Rehearsals  : ${allRehearsals.length} (${pastRehearsals.length} past, ${upcomingRehearsals.length} upcoming)`);
  console.log(`   Plans       : ${plans.length}`);
  console.log(`   Records     : ${records.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
