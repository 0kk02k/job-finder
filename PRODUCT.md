# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Geschlossener Freundeskreis der Builderin/des Builders (mehrere Personen, private Instanz, deutschsprachig). **Gemischte Berufe und Karrierephasen** — keine Nischen-Annahme (nicht nur Tech): sehr unterschiedliche Resumes, Zielrollen und Erfahrungslevel müssen gleichwertig funktionieren. Situation: aktive Jobsuche parallel zum Alltag; die großen Portale (LinkedIn, StepStone, Xing) werden trotzdem weiter benutzt — Job-Finder ist das Werkzeug darüber.

## Product Purpose

Web-App für Job-Suche und Bewerbungs-Management: Suche über mehrere Quellen (Jooble, Remotive, Arbeitnow, optional LinkedIn via Apify), KI-semantisches Matching gegen das eigene Resume (inkl. transferable Skills, Score 1–10 mit Stärken/Lücken), Pipeline-Tracking (Discovered → … → Offer), Resume-Verwaltung (Markdown, PDF-Upload/-Export inkl. Anschreiben pro Job) und Interview-Training (HR-Interview-Chat mit Resume-Kontext). Sie existiert, weil die Portale generisch sind; **Erfolg heißt: unsere Werkzeuge — Matching, Unterlagen, Interview-Vorbereitung — sind messbar besser als das, was die Großen bieten.**

## Positioning

Privates Multi-User-Werkzeug für eine feste kleine Gruppe, ohne kommerzielles Interesse: die KI arbeitet auf dem echten eigenen Resume (liefert nur Indizes/Scores, Job-URLs kommen immer aus echten Quelldaten — nichts Halluziniertes landet in der DB), das Tracking gehört vollständig dem Nutzer, und aus denselben Resume-Daten wird ein Interview-Training. Ein Portal kann „ehrliches Matching für unseren Kreis, keine Datenweitergabe, kein Verkaufsdruck" nicht wahrheitsgemäß kopieren.

## Operating Context

- Deutsche UI-Texte durchgängig; private Vercel-Instanz + Neon-Postgres; Schema-Sync via `prisma db push`.
- Jeder Nutzer kann in den Settings einen eigenen KI-Provider hinterlegen (Default Mistral; Ollama lokal, Gemini, OpenAI, OpenRouter) — KI-Features hängen an diesen Keys.
- Nutzung parallel zu LinkedIn/StepStone/Xing; gespeicherte Suchen mit „N neue Jobs"-Zähler sind der Wiederkomm-Anlass.
- Resumes leben als Markdown in der DB; PDFs entstehen on demand (`/api/pdf`, react-pdf).

## Capabilities and Constraints

**Fähigkeiten:** Suche klassisch + semantisch; gespeicherte Suchen; Job-CRUD + Ignore; Status-Pipeline mit Filtern/Sortierung; Dashboard mit Stats, Top Matches, „Nächster Schritt"; Resume-Editor/-Upload/-Export; Interview-Chat mit Resume-Kontext; Settings pro Nutzer (Provider, Präferenzen, minSalary); Multi-User mit strikter Datentrennung.

**Grenzen (bewusst):** Auto-Bewerbung deaktiviert (HTTP 501 — nie wieder reale Bewerbungen mit Platzhalterdaten); Platform-Sync (LinkedIn/XING/StepStone via Playwright) experimentell/ungetestet; kein Rate-Limiting (Private-Instanz-Trade-off); kein automatisiertes Testsetup; semantisches Scoring auf 15 Jobs pro Suche begrenzt; `AUTH_SECRET` leitet zugleich den Credential-Verschlüsselungs-Key ab und wird nicht rotiert.

**Offen/entschieden-noch-nicht:** Interview-Auswertung als PDF (geplant, nächstes Feature); Nebius als KI-Provider (geplant, löst Mistral-Default ab); kleiner KI-Chatbot (Idee); 2FA für Platform-Sync (offen).

## Brand Commitments

- Name: **Job-Finder**.
- Stimme: deutsch, sachlich-warm, ohne Hustle-Culture-Diktion; ehrliche Fehlermeldungen statt Marketing (aus dem Repo bestätigt: „ehrliche Landing Page", Score `null` statt erfundener 5/10 bei KI-Ausfall).
- Incumbent-Designrichtung ist in `.interface-design/system.md` dokumentiert (warmes Stone-Neutral, ein Ocker-Akzent, „quiet notebook") — verbindliche Referenz für Verfeinerung, nicht für init.

## Evidence on Hand

- Echte Nutzungsdaten in Neon (Stand 2026-09-02): 1 User, 188 Jobs, 1 Resume.
- Projektdoku mit Audits/E2E-Verifikation: `README.md`, `STATUS.md`, `PLAN.md`.
- Dokumentiertes Design-System: `.interface-design/system.md`; Shared Components: `app/components/ui.tsx`.
- **Nicht vorhanden und nie erfinden:** Testimonials, Benchmarks, Nutzerzahlen-Claims, Presse.

## Product Principles

1. **Gegründete KI statt Halluzination** — Einschätzungen immer auf Basis des echten Resumes; Inhalte/URLs aus echten Quelldaten.
2. **Ehrlichkeit über Schönreden** — ehrliche Scores und Lücken, sichtbare Fehler, keine erfundene Zahl, wenn die KI ausfällt.
3. **Der Nutzer behält die Kontrolle** — nichts wird automatisch abgeschickt oder überschrieben; manuelle Status gewinnen gegen Automation.
4. **Wiederkommen muss sich lohnen** — gespeicherte Suchen, „N neu", „Nächster Schritt": die App muss beim nächsten Öffnen sofort Fortschritt anbieten.
5. **Kleine Gruppe, echte Daten** — Freundeskreis-Skalierung, deutsche Sprache, Resumes aller Berufe gleichwertig ernst genommen.
