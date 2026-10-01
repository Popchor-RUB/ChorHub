# ChorHub

Chororganisations-Webanwendung für die Verwaltung von Probenterminen, Mitglieder-Anwesenheit und allgemeinen Informationen.

## Funktionen

### Mitglieder
- Anmeldung per persönlichem E-Mail-Link (kein Passwort erforderlich)
- Allgemeine Informationen einsehen
- Zu Probenterminen zu- oder absagen

### Admin
- **Mitglieder-Import**: CSV-Upload → automatischer Versand von Einladungslinks
- **Informationsseite**: Markdown-Editor für alle Mitglieder sichtbarer Inhalt
- **Anwesenheit**: Probe auswählen, Mitglieder per Autocomplete suchen, Anwesenheit abhaken
- **Mitgliederübersicht**: Tabelle mit Probenbesuchsstatistik und Filter für deaktivierte Konten
- **Kontosperre**: Tägliche Prüfung um 06:00 Uhr (Europe/Berlin); drei unentschuldigt versäumte Pflichtproben nach dem Beitritt deaktivieren ein Mitglied, sobald für diese Proben Anwesenheit erfasst wurde. Admins können Konten mit optionalem Grund deaktivieren und wieder aktivieren.
- **Probenübersicht**: Zu- und Absagen für zukünftige Proben, Anwesenheitszahlen für vergangene Proben – jeweils aufgeschlüsselt nach Stimmgruppe

## Tech Stack

| Schicht | Technologie |
|---------|-------------|
| Frontend | React 18, TypeScript, Vite, HeroUI, Tailwind CSS |
| Backend | NestJS, TypeScript, Passport (JWT) |
| Datenbank | PostgreSQL 16 + Prisma ORM |
| E-Mail | Nodemailer + Handlebars Templates |
| Container | Docker + docker-compose |

## Schnellstart

### Voraussetzungen
- Docker & Docker Compose (v2.20+)
- Node.js 22+ (für lokale Entwicklung und für `setup-secrets.sh`)

### 1. Secrets generieren

```bash
./setup-secrets.sh
```

Das Skript generiert alle benötigten `.env`-Dateien und Symlinks:

| Datei | Inhalt |
|-------|--------|
| `.env.db` | PostgreSQL-Passwort |
| `.env.backend` | JWT, VAPID-Keys, SMTP, Datenbank-URL |
| `frontend/.env.development` | Vite-Variablen für den Dev-Server |
| `frontend/.env.production` | Vite-Variablen für den Produktions-Build |
| `.env.frontend.dev` | Symlink → `frontend/.env.development` |
| `.env.frontend` | Symlink → `frontend/.env.production` |

### 2a. Lokale Entwicklung

Nur Datenbank und MailHog als Docker-Container starten, Backend und Frontend nativ ausführen:

```bash
# Infrastruktur starten (DB auf Port 5432, MailHog auf Port 8025)
docker compose -f docker-compose.dev.yaml up -d

# Backend (hot-reload)
cd backend
npm install
npx prisma migrate dev --name init  # nur beim ersten Start
npm run seed                         # nur beim ersten Start
npm run start:dev

# Frontend (separates Terminal)
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- MailHog (E-Mail-Vorschau): http://localhost:8025
- Admin-Login: `admin` / `admin123` (nach Seed)

### 2b. Produktions-Stack (Docker)

```bash
# Traefik-Labels konfigurieren (nur einmalig)
cp docker-compose.override.yml.example docker-compose.override.yml
# docker-compose.override.yml nach Bedarf anpassen (Domain, Entrypoints)

# Alle Services starten (DB, Backend, Frontend, MailHog)
docker compose up -d

