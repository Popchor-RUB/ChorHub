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
- Docker & docker-compose
- Node.js 22+ (für lokale Entwicklung ohne Docker)

### Mit Docker starten

```bash
# Umgebungsvariablen konfigurieren
cp .env.example .env
# .env nach Bedarf anpassen

# Alle Services starten (DB, Backend, Frontend, MailHog)
docker-compose up -d

# Datenbankmigrationen + Seed ausführen (nur einmalig)
docker-compose exec backend npx prisma migrate dev --name init
docker-compose exec backend npm run seed
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- MailHog (E-Mail-Vorschau): http://localhost:8025
- Admin-Login: `admin` / `admin123` (nach Seed)

### Lokale Entwicklung (ohne Docker)

**Backend:**
```bash
cd backend
cp ../.env.example .env
# DATABASE_URL in .env auf lokale PostgreSQL-Instanz anpassen
npm install
npx prisma migrate dev --name init
npm run seed
npm run start:dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

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

## Umgebungsvariablen

| Variable | Beschreibung | Standard |
|----------|--------------|---------|
| `DATABASE_URL` | PostgreSQL Verbindungs-URL | — |
| `JWT_SECRET` | Geheimschlüssel für Admin-JWT | — |
| `SMTP_HOST` | SMTP-Server | `localhost` |
| `SMTP_PORT` | SMTP-Port | `1025` |
| `SMTP_USER` | SMTP-Benutzername | leer |
| `SMTP_PASS` | SMTP-Passwort | leer |
| `MAIL_FROM` | Absender-Adresse | `noreply@chorhub.de` |
| `APP_URL` | URL der Frontend-App (für Magic Links) | `http://localhost:5173` |

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
