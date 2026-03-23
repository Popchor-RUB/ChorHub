# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Docker (full stack)
```bash
docker-compose up -d          # Start all services (db, backend, frontend, mailhog)
docker-compose down           # Stop all services
```
MailHog web UI (email preview) runs on http://localhost:8025.

### Backend
```bash
cd backend
npm run start:dev             # Dev server with hot reload (also runs prisma generate)
npm run test                  # Run all unit tests
npm run test -- --testPathPattern=auth.service   # Run a single test file
npm run test -- --testNamePattern="magic link"   # Run tests matching a name
npm run test:cov              # Coverage report
npm run lint                  # ESLint + auto-fix
npx tsc --noEmit              # Type-check without emitting
```

### Prisma (run from `backend/`)
```bash
npx prisma migrate dev --name <name>   # Create and apply a new migration
npx prisma migrate deploy              # Apply pending migrations (used in Docker start)
npx prisma generate                    # Regenerate the client after schema changes
npx prisma studio                      # DB browser UI
npx ts-node prisma/seed.ts             # Seed DB (admin user + sample data)
```

### Frontend
```bash
cd frontend
npm run dev                            # Vite dev server on port 5173
npm run build                          # tsc -b + vite build
npm run lint                           # ESLint check
npx tsc -p tsconfig.app.json --noEmit  # Type-check (must use this, NOT bare tsc)
```

## Architecture

### Monorepo layout
No shared root `package.json`. `backend/` and `frontend/` are fully independent Node projects with their own `node_modules`. Docker Compose wires them together at runtime.

### Auth — two independent flows

**Member (magic link):**
- A raw `crypto.randomBytes(32)` token is stored **hashed (SHA-256)** in `Member.loginToken`. The raw token is emailed and never expires.
- The frontend stores the raw token in Zustand (persisted to `localStorage` under key `chorhub-auth`) and sends it as `X-Member-Token: <raw>` on every request.
- `MemberTokenGuard` (`auth/guards/member-token.guard.ts`) hashes the incoming token and does a DB lookup. It populates `request.user = { id, role: 'member', ... }`.

**Admin (password + optional passkey):**
- bcrypt password → Passport local strategy → short-lived JWT returned to client.
- JWT sent as `Authorization: Bearer <token>` header, validated by `JwtAdminGuard`.
- Passkeys use `@simplewebauthn/server`; challenges are held in an in-memory `Map` keyed by `adminId` (not persistent across restarts).
- The frontend `CurrentUser` decorator and `@Public()` decorator live in `auth/decorators/`.

### Attendance — Plans vs. Records
Two separate Prisma models with different semantics:
- `AttendancePlan` — member self-reports intent (CONFIRMED / DECLINED). Upserted via `PUT /attendance/plans/:rehearsalId`.
- `AttendanceRecord` — admin confirms actual presence. Replaced wholesale for a rehearsal via `PUT /attendance/records/:rehearsalId` (bulk delete + create).

### Prisma v7 specifics
`datasource db` in `schema.prisma` has **no `url` field**. The connection string is wired in `prisma.service.ts` using the `@prisma/adapter-pg` driver adapter:
```ts
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
super({ adapter });
```
Always run `npx prisma generate` after schema changes; the `start:dev` script does this automatically.

### Frontend — Tailwind v4 + HeroUI
HeroUI v2 is integrated with Tailwind v4 via CSS plugin syntax in `src/index.css`:
```css
@import "tailwindcss";
@plugin './hero.ts';
@source '../node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}';
```
There is **no** `tailwind.config.js`. Do not revert to a v3-style config.

### Frontend — `verbatimModuleSyntax` constraint
`tsconfig.app.json` sets `"verbatimModuleSyntax": true`. All types exported from `src/types/index.ts` (e.g. `Rehearsal`, `AttendanceResponse`) are `export type` and **must** be imported with `import type { ... }` — a plain `import` will cause a runtime `SyntaxError` in the browser. Always type-check with `tsc -p tsconfig.app.json --noEmit`; the root `tsconfig.json` has `"files": []` and skips source files entirely.

### API layer (`frontend/src/services/api.ts`)
A single Axios instance handles both auth schemes via a request interceptor:
- Admin session present → `Authorization: Bearer <jwt>`
- Member session present → `X-Member-Token: <raw>`

A response interceptor catches 401s and redirects to the appropriate login page.

### Backend unit test pattern
All unit tests use `jest-mock-extended` and a shared helper:
```ts
import { createTestModule } from '../common/test-utils/create-test-module';

const { module, prismaMock } = await createTestModule([MyService]);
```
`createTestModule` substitutes `PrismaService` with a deep mock of `PrismaClient`. Guards are bypassed in controller tests with `.overrideGuard(SomeGuard).useValue({ canActivate: () => true })`.

### Email
`MailService` wraps `@nestjs-modules/mailer` with Handlebars templates located in `src/mail/templates/`. The `nest-cli.json` `assets` config copies the `templates/` directory into `dist/` at build time. In development, all email goes to MailHog (SMTP on port 1025).
