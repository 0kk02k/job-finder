# Interface Design System — Job Finder

## Direction & Feel
Warm, calm "notebook" product: stone neutrals carry the structure, a single ochre accent communicates. Quiet, not loud SaaS. German UI copy.

## Color
- Base: `--background` #faf9f7 (light) / #1c1917 (dark), warm stone.
- Surfaces: `--color-surface`, `--color-surface-elevated` — same hue, only lightness shifts.
- Text hierarchy: `--foreground` → `--color-primary` → `--color-primary-soft` (3 levels).
- **One accent (ochre)**: `--color-accent` #b45309 (light) / #dfa04e (dark) — CTAs, active states (nav underline, filter chips, toggles), focus ring, link hover. `--color-accent-strong` for hover, `--color-on-accent` for text on accent, `--color-accent-soft` for tints.
- Semantic: `--color-success` (score ≥8, Top Match, Angebot), `--color-warning` (Interview, score 6–7), `--color-error` (Abgelehnt, score <6).
- All tokens are mapped in `@theme inline` in `app/globals.css` — use Tailwind utilities (`bg-accent`, `text-primary-soft`, `border-border`), not `var(...)` arbitrary values, in new code.

## Depth Strategy
Borders + subtle `shadow-sm` on cards only. No layered shadows, no gradients. Inputs are `bg-background` (darker/inset) inside `bg-surface` cards.

## Typography & Numbers
- Geist Sans. Headings `font-light` (large) / `font-medium` (small); body 400.
- `tabular-nums` on all dynamic numbers (stats, scores, counters).
- Focus: `:focus-visible` 2px accent outline, offset 2px.

## Spacing & Radius
- 4px base unit. Page container `max-w-5xl px-6 py-16`.
- Radius scale: `rounded-xl` (buttons, inputs, chips container) · `rounded-2xl` (cards) · `rounded-full` (chips, badges, step numbers).

## Component Patterns (`app/components/ui.tsx`)
- `Button` / `ButtonLink` — variants `primary` (accent bg) / `secondary` (border-soft bg); sizes `md` (px-6 py-3) / `sm` (px-4 py-2 text-sm).
- `Card` — `bg-surface rounded-2xl border border-border` + padding via className.
- `StatusBadge` — job-status pill, semantic colors, `px-3 py-1.5 rounded-full text-xs`.
- Filter chips — `text-xs px-3 py-1.5 rounded-full border`, active = accent fill + `aria-pressed`.
- Skeletons — `animate-pulse` blocks matching card layout (used on dashboard + jobs list); no full-screen text loaders.

## Navigation (`app/nav.tsx`)
- Sticky, `bg-surface/80 backdrop-blur-sm`, border-b.
- Active link: `underline decoration-accent decoration-2 underline-offset-8` + `aria-current="page"`.
- Mobile: hamburger (<sm), panel below header, closes on route change.

## Motion
- `transition-colors` (200ms default) on interactive elements only — no global `*` transitions.
- Toasts: slide/fade 300ms, auto-dismiss 4s (`app/components/Toast.tsx`).
