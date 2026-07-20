# Job-Finder

Webapp für Job-Suche und Bewerbungs-Management — gebaut für eine Freundesgruppe.
KI-gestütztes Matching (semantische Suche, Scoring mit transferable Skills),
Job-Tracking über die gesamte Bewerbungs-Pipeline, Resume-Verwaltung mit PDF-Export.

## Features

- **Job-Suche** aus mehreren Quellen (Jooble, Remotive, Arbeitnow; LinkedIn via Apify optional)
  - klassisch (Stichwort/Ort) oder **semantisch** (KI matcht Resume gegen Ergebnisse,
    inkl. transferable Skills — die KI liefert nur Indizes/Scores, URLs kommen immer
    aus den echten Quelldaten)
  - KI-Scoring 1–10 mit Begründung, Stärken und Lücken pro Job
  - **Gespeicherte Suchen** mit „N neue Jobs"-Zähler bei erneutem Lauf
- **Job-Tracking** mit Pipeline-Status: Discovered → Scored → High Match → Applied →
  Interview → Offer (plus Rejected/Archived). Filter, Sortierung und Textsuche in der Liste.
  Re-Suchen überschreiben niemals manuell gesetzte Status (APPLIED etc.)
- **Dashboard** mit echten Stats, Top Matches und „Nächster Schritt"-Hinweis
- **Resume** als Markdown, PDF-Upload mit Text-Extraktion, PDF-Export
  (Resume + Anschreiben pro Job)
- **Profil & Optimierung**: manuelles Profil pro Plattform, KI-Optimierungsvorschläge;
  LinkedIn/XING/StepStone-Sync via Playwright (experimentell, ungetestet)
- **Multi-User-fähig**: Auth (Credentials + JWT-Session), strikte Datentrennung,
  Platform-Zugangsdaten AES-256-GCM-verschlüsselt

## Tech Stack

- Next.js 16 (App Router) + React 19 + Tailwind CSS 4
- Prisma 7 + Postgres (Neon, Serverless-Adapter) — Schema-Sync via `prisma db push`
  (keine Migrations-Historie, siehe STATUS.md)
- Auth: Auth.js v5 (next-auth beta), Credentials + JWT
- KI: AI SDK v7 über OpenAI-kompatible Chat-Completions-Endpunkte —
  Mistral (Default), Ollama (lokal), Gemini, OpenAI, OpenRouter
- Playwright (playwright-extra + stealth) für Profil-Sync

## Setup

Voraussetzungen: Node.js 20+, eine Postgres-Datenbank (z.B. Neon).

```bash
npm install
cp .env.example .env   # siehe unten — Datei ggf. selbst anlegen
npx prisma db push     # Schema in die DB schreiben + Client generieren
npm run dev            # http://localhost:3000
```

### Environment Variables (`.env`)

| Variable | Pflicht | Zweck |
|---|---|---|
| `DATABASE_URL` | ja | Postgres-Connection-String (Neon) |
| `AUTH_SECRET` | ja | Session-JWT + Ableitung des Credential-Encryption-Keys (`openssl rand -base64 32`) |
| `MISTRAL_API_KEY` | ja* | Default-KI-Provider (Server-Fallback, wenn User nichts eigenes setzt) |
| `JOOBLE_API_KEY` | empfohlen | Jooble-Jobquelle (ohne Key nur Remotive/Arbeitnow) |

\* Pro User kann in den **Settings** ein eigener Provider (Mistral/Ollama/Gemini/OpenAI/
OpenRouter) inkl. eigenem Key bzw. Ollama-URL gewählt werden — der greift dann vor den
Server-Defaults. Ollama muss lokal laufen (`localhost:11434`).

## Sicherheit

- Alle API-Routen prüfen die Session und filtern strikt nach `userId` (Audit 2026-07-18,
  Details in STATUS.md)
- Platform-Passwörter werden AES-256-GCM-verschlüsselt gespeichert (`lib/crypto.ts`,
  Key via scrypt aus `AUTH_SECRET`). **AUTH_SECRET nicht rotieren**, sonst sind
  gespeicherte Credentials unlesbar
- `POST /api/jobs` validiert URLs (nur öffentliche http/https-Hosts, SSRF-Schutz)
- Nutzereingaben werden an den Grenzen validiert (zod in Settings, Status-Enum in Jobs)

## Bekannte Einschränkungen

- **Auto-Bewerbung ist deaktiviert** (HTTP 501) — der alte Stand hätte reale Bewerbungen
  mit Platzhalter-Daten verschickt. Wiederaktivierung nur mit echten Profildaten,
  generiertem PDF und expliziter Bestätigung
- **Playwright-Profil-Sync** (LinkedIn/XING/StepStone) ist ungetestet und braucht
  lokal `npx playwright install chromium`; auf Vercel-Serverless nicht lauffähig
- Kein Rate-Limiting (für private Instanz vertretbar, vor öffentlichem Betrieb nachrüsten)
- Kein automatisiertes Testsetup — Verifikation aktuell manuell/E2E per Hand

## Projektstruktur

```
app/                    # Seiten (Dashboard, search, jobs, resume, settings, login/register)
app/api/                # Route Handlers: search, jobs, resume, settings, searches,
                        # platforms (sync/profile/optimize), pdf, autoapply (501), auth
lib/                    # ai.ts (KI), scrapers.ts (Jobquellen), platforms.ts (Sync),
                        # crypto.ts (Credential-Verschlüsselung), pdf*.tsx, prisma.ts
prisma/schema.prisma    # User, Job, Activity, Resume, UserSettings, SavedSearch,
                        # PlatformCredential, PlatformProfile
```

## Dokumentation

- `STATUS.md` — Projektstand, Audit-Ergebnisse (2026-07-18), TODOs, Deploy-Hinweise
- `PLAN.md` — Umsetzungsplan der Experience-Verbesserungen (Stufen 1–7, umgesetzt)
- `AGENTS.md` — Hinweise für Coding-Agents (Next.js 16 weicht von Trainingswissen ab)
