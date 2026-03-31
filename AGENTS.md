# AGENTS.md

Agent-focused instructions for this repository. Keep changes small, accurate, and aligned with existing patterns.

## Project overview
- Monorepo with three Node projects.
- `backend/`: NestJS + Prisma + PostgreSQL.
- `frontend/`: React + Vite + Tailwind v4 + HeroUI.
- Repo root `package.json`: Playwright E2E scripts.

## Setup commands

### Local infra (DB + MailHog only)
```bash
docker compose -f docker-compose.dev.yaml up -d
docker compose -f docker-compose.dev.yaml down
```
- MailHog UI: http://localhost:8025

### Full docker stack
```bash
docker compose up -d
docker compose down
```

### Backend (`backend/`)
```bash
npm run start:dev
npm run lint
npm run test
npm run test:cov
npx tsc --noEmit
npm run admin -- <command>
```

### Prisma (`backend/`)
```bash
npx prisma migrate dev --name <name>
npx prisma migrate deploy
npx prisma generate
npx prisma studio
npm run seed
```

### Frontend (`frontend/`)
```bash
npm run dev
npm run build
npm run lint
npm run preview
npx tsc -p tsconfig.app.json --noEmit
```

### E2E (`repo root`)
```bash
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:report
```

## Dev environment tips
- Run `./setup-secrets.sh` before first local startup to generate required `.env*` files and symlinks.
- `cd backend && npm run start:dev` runs `backend/scripts/start-dev-with-lan.cjs`, which auto-runs `prisma generate` and sets LAN-friendly `APP_URL`/`CORS_ORIGINS`.
- Root `tsconfig.json` is for Playwright/E2E files. Frontend app type checks must use `frontend/tsconfig.app.json`.

## Testing instructions
- Backend changes: run `npm run test` in `backend/` (plus focused tests when possible).
- Frontend changes: run `npm run lint` and `npx tsc -p tsconfig.app.json --noEmit` in `frontend/`.
- Browser flow changes: run root Playwright E2E.

## Code style and conventions
- Follow existing TypeScript patterns and keep diffs focused.
- Frontend type imports must respect `verbatimModuleSyntax`.
- Use `import type { ... }` for type-only imports from `frontend/src/types/index.ts`.
- Do not add `tailwind.config.js`; Tailwind v4 is configured in `frontend/src/index.css` (`@import "tailwindcss";`, `@plugin './hero.ts';`).

## Architecture notes

### Auth model
- Member auth is token/code based.
- `POST /auth/magic-link/request` creates:
- `MemberLoginToken.hashedToken` (long-lived member token).
- `MemberLoginCode.hashedCode` (6-digit code, expires after 15 minutes).
- `POST /auth/magic-link/verify-code` consumes code and returns member token.
- `GET /auth/magic-link/verify` validates magic-link token and returns member token.
- Frontend persists member token in Zustand (`chorhub-auth`) and sends it via `X-Member-Token`.
- `MemberTokenGuard` also accepts `Authorization: Bearer <token>`.

- Admin auth is JWT-based.
- Password via local strategy, JWT via `JwtAdminGuard`.
- Successful admin logins are written to `AdminAuditLog` (append-only audit trail with username + IP).

### Attendance model
- `AttendancePlan`: member intent (`CONFIRMED`/`DECLINED`), upserted by `PUT /attendance/plans/:rehearsalId`.
- `AttendanceRecord`: admin-confirmed attendance, replaced by `PUT /attendance/records/:rehearsalId` (delete + create).

### Prisma v7 specifics
- `backend/prisma/schema.prisma` datasource has no `url`.
- Connection uses `PrismaPg` adapter in `backend/src/prisma/prisma.service.ts` with `process.env.DATABASE_URL`.

### API client behavior
- `frontend/src/services/api.ts` sets auth headers via Axios interceptor:
- `Authorization: Bearer <jwt>` when admin session exists.
- `X-Member-Token: <raw>` when member session exists.
- 401 responses clear session and redirect to login.

### Email templates
- Mail templates are in `backend/src/mail/templates/`.
- `backend/nest-cli.json` copies templates into `dist/src` during build.

## Project structure hints
- Backend auth: `backend/src/auth/**`
- Backend attendance: `backend/src/attendance/**`
- Backend Prisma service: `backend/src/prisma/prisma.service.ts`
- Frontend API layer: `frontend/src/services/api.ts`
- Frontend auth store: `frontend/src/store/authStore.ts`
- Shared frontend types: `frontend/src/types/index.ts`

## Safety and change scope
- Prefer minimal, localized edits; avoid repo-wide rewrites unless requested.
- Do not change generated output files unless the task explicitly requires regeneration.
- If a requirement is uncertain, add a short `TODO` note instead of guessing behavior.

## PR checklist
- Keep commits scoped to the requested change.
- Run relevant checks from this file before finishing.
- Update this `AGENTS.md` when workflows or invariants change.
