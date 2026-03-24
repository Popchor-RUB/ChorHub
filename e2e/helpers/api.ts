import * as fs from 'fs';
import * as path from 'path';

const BACKEND_URL = 'http://localhost:3000';
const TOKEN_CACHE_PATH = path.join(__dirname, '..', '.auth', 'admin-token.json');

export interface Rehearsal {
  id: string;
  date: string;
  title: string;
  location?: string | null;
  durationMinutes?: number | null;
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

export async function createMember(
  adminToken: string,
  data: { firstName: string; lastName: string; email: string; voiceId?: string },
): Promise<Member> {
  const res = await fetch(`${BACKEND_URL}/admin/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create member: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function deleteMember(adminToken: string, memberId: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/admin/members/${memberId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!res.ok) throw new Error(`Failed to delete member: ${res.status}`);
}

export async function getMemberRehearsals(
  adminToken: string,
  memberId: string,
): Promise<{ id: string; date: string; title: string; attended: boolean; plan: string | null }[]> {
  const res = await fetch(`${BACKEND_URL}/admin/members/${memberId}/rehearsals`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch member rehearsals: ${res.status}`);
  return res.json();
}

export async function createRehearsal(
  adminToken: string,
  data: {
    date: string;
    title: string;
    description?: string;
    location?: string;
    durationMinutes?: number;
  },
): Promise<Rehearsal> {
  const res = await fetch(`${BACKEND_URL}/rehearsals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create rehearsal: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function deleteRehearsal(adminToken: string, rehearsalId: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/rehearsals/${rehearsalId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!res.ok) throw new Error(`Failed to delete rehearsal: ${res.status}`);
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}
