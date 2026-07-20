# Job-Finder - Projektstand

## Was ist das?

Eine Webapp für Job-Suche und Bewerbungs-Management, konvertiert von einer CLI-autoapp-App für Freunde.

**Features:**
- Job-Suche mit KI (semantisches Matching, transferable Skills)
- Profil-Sync von LinkedIn, XING, StepStone
- KI-gestützte Profil-Optimierung
- Job-Tracking (Status pro Job)
- Resume-Management (Markdown)
- Indeed/Glassdoor Integration (Jobsuche, Company-Info)

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4
- **Backend:** Next.js API Routes
- **DB:** Prisma 7 + SQLite (lokal) - muss für Vercel auf Postgres
- **Scraping:** Playwright (LinkedIn, XING, StepStone)
- **KI:** Ollama (lokal), Gemini, OpenRouter (AI SDK v7)

## Projektstruktur

```
job-finder/
├── app/
│   ├── page.tsx              # Dashboard
│   ├── search/page.tsx       # Job-Suche UI
│   ├── jobs/page.tsx         # Job-Liste
│   ├── resume/page.tsx       # Resume-Editor
│   ├── settings/page.tsx     # Einstellungen + Platform Credentials
│   └── api/
│       ├── search/           # KI-Jobsuche
│       ├── jobs/             # Job CRUD
│       ├── resume/           # Resume CRUD
│       ├── settings/         # User Settings
│       └── platforms/
│           ├── sync/          # LinkedIn/XING/StepStone Sync
│           └── optimize/      # KI-Profiloptimierung
├── lib/
│   ├── platforms.ts          # Platform-Integration (Scraping, KI)
│   ├── scrapers.ts           # Job-Scraping
│   ├── autoapply.ts          # Auto-Bewerbung (TODO)
│   ├── ai.ts                 # KI-Hilfsfunktionen
│   └── prisma.ts             # DB Client
└── prisma/
    └── schema.prisma         # DB Schema
```

## Aktuelle Implementierung

### ✅ Fertig

- **Dashboard** mit Welcome-Section, Stats, Quick-Start
- **Job-Suche** mit KI-Matching (semantisch, transferable Skills)
- **Job-Tracking** (Status: Discovered, Scored, High Match, Applied, Interview, Offer, Rejected, Archived)
- **Resume** (Markdown-Editor, Vorschau)
- **Settings** (AI-Provider, Job-Präferenzen)
- **Platform Credentials** (LinkedIn, XING, StepStone)
- **UI/UX** überarbeitet (ruhige, warme Farben, angenehm für lange Sessions)

### ⚠️ Teilweise

- **LinkedIn/XING/StepStone Sync** (Playwright-Scraping implementiert, aber ungetestet)
- **Indeed/Glassdoor** (API-Routen vorhanden, UI als Info-only)
- **KI-Optimierung** (API fertig, Frontend UI fehlt)

### ❌ TODO

- Profil-Optimierung UI (`/api/platforms/optimize` Frontend)
- Auto-Bewerbung (`lib/autoapply.ts` ist leer — API-Endpunkt aktuell bewusst deaktiviert, siehe unten)
- 2FA-Unterstützung für Platform-Sync
- Rate-Limiting auf Auth- und KI-Routen

## Audit & Fixes (2026-07-18)

**Sicherheit:**
- `/api/jobs/[id]` hatte keinerlei Auth (IDOR) — jetzt Session + Ownership-Check
- `/api/autoapply` GET leakte Activities aller User — gefixt; POST deaktiviert (501), weil er reale Bewerbungen mit Fake-Daten ("Max Mustermann") verschickt hätte
- Platform-Passwörter werden jetzt AES-256-GCM-verschlüsselt gespeichert (`lib/crypto.ts`, Key aus `AUTH_SECRET`). **Alt-Datensätze mit Klartext-Passwort: Zugangsdaten in den Settings neu eingeben!**
- `GET /api/platforms/sync` sendet `encryptedPassword` nicht mehr ans Frontend
- IDOR in `/api/pdf` gefixt, Mass-Assignment in `PUT /api/settings` gefixt (zod-Whitelist), SSRF-Guard in `POST /api/jobs`, E-Mail-Normalisierung bei Login/Registrierung
- `Job.url` / `PlatformCredential` / `PlatformProfile`: Unique-Constraints jetzt pro User (`@@unique([userId, ...])`) — vorher überschrieben sich Freunde gegenseitig Jobs. DB ist via `prisma db push` auf Neon synchronisiert (alte SQLite-Migrationen waren ungültig und wurden entfernt; Workflow bleibt `db push`)

