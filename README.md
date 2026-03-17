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
- **Mitgliederübersicht**: Tabelle mit Probenbesuchsstatistik
- **Probenübersicht**: Zu- und Absagen für zukünftige Proben, Anwesenheitszahlen für vergangene Proben – jeweils aufgeschlüsselt nach Stimmlage

## Tech Stack

| Schicht | Technologie |
|---------|-------------|
| Frontend | React 18, TypeScript, Vite, HeroUI, Tailwind CSS |
| Backend | NestJS, TypeScript, Passport (JWT + Passkey) |
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

**Gültige Stimmlagen:** `SOPRAN`, `MEZZOSOPRAN`, `ALT`, `TENOR`, `BARITON`, `BASS`

## Tests

```bash
cd backend
npm test           # Alle Unit-Tests ausführen
npm run test:cov   # Mit Coverage-Report
```

## Admin-CLI

Das Skript `backend/scripts/admin-cli.ts` verwaltet Admin-Benutzer direkt in der Datenbank.

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
| `APP_URL` | URL der Frontend-App (für Magic Links) |
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
| `POST` | `/auth/admin/passkey/challenge` | Passkey-Challenge anfordern |
| `POST` | `/auth/admin/passkey/verify` | Passkey verifizieren |
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
| `GET` | `/admin/members` | Mitgliederübersicht |
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