# Beim ersten Start: Seed ausführen
docker compose exec backend npx ts-node prisma/seed.ts
```

### 2c. Nur Backend-Stack (ohne Frontend)

```bash
docker compose -f backend/docker-compose.yml up -d
```

Startet Datenbank + Backend als eigenständigen Stack ohne Frontend und MailHog.

## Datenstruktur

### CSV-Import Format
```csv
firstName,lastName,email,choirVoice
Anna,Müller,anna@beispiel.de,SOPRAN
Max,Schmidt,max@beispiel.de,BASS
```

**Gültige Stimmgruppen:** `SOPRAN`, `MEZZOSOPRAN`, `ALT`, `TENOR`, `BARITON`, `BASS`

## Tests

```bash
cd backend
npm test           # Alle Unit-Tests ausführen
npm run test:cov   # Mit Coverage-Report
```

### End-to-End-Tests

Der Standardlauf startet einen vollständig isolierten Docker-Stack mit eigener
Datenbank, eigenem Backend, Frontend und MailHog. Dadurch können mehrere Läufe
parallel ausgeführt werden, ohne Testdaten oder Authentifizierungsdateien zu
teilen.

```bash
npm install
npm run test:e2e

# Playwright-Argumente werden weitergereicht
npm run test:e2e -- e2e/auth.spec.ts
npm run test:e2e -- --grep "Admin login"
```

Reports und Traces liegen unter `.e2e-runs/<run-id>/`. Der neueste Report oder
ein bestimmter Lauf kann so geöffnet werden:

```bash
npm run test:e2e:report
npm run test:e2e:report -- <run-id>
```

Für einen bereits laufenden lokalen Entwicklungs-Stack bleiben diese Befehle
verfügbar:

```bash
npm run test:e2e:local
npm run test:e2e:ui
```

## Admin-CLI

Das Skript `backend/scripts/admin-cli.ts` verwaltet Admin-Benutzer und kann alle E-Mail-Vorlagen an Mitglieder versenden.

```bash
cd backend
npm run admin -- <Befehl>
```

| Befehl | Beschreibung |
|--------|--------------|
| `create <Benutzername> [Passwort]` | Neuen Admin anlegen. Wird kein Passwort angegeben, wird ein sicheres Zufallspasswort generiert und ausgegeben. |
| `passwd <Benutzername>` | Passwort ändern. Das neue Passwort wird interaktiv abgefragt (keine Eingabe = Zufallspasswort generieren). Das Passwort erscheint **nicht** in der Shell-History. |
| `delete <Benutzername>` | Admin löschen. |
| `list` | Alle Admins auflisten. |
| `backup [Zielverzeichnis]` | Vollständigen PostgreSQL-SQL-Dump als ZIP speichern; Standard: `backups/` im aktuellen Arbeitsverzeichnis. Dateiname enthält UTC-Datum, Uhrzeit und einen eindeutigen Zusatz. |
| `anonymize` | E-Mail, Vor- und Nachname aller Mitglieder atomar anonymisieren: E-Mail durch SHA-256 ersetzen, Vor- und Nachname jeweils durch SHA-256 von `Vorname Nachname`. Kommentare und Deaktivierungsgründe bleiben unverändert. |
| `invite` | Einladungen an Mitglieder senden, die sich noch nie eingeloggt haben (`lastLoginAt` ist `null`). |
| `invite --all` | Einladungen an **alle** Mitglieder senden, unabhängig vom Login-Status. |
| `mailtemplate <Vorlage> <Mitglied-E-Mail> [Szenario]` | Gespeicherte E-Mail-Vorlage an das angegebene bestehende Mitglied senden. |
| `task reminder` | Erinnerungen für die nächsten sieben Tage sofort ausführen, einschließlich Push und E-Mail-Fallback. |
| `task automatic-disable` | Automatische Deaktivierung wegen drei unentschuldigter Fehlzeiten sofort ausführen. |

`backup` benötigt `pg_dump` (mindestens die PostgreSQL-Version des Servers) und `zip` im PATH; beide sind in den Backend-Docker-Images enthalten. Der SQL-Dump umfasst die vollständige Datenbank einschließlich Anhängen, aber keine clusterweiten Rollen. Nach erfolgreicher Komprimierung wird der unkomprimierte Dump entfernt. Die ZIP-Datei erhält Dateirechte `0600`.

`anonymize` verändert die konfigurierte Datenbank unwiderruflich; vorher `backup` ausführen. Die Hashes sind ungesalzenes SHA-256 der gespeicherten Werte in UTF-8; die E-Mail wird als reine Hex-Zeichenfolge ohne Domain gespeichert. Wiederholte Aufrufe hashen die bereits ersetzten Werte erneut. IDs, Beziehungen, Kommentare und Deaktivierungsgründe bleiben erhalten; `updatedAt` wird aktualisiert. Andere Tabellen (z. B. gespeicherte E-Mails und Deaktivierungsbenachrichtigungen) werden nicht anonymisiert.

`task` verwendet dieselben Regeln und das aktuelle Datum wie die geplanten Läufe. Es versendet echte Erinnerungen bzw. deaktiviert berechtigte Mitglieder und legt Benachrichtigungen an. Wiederholte Erinnerungsläufe können erneut Nachrichten senden. Der Prozess wartet auf die gedrosselte Erinnerungs-E-Mail-Warteschlange und laufende Deaktivierungsbenachrichtigungen; ausstehende Deaktivierungsbenachrichtigungen werden dauerhaft gespeichert und vom Backend weiterverarbeitet. Es werden keine zusätzlichen Cron-Timer gestartet und kein vorheriger Build benötigt.

Beim Versand über `invite`/`invite --all` wird auf maximal **1 E-Mail pro Sekunde** begrenzt und ein Fortschrittsbalken angezeigt.

`mailtemplate` und `invite` verwenden die aktuellen Datenbank-Vorlagen einschließlich angepasstem Betreff und Footer. Fehlende Vorlagen werden aus den Standarddateien ergänzt.

Unterstützte Vorlagen und Szenarien (jeweils erstes Szenario ist Standard):

| Vorlage | Szenarien |
|---------|-----------|
| `invite` | `standard` |
| `magic-link` | `standard` |
| `push-fallback-reminder` | `with-actions`, `without-actions`, `generic-login` |
| `personal-info` | `personal`, `bulk` |
| `member-disabled` | `standard`, `with-reason`, `without-reason` |
| `member-automatically-disabled` | `standard` |
| `admin-member-disabled` | `standard` |

`invite` und `magic-link` erzeugen echte Zugangsdaten; deaktivierte Mitglieder erhalten keine Zugangsdaten. Alle anderen Vorlagen senden Beispieldaten mit dem Namen des Empfängers und ändern weder Mitgliedsstatus noch Anwesenheit. Erinnerungsaktionen enthalten synthetische Vorschau-Links; sie buchen keine Zu- oder Absage. Auch `bulk` und `admin-member-disabled` senden nur an das angegebene Mitglied. Versand benötigt `SMTP_HOST` und die üblichen SMTP-Einstellungen; Kontaktadresse und Footer verwenden `CHOIR_ADMIN_EMAIL` bzw. `APP_URL`.

**Beispiele:**

```bash
# Admin mit generiertem Passwort anlegen
npm run admin -- create alice

