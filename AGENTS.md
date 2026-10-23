# AGENTS.md

@/Users/philipp/.codex/RTK.md


# BEFORE ANYTHING ELSE
1. read initial instructions for Serena
2. activate the project in Serena

# GLOBAL INSTRUCTIONS
1. Use the Serena mcp tools where possible.
2. ALWAYS use the caveman skill
3. ALWAYS use rtk
4. To debug the frontend of web applications use the built-in codex browser support
5. When asked to use subagents, ALWAYS make an impelmentation plan with GTP6.1-sol high FIRST and use for the implementation later Luna high subagents.

# GLOBAL CODING GUIDELINES
- Write modular applications consisting out of small files!
    - Create a separate file per class/component
- Do not write code that archives the same function twice


---

Agent-focused instructions for this repository. Keep changes small, accurate, and aligned with existing patterns.

## Project overview
- Monorepo with three Node projects.
- `backend/`: NestJS + Prisma + PostgreSQL.
- `frontend/`: React + Vite + Tailwind v4 + HeroUI.
- Repo root `package.json`: Playwright E2E scripts.

## Workflow
- When changes in `backend/` are made, ensure that unittests still pass (`npm run test`)
- When changes in `frontend/` are made, ensure that `npm run lint` succeeds
- When frontend related changes are necessary ALWAYS use the heroui-react skill and heroui mcp!
- When you are asked to commit something check before if e2e tests from the root directory and unittests from the backend succeed.

## Coding Guidelines
- Follow best practice TypeScript patterns and keep diffs focused.
- Write typesafe TypeScript code.
    - Avoid casts to `unknown` or `any` where possible
- Prefer the usage of hero-ui components in the frontend
- Use i18n in the frontend interface
- Write readable modularized code
    - Avoid code repetitions
    - Do not put multiple classes or react components into a single file
- Prefer readable and maintainable code instead of shorter code, especially in security relevant parts
- When the `prisma.schema` file is changed always do the following
    1. `npx prisma generate`
    2. Write a migration
    3. `npx prisma migrate deploy`
    4. Check if the `seed.ts` file needs to be updated
- Frontend type imports must respect `verbatimModuleSyntax`.
- Use `import type { ... }` for type-only imports from `frontend/src/types/index.ts`.
- Do not add `tailwind.config.js`; Tailwind v4 is configured in `frontend/src/index.css` (`@import "tailwindcss";`, `@plugin './hero.ts';`).

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
- Manual scheduled tasks: `npm run admin -- task reminder` or `npm run admin -- task automatic-disable`. These use current-date scheduled rules and perform real sends/status changes. The isolated runner starts no cron timers and drains reminder mail before closing.
- Admin CLI `backup [output-directory]` creates a dated full SQL dump ZIP (default `backups/`; requires compatible `pg_dump` and `zip`). `anonymize` atomically replaces member emails with SHA-256 and both name fields with SHA-256 of `firstName lastName`; comments, disable reasons, IDs, and relationships remain intact. Other tables are untouched; back up before running, and note repeated runs rehash existing values.

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
- Root `npm run dev` starts or reuses a checkout-specific tmux session with `frontend` and `backend` windows when tmux is installed. It automatically attaches in an interactive terminal or switches clients when already inside tmux; noninteractive runs leave the session detached. It prints attach/switch and stop commands. Missing or exited windows restart on the next run. Without tmux, both servers run in the foreground with shared shutdown handling.
- Run `./setup-secrets.sh` before first local startup to generate required `.env*` files and symlinks.
- `cd backend && npm run start:dev` runs `backend/scripts/start-dev-with-lan.cjs`, which auto-runs `prisma generate` and sets LAN-friendly `APP_URL`/`CORS_ORIGINS`.
- Root `tsconfig.json` is for Playwright/E2E files. Frontend app type checks must use `frontend/tsconfig.app.json`.
- Demo seed members have `createdAt` before the earliest past rehearsal to keep attendance history consistent; rerunning `npm run seed` deletes and recreates demo data.

## Testing instructions
- Backend changes: run `npm run test` in `backend/` (plus focused tests when possible).
- Frontend changes: run `npm run lint` and `npx tsc -p tsconfig.app.json --noEmit` in `frontend/`.
- Mail template E2E tests run in the `admin-mail-templates` project after `admin-auth` to prevent shared template edits from racing other mail tests. Tests restore template contents in `finally`; focused runs may use `--project=admin-mail-templates --no-deps` against an isolated stack.

## Architecture notes