**Kernfunktion Suche:**
- Semantische Suche: KI liefert nur noch Indizes + Scores, URLs kommen aus den echten Scraping-Daten (vorher halluzinierte die KI Job-URLs in die DB)
- KI-Fallback: bei leerem KI-Ergebnis fällt die Suche jetzt auf die klassische Suche zurück (vorher: 0 Ergebnisse)
- User-KI-Settings (Provider/Modell/Keys/Ollama-URL) werden bei der Suche tatsächlich verwendet; Settings-UI hat dafür jetzt Felder
- KI-Ausfall wird nicht mehr als "5/10"-Score angezeigt (score = null); Scoring auf 15 Jobs pro Suche begrenzt; `useAI` und `remote`-Filter funktionieren jetzt
- AI SDK: `ai.chat()` statt Default-Responses-API — Mistral/Ollama/Gemini/OpenRouter haben nur Chat-Completions, alle KI-Calls schlugen mit "Not Found" fehl (E2E-Test mit echtem Mistral verifiziert)
- Re-Suche promoted Jobs von DISCOVERED/SCORED → HIGH_MATCH, ohne APPLIED/INTERVIEW/etc. zu überschreiben
- `Job.matchDetails` (JSON) speichert strengths/gaps/transferableSkills zum Score

**UI:**
- Job-Detailseite lud ewig (Next-16: `params` ist Promise) — gefixt, mit echten Fehler-States
- Suche/Jobs: HTTP-Fehler und "0 Ergebnisse" werden angezeigt statt stumm leerer Liste; 401 → Redirect zu /login
- Dashboard-Stats zeigen echte Zahlen statt hardcodierter 0

**Bekannte Restpunkte:**
- `dev.db` war ins Git committed (bcrypt-Hashes!) — ist jetzt in `.gitignore`, muss aber noch aus dem Tracking: `git rm --cached dev.db` (History ggf. säubern, Passwörter rotieren)
- Playwright-Sync (LinkedIn/XING/StepStone) weiterhin ungetestet
- ~20 pre-existing Lint-Fehler (`no-explicit-any` in lib/platforms.ts, lib/autoapply.ts, lib/pdf*.ts)
- Build (`npm run build`) und Typecheck sind sauber

## Vercel Deploy - Was fehlt?

### Blocker für Vercel:

1. **Playwright auf Vercel Serverless**
   - Timeout: 10-60s (Scraping kann länger dauern)
   - Memory: Limits (Playwright braucht ~500MB+)
   - Lösung: Separate Worker-App (Railway/Render) oder `@vercel/playwright`

2. **Prisma SQLite → Postgres**
   - SQLite auf Vercel = concurrent request Probleme
   - Lösung: Vercel Postgres oder `@prisma/adapter-pulse`

3. **Environment Variables**
   - `.env` lokal muss in Vercel Dashboard
   - `DATABASE_URL`, AI-Keys, etc.

4. **Playwright Binaries**
   - `npx playwright install chromium` vor Build

## Wie weitermachen?

### Option 1: Vercel (Serverless)
```bash
# Prisma Schema ändern
# provider = "sqlite" → "postgresql"
# DATABASE_URL setzen (Vercel Postgres)
# Playwright binaries installieren
npm install @playwright/test
npx playwright install chromium
# Deploy
vercel deploy
```

### Option 2: Railway/Render (Docker)
- Playwright läuft besser in Docker
- SQLite kann bleiben (oder Postgres)
- Einfacher für Scraping-Use-Cases

### Option 3: Hybrid
- Frontend auf Vercel
- Scraping/Worker auf Railway
- Webhook-basierte Kommunikation

## Git Stand

- Branch: `main` (clean)
- Letzte Änderungen: UI/UX Overhaul, Platform Credentials, XING/Indeed/Glassdoor
- Nicht committed: `.env` (sensitive), `dev.db` (lokal)

## Nächste Schritte (wenn weitergemacht wird)

1. **Vercel ready machen:**
   - Prisma Schema auf Postgres ändern
   - Env vars in Vercel Dashboard setzen
   - Playwright installieren
   - Test-Deploy

2. **Features vervollständigen:**
   - Profil-Optimierung UI
   - Auto-Bewerbung implementieren
   - Password-Encryption

3. **Testing:**
   - Playwright-Scraping testen
   - KI-Integration testen (Ollama lokal läuft?)
   - End-to-End Flow testen

## Notes für Freunde

- **Ollama:** Läuft lokal auf `localhost:11434` - muss gestartet sein für KI-Features (Alternativ: Mistral-Key in `.env`, Default)
- **Credentials:** Werden seit 2026-07-18 AES-256-GCM-verschlüsselt gespeichert — alte Einträge bitte neu eingeben
- **Playwright:** Kann mit Anti-Bot Measures Probleme haben (Stealth-Plugin eingebunden)

---

Stand: 2026-07-18 (Audit + Security-/Kernfunktions-Fixes, Build sauber, Vercel Deploy noch nicht ready)