# Admin mit eigenem Passwort anlegen
npm run admin -- create alice meinPasswort

# Passwort interaktiv ändern (nicht in History)
npm run admin -- passwd alice

# Admin löschen
npm run admin -- delete alice

# Alle Admins anzeigen
npm run admin -- list

# Einladungen an Mitglieder ohne bisherigen Login senden
npm run admin -- invite

# Einladungen an alle Mitglieder senden
npm run admin -- invite --all

# Deaktivierungsvorlage mit Beispielgrund senden
npm run admin -- mailtemplate member-disabled alex@example.org with-reason

# Persönliche Informationsvorlage senden
npm run admin -- mailtemplate personal-info alex@example.org
```

> **Hinweis:** `DATABASE_URL` muss gesetzt sein (z. B. über `.env.backend`). Im Docker-Betrieb kann der Befehl auch direkt im Container ausgeführt werden:
> ```bash
> docker compose exec backend npm run admin -- list
> ```

## Umgebungsvariablen

Secrets und Konfiguration sind auf mehrere `.env`-Dateien aufgeteilt, die von `setup-secrets.sh` generiert werden. Beispiel-Templates liegen als `*.example`-Dateien im Repository.

**`.env.db`** — nur für den Datenbank-Container:

| Variable | Beschreibung |
|----------|--------------|
| `POSTGRES_USER` | DB-Benutzername |
| `POSTGRES_PASSWORD` | DB-Passwort (generiert) |
| `POSTGRES_DB` | Datenbankname |

**`.env.backend`** — nur für den Backend-Container:

| Variable | Beschreibung |
|----------|--------------|
| `DATABASE_URL` | PostgreSQL Verbindungs-URL |
| `JWT_SECRET` | Geheimschlüssel für Admin-JWT |
| `SMTP_HOST` / `SMTP_PORT` | SMTP-Server |
| `SMTP_USER` / `SMTP_PASS` | SMTP-Zugangsdaten |
| `MAIL_FROM` | Absender-Adresse |
| `CHOIR_ADMIN_EMAIL` | Empfänger der Deaktivierungsbenachrichtigung und Kontaktadresse für gesperrte Mitglieder; vor dem Start setzen |
| `APP_URL` | URL der Frontend-App (für Magic Links) |
| `TRUST_PROXY` | Wert für Express `trust proxy` (z. B. `false`, `true`, `1` oder Proxy-Subnetzliste; Standard: `loopback,linklocal,uniquelocal`) |
| `IS_STAGING` | Aktiviert Staging-Modus (OTP `111111` gültig und Reminder-Mail-Throttling deaktiviert) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web-Push-Schlüssel |
| `VAPID_EMAIL` | Kontakt-E-Mail für Web Push |

**`frontend/.env.production`** — zur Build-Zeit in den Frontend-Container kopiert:

| Variable | Beschreibung |
|----------|--------------|
| `VITE_API_URL` | URL der Backend-API |
| `BASE_PATH` | Basis-Pfad der App (z. B. `/chorhub/`) |

## API-Dokumentation

### Authentifizierung

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| `POST` | `/auth/admin/login` | Admin-Login (Benutzername/Passwort) |
| `POST` | `/auth/magic-link/request` | Magic Link per E-Mail anfordern |
| `GET` | `/auth/magic-link/verify?token=` | Magic Link einlösen |

### Mitglieder-API (Bearer: Magic-Link-Token)

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| `GET` | `/members/me` | Eigenes Profil abrufen |
| `GET` | `/general-info` | Allgemeine Informationen |
| `GET` | `/rehearsals` | Bevorstehende Proben + eigene Rückmeldung |
| `PUT` | `/attendance/plans/:rehearsalId` | Zu-/Absage eintragen |

### Admin-API (Bearer: Admin-JWT)

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| `POST` | `/admin/members/import` | CSV hochladen + E-Mails versenden |
| `GET` | `/admin/members?status=active\|disabled` | Mitgliederübersicht; Standard: aktive Mitglieder |
| `PATCH` | `/admin/members/:id/status` | Mitglied deaktivieren oder wieder aktivieren; optionaler Grund beim Deaktivieren |
| `GET` | `/admin/members/search?q=` | Mitglieder-Autocomplete |
| `GET` | `/admin/members/:id/history` | Anwesenheitshistorie eines Mitglieds |
| `PATCH` | `/general-info` | Allgemeine Informationen aktualisieren |
| `GET` | `/rehearsals/all` | Alle Proben |
| `POST` | `/rehearsals` | Probe anlegen |
| `PATCH` | `/rehearsals/:id` | Probe bearbeiten |
| `DELETE` | `/rehearsals/:id` | Probe löschen |
| `GET` | `/attendance/records/:rehearsalId` | Anwesenheitsliste einer Probe |
| `PUT` | `/attendance/records/:rehearsalId` | Anwesenheit speichern |
| `GET` | `/attendance/overview/future` | Zukünftige Proben Statistik |
| `GET` | `/attendance/overview/past` | Vergangene Proben Statistik |