### Auth model
- Member auth is token/code based.
- `POST /auth/magic-link/request` creates:
- `MemberLoginToken.hashedToken` (long-lived member token).
- `MemberLoginCode.hashedCode` (6-digit code, expires after 15 minutes).
- `POST /auth/magic-link/verify-code` consumes code and returns member token.
- `GET /auth/magic-link/verify` validates magic-link token and returns member token.
- Reminder magic links with `rehearsalId` and a valid `response` save the attendance plan and stay on the public verification page to show success or failure. Do not redirect these actions into the member layout or show the iOS install guide automatically; ordinary magic links still open `/proben`.
- Frontend persists member token in Zustand (`chorhub-auth`) and sends it via `X-Member-Token`.
- `MemberTokenGuard` also accepts `Authorization: Bearer <token>`.
- Disabled members cannot request or use magic links/codes or member tokens. Disabling revokes all member login tokens/codes and push subscriptions. `CHOIR_ADMIN_EMAIL` supplies the contact address shown at login and the admin notification recipient.

- Choir voice admin access is granted to existing members through `VoiceAdminGrant` rows, independently of their own choir voice. Admins replace grants through `PUT /admin/members/:id/voice-admin-voices`; `GET /members/me` returns the member's granted voices.
- Voice admin attendance and QR endpoints live under `/attendance/voice-admin/**`. Every member-data read and write checks current grants against the target member's current choir voice. Scoped responses must never include another member's email.
- Each member has one internal comment shared by admins and voice admins. Voice admins may read and edit it only for members in their currently granted choir voices; ordinary member responses never include it.
- Member CSV imports accept an optional `comment` column that sets `internalComment` for new and existing members. Values are trimmed; blank values clear the comment, while omitting the column preserves existing comments.

- Admin auth is JWT-based.
- Password via local strategy, JWT via `JwtAdminGuard`.
- Successful admin logins are written to `AdminAuditLog` (append-only audit trail with username + IP).

### Attendance model
- `AttendancePlan`: member intent (`CONFIRMED`/`DECLINED`), upserted by `PUT /attendance/plans/:rehearsalId`.
- Members can create, change, or delete attendance plans until the rehearsal ends (start plus duration; 120 minutes when duration is absent). At the exact end time, changes are blocked. Ongoing overnight rehearsals remain editable in the member UI after midnight.
- `AttendanceRecord`: admin-confirmed attendance, replaced by `PUT /attendance/records/:rehearsalId` (delete + create).
- Admin and voice-admin member rehearsal rows expose `isUnexcusedAbsence`, calculated by the same backend rule as member overview counts. Use this field for absence totals and row labels; reload rehearsal rows after attendance edits because adding the first or removing the last record changes whether a rehearsal counts. Attendance checklist badges refresh backend overview counts after edits and during polling.
- The daily 06:00 Europe/Berlin disable task counts past, non-optional rehearsals after member creation only when the rehearsal has at least one attendance record. A member without a record and without a `DECLINED` plan has an unexcused absence. Three cumulative absences disable the account; reenabled members keep their history and can be disabled again on the next run.

### Prisma v7 specifics
- `backend/prisma/schema.prisma` datasource has no `url`.
- Connection uses `PrismaPg` adapter in `backend/src/prisma/prisma.service.ts` with `process.env.DATABASE_URL`.

### API client behavior
- `frontend/src/services/api.ts` sets auth headers via Axios interceptor:
- `Authorization: Bearer <jwt>` when admin session exists.
- `X-Member-Token: <raw>` when member session exists.
- 401 responses clear session and redirect to login.

### Settings and member Cloud
- `Settings` is a generic string key/value store. `GET /settings` and `PUT`/`DELETE /settings/:key` require an admin JWT; authenticated members may read only explicitly allowlisted keys through `GET /settings/:key`. Missing keys return a null value. Seed runs preserve settings.
- `cloud.url` is initially the only member-readable key. Its value must be an absolute HTTP/HTTPS URL without embedded credentials; deleting the key clears the Cloud configuration. Other settings may contain empty strings. Add member-readable keys and per-key validators explicitly when extending the store.
- Members always see the Cloud tab. The Cloud iframe fills available viewport space while the top header and mobile bottom navigation remain accessible. External cloud providers must allow framing; ChorHub does not proxy providers or forward its credentials.

