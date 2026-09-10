---
name: Job-Finder
description: Private Job-Suche & Bewerbungs-Management für einen Freundeskreis — ein warmes Feldnotizbuch mit zwei Stiften: Ocker für Handlung, Tinten-Blau für Auswahl und Zustand.
colors:
  paper: "#faf9f7"
  ink: "#1c1917"
  surface: "#ffffff"
  surface-elevated: "#ffffff"
  border: "#e7e5e4"
  border-soft: "#f5f5f4"
  stone: "#57534e"
  stone-soft: "#78716c"
  ochre: "#b45309"
  ochre-deep: "#92400e"
  ochre-tint: "#f0e2cd"
  on-ochre: "#ffffff"
  ink-blue: "#3f5873"
  ink-blue-strong: "#32485f"
  on-ink-blue: "#ffffff"
  moss: "#55724f"
  khaki: "#7d6740"
  clay: "#96553f"
typography:
  display:
    fontFamily: "Geist Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 300
    lineHeight: "1.2"
    letterSpacing: "normal"
  headline:
    fontFamily: "Geist Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 300
    lineHeight: "1.25"
  title:
    fontFamily: "Geist Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: "1.3"
  body:
    fontFamily: "Geist Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.6"
  label:
    fontFamily: "Geist Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.4"
rounded:
  sm: "4px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  page-y: "64px"
  container: "1024px"
components:
  button-primary:
    backgroundColor: "{colors.ochre}"
    textColor: "{colors.on-ochre}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.ochre-deep}"
  button-secondary:
    backgroundColor: "{colors.border-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
    padding: "12px 24px"
  button-secondary-hover:
    backgroundColor: "{colors.border}"
  button-sm:
    rounded: "{rounded.xl}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
  status-badge:
    rounded: "{rounded.full}"
    padding: "6px 12px"
  chip-active:
    backgroundColor: "{colors.ink-blue}"
    textColor: "{colors.on-ink-blue}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
  chip-idle:
    textColor: "{colors.stone}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
  input:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.xl}"
---

# Design System: Job-Finder

## Overview

**Creative North Star: "Das Feldnotizbuch"**

Job-Finder sieht aus wie das Notizbuch, in dem jemand ernsthaft an seiner Zukunft schreibt: warmes Papier, Tinte, gerade noch so viel Struktur, dass man beim Blättern nicht den Faden verliert. Und wie in einem echten Notizbuch gibt es zwei Stifte: einen gebrannten Ocker, der die Handlung anrandert — den einen Button, der weiterführt — und eine blaugeschriebene Tinte, die den Zustand markiert: Auswahl, aktive Filter, Links, wo man gerade ist. Alles andere ist Material, nicht Botschaft. Die App ist ein Arbeitsgerät für eine feste kleine Gruppe, kein Schaufenster: Dichte entsteht durch Inhalt, nicht durch Dekoration, und die einzige Frage, die jede Fläche beantworten muss, ist „Was ist mein nächster Schritt?".

Die Atmosphäre ist ehrlich und ungeschminkt — sie zeigt Lücken, Ablehnungen und fehlende KI-Scores so, wie sie sind, in gedämpften statt schreienden Signalen. Sie ist ruhig: keine Dringlichkeits-Maschinerie, kein Hustle-SaaS-Vokabular, nichts blinkt den Nutzer an. Komponenten sind zurückhaltend-selbstsicher: sie versprechen wenig und halten exakt, was sie versprechen — ein Button ist ein Button, eine Karte ist ein Blatt im Notizbuch.

**Key Characteristics:**
- Zwei Stifte mit exklusiven Rollen: gebrannter Ocker für Handlung, Tinten-Blau für Auswahl/Zustand — beide kommunizieren, keiner dekoriert
- Warmes Steinpapier als Grundmaterial; Karten sind dunklere/hellere Blätter desselben Materials
- Tiefe aus 1px-Kanten und Hell/Dunkel, nicht aus Schatten oder Gradients
- Große Type ist leicht (300), kleine Type ist kräftig (500); alle dynamischen Zahlen tabellarisch
- Deutsche, sachlich-warme Wortwahl in allen Zuständen — auch in Fehlern

## Colors

Die Palette ist ein Werkstoff-Set: warme Steintöne als Papier und Tinte, ein Ocker und ein Tinten-Blau als Werkzeuge, drei gedämpfte Signalfarben für Bedeutung. Jeder Token hat einen Dark-Mode-Partner im selben Farbton (nur Hell/Dunkel verschiebt sich, nie der Charakter):

