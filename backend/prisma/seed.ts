import 'dotenv/config';
import { PrismaClient, AttendanceResponse } from '../src/generated/prisma/client';
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
// Female voices: Sopran 52, Mezzosopran 20, Alt 38  → 110
// Male voices:   Tenor 28, Bariton 30, Bass 32       →  90

const VOICE_NAMES = ['Sopran', 'Mezzosopran', 'Alt', 'Tenor', 'Bariton', 'Bass'] as const;
type VoiceName = typeof VOICE_NAMES[number];

const VOICE_SLOTS: VoiceName[] = [
  ...Array(52).fill('Sopran'),
  ...Array(20).fill('Mezzosopran'),
  ...Array(38).fill('Alt'),
  ...Array(28).fill('Tenor'),
  ...Array(30).fill('Bariton'),
  ...Array(32).fill('Bass'),
];

// Whether a voice is female (determines name pool)
function isFemaleVoice(v: VoiceName): boolean {
  return v === 'Sopran' || v === 'Mezzosopran' || v === 'Alt';
}

// ── Rehearsal data ────────────────────────────────────────────────────────────

const TODAY = new Date();
TODAY.setHours(19, 0, 0, 0); // rehearsals at 7 pm

function daysFromNow(days: number): Date {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + days);
  return d;
}

const PAST_REHEARSAL_COUNT = 5;
const UPCOMING_REHEARSAL_COUNT = 10;

const REHEARSAL_DESCRIPTIONS = [
  'Einstimmung und gemeinsames Einsingen',
  'Registerproben mit Fokus auf Intonation',
  'Feinschliff von Dynamik und Artikulation',
  'Programmprobe mit vollständigem Ablauf',
  'Neue Stücke anlesen und Stimmen festigen',
  'Klangbalance zwischen den Stimmen verbessern',
];

function buildRehearsalSeries(offsetDays: number, count: number, titleStartIndex = 1) {
  return Array.from({ length: count }, (_, i) => {
    const index = i + 1;
    const titleIndex = titleStartIndex + i;
    return {
      date: daysFromNow(offsetDays + i * 7),
      title: `${titleIndex}. Probe`,
      description: REHEARSAL_DESCRIPTIONS[i % REHEARSAL_DESCRIPTIONS.length],
      location: 'Gemeindesaal',
      durationMinutes: 120,
    };
  });
}

const PAST_REHEARSALS = buildRehearsalSeries(-7 * PAST_REHEARSAL_COUNT, PAST_REHEARSAL_COUNT, 1);
const OPTIONAL_UPCOMING_REHEARSAL_INDEXES = new Set([1, 4, 8]);
const UPCOMING_REHEARSALS = buildRehearsalSeries(7, UPCOMING_REHEARSAL_COUNT, PAST_REHEARSAL_COUNT + 1).map(
  (rehearsal, index) => ({
    ...rehearsal,
    isOptional: OPTIONAL_UPCOMING_REHEARSAL_INDEXES.has(index),
  }),
);

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
  await prisma.choirVoice.deleteMany();
  console.log('   Done.');

  // ── Choir voices ──────────────────────────────────────────────────────────
  console.log('🎤 Seeding choir voices…');
  const voiceRecords = await prisma.$transaction(
    VOICE_NAMES.map((name, i) =>
      prisma.choirVoice.create({ data: { name, sortOrder: i + 1 } }),
    ),
  );
  const voiceByName = new Map(voiceRecords.map((v) => [v.name, v]));
  console.log(`   ${voiceRecords.length} voices created.`);

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

    const voiceId = voiceByName.get(voice)!.id;
    return { firstName, lastName, email, choirVoice: { connect: { id: voiceId } } };
  });

  const voicedMembers = await prisma.$transaction(
    memberData.map(d => prisma.member.create({ data: d })),
  );

  // A handful of members who haven't selected a choir voice yet
  const UNVOICED = [
    { firstName: 'Lara',   lastName: 'Sommer',   email: 'lara.sommer@example.com'   },
    { firstName: 'Ben',    lastName: 'Kramer',   email: 'ben.kramer@example.com'    },
    { firstName: 'Miriam', lastName: 'Vogt',     email: 'miriam.vogt@example.com'   },
    { firstName: 'Erik',   lastName: 'Naumann',  email: 'erik.naumann@example.com'  },
    { firstName: 'Tanja',  lastName: 'Brückner', email: 'tanja.brueckner@example.com' },
  ];
  const unvoicedMembers = await prisma.$transaction(
    UNVOICED.map(d => prisma.member.create({ data: d })),
  );

  const members = [...voicedMembers, ...unvoicedMembers];
  console.log(`   ${voicedMembers.length} members with voice + ${unvoicedMembers.length} without voice created.`);

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
      // Optional rehearsals do not allow DECLINED plans in app logic.
      if (rehearsal.isOptional && response === AttendanceResponse.DECLINED) {
        return;
      }
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

  // Clear upcoming plans for the first alphabetical member so E2E tests always
  // start with a clean slate for that member (no pre-seeded CONFIRMED plan).
  const firstMember = await prisma.member.findFirst({
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
  if (firstMember) {
    await prisma.attendancePlan.deleteMany({
      where: {
        memberId: firstMember.id,
        rehearsalId: { in: upcomingRehearsals.map(r => r.id) },
      },
    });
  }

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
