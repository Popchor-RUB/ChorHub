import * as fs from 'fs';
import * as path from 'path';

const BACKEND_URL = 'http://localhost:3000';
const TOKEN_CACHE_PATH = path.join(__dirname, '..', '.auth', 'admin-token.json');

export interface Rehearsal {
  id: string;
  date: string;
  title: string;
}

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export async function getAdminToken(): Promise<string> {
  // Prefer the token saved by global-setup to avoid hitting auth rate limits
  try {
    const cached = JSON.parse(fs.readFileSync(TOKEN_CACHE_PATH, 'utf-8'));
    if (cached?.token) return cached.token;
  } catch {
    // Cache not available yet (e.g. during global-setup itself)
  }
  const res = await fetch(`${BACKEND_URL}/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  if (!res.ok) throw new Error(`Admin login failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}

export async function getFirstMember(adminToken: string): Promise<Member> {
  const res = await fetch(`${BACKEND_URL}/admin/members`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch members: ${res.status}`);
  const members: Member[] = await res.json();
  if (!members.length) throw new Error('No members found — run seed first');
  return members[0];
}

export async function getAllRehearsals(adminToken: string): Promise<Rehearsal[]> {
  const res = await fetch(`${BACKEND_URL}/rehearsals/all`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch rehearsals: ${res.status}`);
  return res.json();
}

export async function getMostRecentPastRehearsal(
  adminToken: string,
): Promise<Rehearsal> {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const rehearsals = await getAllRehearsals(adminToken);
  const past = rehearsals
    .filter((r) => new Date(r.date) < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (!past.length) throw new Error('No past rehearsals found');
  return past[0];
}

export async function getFirstUpcomingRehearsal(
  adminToken: string,
): Promise<Rehearsal> {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const rehearsals = await getAllRehearsals(adminToken);
  const upcoming = rehearsals
    .filter((r) => new Date(r.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (!upcoming.length) throw new Error('No upcoming rehearsals found');
  return upcoming[0];
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}