| Token | Light | Dark |
|---|---|---|
| `paper` / `ink` | `#faf9f7` / `#1c1917` | getauscht |
| `surface` / `surface-elevated` | `#ffffff` / `#ffffff` | `#292524` / `#2d2a28` |
| `border` / `border-soft` | `#e7e5e4` / `#f5f5f4` | `#44403c` / `#292524` |
| `stone` / `stone-soft` | `#57534e` / `#78716c` | `#d6d3d1` / `#9d968f` |
| `ochre` / `ochre-deep` | `#b45309` / `#92400e` | `#dfa04e` / `#ecb668` |
| `ochre-tint` / `on-ochre` | `#f0e2cd` / `#ffffff` | `#5c452a` / `#1c1917` |
| `ink-blue` / `ink-blue-strong` | `#3f5873` / `#32485f` | `#93b2cc` / `#a9c3d9` |
| `on-ink-blue` | `#ffffff` | `#1c1917` |
| `moss` / `khaki` / `clay` | `#55724f` / `#7d6740` / `#96553f` | `#89ab84` / `#b5a077` / `#c99284` |

### Primary (Handlung)
- **Gebrannter Ocker** (`#b45309`, dunkel `#dfa04e`): ausschließlich Handlung und Aufmerksamkeit im Gebrauch — Primär-Buttons und Fokusring, sonst nirgends. Im Dark Mode wird sie heller und wärmer, nicht kräftiger — derselbe Bleistift bei Kerzenlicht.

### Selection (Auswahl/Zustand)
- **Tinten-Blau** (`#3f5873`, dunkel `#93b2cc`, Hover `#32485f`/`#a9c3d9`): der zweite Stift — alles, was einen Zustand markiert statt eine Aktion auslöst: aktive Filter-Chips, aktive Segmente, gesetzte Checkboxen, Text-Links, die aktive Nav-Unterlinie, der aktuelle Schritt. Entsättigt und petrol geneigt, damit es im warmen Heft bleibt und nicht nach SaaS schmeckt. Im Dark Mode heller, nie kräftiger.

### Neutral
- **Warm Stone Papier** (`#faf9f7`): Seitenhintergrund, Input-Füllung (inset in Karten).
- **Tusche** (`#1c1917`): Primärtext und dunkler Modus als Hintergrund.
- **Blatt Weiß** (`#ffffff`): Karten und Nav-Fläche (`bg-surface`), mit Blur über dem Inhalt.
- **Haarkante** (`#e7e5e4`) und **Papiernaht** (`#f5f5f4`): 1px-Borders erster und zweiter Ordnung; Papiernaht ist auch die Sekundär-Button-Füllung.
- **Stein** (`#57534e`) und **Weicher Stein** (`#78716c`): Sekundär- und Tertiärtext — Hierarchie über drei Textstufen, nie über Grau-Willkür.

### Semantic (Muted Signals)
- **Moos** (`#55724f`): Erfolg — Score ≥ 8, „Top Match", „Angebot".
- **Khaki** (`#7d6740`): Vorwarnung — „Interview", Score 6–7.
- **Ton** (`#96553f`): Abgeschminkt — „Abgelehnt", Score < 6. Ein warmes, nicht feueriges Rot.

### Named Rules
**The One Role Per Color Rule.** Eine Farbe, eine Rolle: Ocker löst aus (CTA, Fokus), Tinten-Blau markiert Zustand (Auswahl, aktive Filter, Links, aktive Nav), semantische Farben bedeuten (Score, Pipeline-Status). Keine Farbe leiht sich die Rolle der anderen — wer eine Fläche setzt, fragt zuerst: Handlung, Zustand oder Bedeutung? Seltenheit bleibt die Aussage beider Stifte; zusammen machen sie auch in filterreichen Toolbars nur einen kleinen Bruchteil der Fläche aus.

**The Honest Signal Rule.** Bedeutung wird gedämpft ausgedrückt: semantische Farben erscheinen als 10%-Tint-Fläche mit 20%-Border, nie als Vollfläche. Ein „Abgelehnt" darf lesbar sein, ohne den Nutzer anzuschreien.

## Typography