### Email templates
- Files in `backend/src/mail/templates/` are startup defaults. Before accepting requests, the backend expands the shared footer into editable default HTML and inserts missing `MailTemplate` rows. For existing rows, startup replaces HTML only when its exact expanded HTML SHA-256 hash is registered for that template; unknown or customized HTML stays intact, and stored subjects are preserved. The hash registry starts with current working-tree defaults only; no older versions are backfilled. `backend/nest-cli.json` copies defaults into `dist/src` during build.
- Admin CLI `mailtemplate <key> <member-email> [scenario]` supports every registered template and scenario using saved database templates. Invite/login sends create real credentials; other templates use synthetic scenario data without changing attendance or member status. All CLI template sends target only the specified existing member.
- Every send renders the current database subject and HTML through the shared mail template renderer with the configured APP_URL. Durable information-mail workers store the rendered subject with the terminal SENT state so archives and job details retain the actual delivered subject. Admin settings edits database rows through JWT-protected `/admin/mail-templates` routes; draft previews use synthetic data and never save or send mail.
- Template keys, supported placeholders, optional context values, and preview scenarios are defined in the backend registry. Add new templates there with a packaged `.hbs` default; keep seed runs from deleting customized templates.
- Admin template previews use backend `APP_URL` and `CHOIR_ADMIN_EMAIL` for configuration placeholders; member details, credentials, and attendance scenarios remain synthetic.
- Reminder response buttons share one presentation-table row with an explicit spacer cell for email-client compatibility.
- When changing a template body or shared footer, run `cd backend && npm run mail:template-hashes -- --append`, then commit the template/footer and generated `src/mail/mail-template-hashes.ts` together. Hashes cover exact UTF-8 expanded HTML only; whitespace changes count. A footer change affects every template that includes it. Run `npm run mail:template-hashes -- --check` to verify registry coverage without writing files.
- Automatic disablement queues member notices with kind `MEMBER_AUTOMATIC` and uses `member-automatically-disabled`; admin disablement queues kind `MEMBER` and uses `member-disabled`. Keep the distinction through retries and restarts; `admin-member-disabled` remains the internal admin notification.
- Manual disablement accepts `notifyMember` (default `true`) and `includeReasonInEmail` (default `false`). The internal reason and admin notification are retained even when member notification is disabled. Member reason disclosure requires the persisted `MemberDisableNotice.includeReasonInEmail` flag; legacy notices default to `false`. Automatic notices keep their existing behavior.
- The `member-disabled` template supports an optional escaped `reason` block. Deploy the notice-sharing migration before the updated backend.
- Admin sends choir information mail through `POST /admin/emails` as one message: `TO CHOIR_ADMIN_EMAIL`, `BCC` distinct active-member addresses (admin excluded). Composer subjects are trimmed but otherwise preserved; no prefix is added or stripped. Admins may configure a prefix through the shared `personal-info` subject template; the default is `{{subject}}`.
- Member creation, updates and CSV imports accept only single bare email addresses, normalized by trimming and lowercasing. Mail delivery validates TO and each BCC entry again; legacy invalid recipients block delivery. Bulk submission reports invalid active-member IDs before queuing. Run `cd backend && npm run audit:member-emails` against the deployment database before the next bulk send, and correct reported addresses through member editing; the audit is read-only and exits with code 1 when invalid values exist. Never split a stored address list into recipients. Queued jobs rejected before SMTP use `FAILED` / `INVALID_RECIPIENT`.
- Email archives preserve the original composer input and the actual rendered subject. Legacy rows without a rendered subject retain the default prefix when read.
- Only successfully sent messages appear in admin and member email archives. Every active member can read the full archive, including messages sent before they joined; attachment downloads use authenticated routes.
- Email attachments are stored with their sent message. Upload limits: 10 files, 5 MB per file, 20 MB total.
- All admin multipart routes use `backend/src/common/multipart-upload-options.ts`: flat text fields only, 100-byte field names, 1 MB per text value, bounded fields/files/parts, and 5 MB per file. Email forms allow 3 text fields/10 files, member import 1 text field/1 file, and personal-information forms 6 text fields/101 files (1 recipients file plus 100 placeholder files). Keep these limits aligned with form fields and cover parser rejection and authentication in HTTP/E2E tests.
- Backend security overrides patch transitive dependencies whose parents still constrain vulnerable releases: Prisma's `deepmerge-ts`/`mysql2`, QR rendering's `file-type`, ExcelJS's `uuid`, and all Nodemailer copies. Recheck overrides when upgrading those parents; preserve Prisma CLI/client/adapter version alignment. Nodemailer 10 includes types, so no `@types/nodemailer` is needed. Normalize backend lockfile changes with Docker's npm 10 (`npm exec --yes --package=npm@10.9.9 -- npm install --package-lock-only`) and verify clean Docker installs.
- Admin bulk and test sends require `Idempotency-Key` and return HTTP 202 after persisting a PostgreSQL-backed job. Admin job status and manual retries live under `/admin/emails/jobs`; test jobs never appear in member or sent-email archives.
- Queued jobs survive restarts. Workers atomically claim jobs, heartbeat ownership, and never automatically retry SMTP delivery. Interrupted or ambiguous sends become `UNKNOWN`; manual retries require duplicate-risk acknowledgement. Retrying HTTP submission with the same key must not create another delivery.
- Deploy the backend and frontend together when changing the email acceptance contract. Verify email job unit tests and the isolated SMTP-fixture E2E scenarios alongside the existing archive tests.

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