**Display & Body Font:** Geist Sans (über `next/font`, Fallbacks: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`)
**Mono Font:** Geist Mono (nur wo Maschinenwerte gezeigt werden)

**Character:** Eine nüchterne Grotesk mit warmer Führung — weniger Autoritäts-Font, mehr sauber geschriebenes Heft. Die Spannung liegt in den Gewichten, nicht in den Größen: groß und leicht wirkt ruhig, klein und kräftig wirkt verlässlich.

### Hierarchy
- **Display** (300, 2.25rem): Stat-Zahlen (`text-4xl font-light tabular-nums`) — die leisesten lautsten Werte der App.
- **Headline** (300, 1.875rem): Seiten- und Sektionsköpfe.
- **Title** (500, 1.5rem): Karten-Gruppentitel.
- **Body** (400, 1rem, Zeile 1.6): Fließtext, Job-Beschreibungen.
- **Label** (500, 0.875rem): Nav-Links, Buttons, Badges (`text-xs`, 0.75rem) — klein, aber standfest.

### Named Rules
**The Light-at-Scale Rule.** Je größer die Type, desto leichter das Gewicht (Display 300), je kleiner, desto kräftiger (Label 500). Keine fetten Überschriften, keine dünnen Buttons.

**The Tabular Numbers Rule.** Jede dynamische Zahl — Stats, Scores, Zähler — trägt `tabular-nums`. Zahlen sind Messwerte, keine Textur.

## Layout

Eine zentrierte Einzel-Spalte (max. 1024px) mit 24px Seitenrand und 64px Vertikalatmen — ein Schreibtisch, kein Dashboard-Grid. Dichte entsteht innerhalb der Karten, nie durch mehr Spaltenbreite. Das Raster ist der 4px-Basiswert. Sticky Nav (64px-Bereich, `py-5` 20px) mit `backdrop-blur` über dem Inhalt; ab 640px (`sm`) klappt sie auf ein Hamburger-Menü mit vollem Panel. Sektionen folgen aufeinander mit großzügigen `mb`-Abständen (32–64px), Karteninhalte atmen mit 24px Padding.

**The 1024px Desk Rule.** Die Canvas bleibt ein Schreibtisch (max-w-5xl). Mehr Inhalt bedeutet mehr Karten in der Spalte, keine breitere Spalte.

## Elevation & Depth

**Kanten statt Schatten.** Tiefe entsteht durch 1px-Borders (Haarkante auf Blatt Weiß, Papiernaht auf Papier) und durch Hell/Dunkel-Unterschiede desselben warmen Steins — Karten sind dickere Blätter, keine schwebenden Panelen. Ein einziger hauchfeiner Schatten (`shadow-sm`, `0 1px 2px rgb(0 0 0 / 0.05)`) darf auf Cards liegen; es gibt keine gestapelten Schatten, keine Gradients, keine Glow-Effekte. Das einzige „Leuchtende" im System ist der Fokus: 2px-Ocker-Outline mit 2px Offset (`:focus-visible`) — Sichtbarkeit als Funktion, nicht als Zierat.

### Named Rules
**The Edge Rule.** Wenn eine Fläche angehoben werden soll, bekommt sie eine Kante oder eine Hell/Dunkel-Stufe — keinen Schatten. `shadow-sm` ist ein Hauch, kein Hebel, und nur auf Cards zulässig.

**The Focus Is Bright Rule.** Der Fokusring ist der einzige emissive Moment der UI und immer Ocker. Kein Element darf in Ruhe mehr Aufmerksamkeit beanspruchen als der Fokus im Gebrauch.

## Shapes

Drei Radien erzählen eine Hierarchie: Karten sind Blätter mit weicher Ecke (16px), Buttons, Inputs und Chip-Container sind Handgriffe mit festerer Ecke (12px), Chips, Badges und Step-Nummern sind Etiketten (rund, 9999px). Alles ist Kante, nichts ist abgeschrägt oder verschachtelt geschichtet. Der Scrollbalken ist mit 8px und 4px-Radius am Materialsystem angeschlossen (Haarkante, Hover in Weichem Stein).

## Components

### Buttons
Zurückhaltend-selbstsicher: Primär ist die eine Ocker-Fläche im Viewport, Sekundär ist Papiernaht mit Tusche-Text.
- **Shape:** weiche Handgriff-Ecke (12px), kein Schatten.
- **Primary:** Ocker-Fläche mit Weiß-Text (`#ffffff`), Padding 12×24px, Gewicht 500; Hover in Ocker-Deep.
- **Secondary:** Papiernaht-Fläche (`#f5f5f4`) mit Tusche-Text, gleiche Geometrie; Hover in Haarkante.
- **Sizes:** md 12×24px, sm 8×16px mit 0.875rem.
- **Focus:** globaler Ocker-Ring (`:focus-visible`), nie ein Browser-Outline.
- **Übergänge:** `transition-colors` — Farbe wechselt, Geometrie tanzt nicht.

### Chips
Etiketten mit Filter-Funktion, `aria-pressed` als Pflicht.
- **Style:** rund (9999px), 6×12px, 0.75rem, 1px-Border in Haarkante, Stein-Text.
- **State:** aktiv = Tinten-Blau-Fläche mit Weiß-Text (dunkel: Tusche-Text); inaktiv = transparent mit Stein-Text. Border-los in beiden Fällen? Nein — inaktiv zeigt die Haarkante, aktiv braucht sie nicht.

### Status Badges (Signature)
Der beschreibende Kern der App: acht deutsche Status-Pills, die Bedeutung über gedämpfte Tints tragen (`px-3 py-1.5`, 0.75rem, 500).
- **Struktur:** 10%-Tint-Fläche, 20%-Border derselben Farbe, Vollton-Text.
- **Zuordnung:** Top Match & Angebot → Moos; Interview → Khaki; Abgelehnt → Ton; Beworben → Ocker-Tint mit Tusche-Text; Entdeckt/Bewertet/Archiviert → neutraler Papiernaht/Haarkante.

### Cards / Containers
- **Corner Style:** 16px Blatt-Ecke.
- **Background:** Blatt Weiß; in Dark Mode dunkler Stein.
- **Shadow Strategy:** nur `shadow-sm` als Hauch (siehe Elevation).
- **Border:** 1px Haarkante.
- **Internal Padding:** 24px; Inputs darin liegen inset auf Papier, nicht auf Weiß.

### Inputs / Fields
- **Style:** Papier-Füllung (inset-Gefühl innerhalb der Karte), 1px-Border, 12px Radius.
- **Focus:** Ocker-Ring; kein Glow, kein Farbwechsel des Feldes.

### Navigation
Sticky Leiste aus Blatt Weiß mit 80%-Opazität und Blur, darunter Inhalt sichtbar. Links sind Label (0.875rem, 500): inaktiv Weicher Stein mit Hover zu Tusche, aktiv Tusche mit 2px-Tinten-Blau-Unterlinie (offset 8px) und `aria-current="page"` — „wo bin ich" ist Zustand, also der blauen Tinte. Abmelden ist ein Textlink, kein Button. Mobil: 40px-Icon-Button (12px Radius), Panel mit vollem Link-Set.

## Do's and Don'ts

### Do:
- **Do** Ocker nur für Handlung verwenden: CTA und Fokus. Zustand und Auswahl (aktive Chips, Checkboxen, Links, aktive Nav) tragen Tinten-Blau.
- **Do** alle Status- und Score-Farben als 10%-Tint mit 20%-Border und Vollton-Text setzen.
- **Do** `tabular-nums` auf jede dynamische Zahl (Stats, Scores, „N neue Jobs").
- **Do** Shared Components nutzen (`app/components/ui.tsx`: `Button`, `ButtonLink`, `Card`, `StatusBadge`) statt Class-Strings zu kopieren.
- **Do** Tailwind-Utilities auf die `@theme inline`-Tokens (`bg-accent`, `text-primary-soft`, `border-border`) statt `var(...)`-Arbitrary-Values.
- **Do** deutsche, sachlich-warme Copy — auch in Fehlern („Nicht authentifiziert", kein „Oops!").

### Don't:
- **Don't** den Rollen der beiden Stifte mischen — kein Tinten-Blau auf CTA-Buttons, kein Ocker auf Auswahl-Zuständen, keine dritte kommunizierende Farbe (kein grüner Success-Button, kein Regenbogen in der Nav).
- **Don't** Gradients, gestapelte Schatten oder Glow-Effekte verwenden — Tiefe kommt aus Kanten und Hell/Dunkel.
- **Don't** `alert()` oder Browser-Dialoge — Feedback läuft über das Toast-System.
- **Don't** fette (≥600) Überschriften oder dünne Button-Texte — das Gewichtsgefälle ist 300 groß / 500 klein.
- **Don't** `dark:`-Tailwind-Klassen verwenden — Dark Mode läuft ausschließlich über die `prefers-color-scheme`-Tokens in `app/globals.css`.
- **Don't** semantische Vollflächen (z. B. rote Badges) — Bedeutung bleibt gedämpft.
