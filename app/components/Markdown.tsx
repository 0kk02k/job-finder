// Lightweight markdown renderer: headings, bullet lists, paragraphs, **bold**.
// variant="resume" additionally detects plain-text resume structure
// (section titles, sub-headings, hard-wrapped lines from PDF extraction).
const SECTION_TITLE = /^(profil|berufserfahrung|werdegang|(ausgewählte\s+)?projekte|erfahrung|ausbildung|bildung|kenntnisse|fähigkeiten|skills|sprachen|zertifikate|ehrenamt|interessen|referenzen)\b/i

// Häufige HTML-Entities aus Job-Börsen-Feeds (Jooble & Co.) — alles, was im
// deutschsprachigen Fließtext real vorkommt; Unbekannte bleiben stehen.
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–', dash: '-', rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', sbquo: '‚', bdquo: '„',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
  acute: '´', circ: '^', tilde: '~', euro: '€', deg: '°', plusmn: '±',
  copy: '©', reg: '®', trade: '™', middot: '·', bull: '•', laquo: '«', raquo: '»',
}

// Entities dekodieren — benannt und numerisch (dezimal + hex)
function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = parseInt(body.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    if (body.startsWith('#')) {
      const code = parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[body] ?? match
  })
}

// Rohtext aus externen Quellen in sauberen, renderbaren Text überführen:
// Entities dekodieren, Bullet-Zeichen zu Markdown-Listen machen, doppelte
// Leerzeichen (Artefakte gefluteter Absätze) kollabieren, Leerzeilen-Blöcke
// auf einen Absatzumbruch reduzieren.
export function normalizeTextContent(raw: string): string {
  return decodeEntities(raw)
    .replace(/\r\n?/g, '\n')
    .replace(/^[ \t]*[•·▪●‣◦*][ \t]+/gm, '- ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Klickkurzfassung für Listen: erster Absatz, an Wortgrenze gekappt
export function textSnippet(raw: string, max = 220): string {
  const firstParagraph = normalizeTextContent(raw).split('\n')[0]
  if (firstParagraph.length <= max) return firstParagraph
  return firstParagraph.slice(0, max).replace(/\s+\S*$/, '') + '…'
}

// Typische Zwischenüberschriften deutschsprachiger Stellenanzeigen — viele
// Feeds liefern die Anzeige als eine einzige Zeile, in der diese Abschnitte
// als Sätze stecken. Kleingeschrieben verglichen, Doppelpunkt toleriert.
const AD_SECTION_HEADINGS = new Set([
  // Aufgaben
  'ihre aufgaben', 'deine aufgaben', 'ihr aufgabengebiet', 'dein aufgabengebiet',
  'aufgaben', 'ihre challengen', 'deine challengen', 'ihre rolle', 'deine rolle',
  'was sie erwartet', 'was dich erwartet', 'was du machst', 'was sie machen',
  // Anforderungen
  'ihr profil', 'dein profil', 'anforderungen', 'qualifikationen',
  'ihre qualifikationen', 'deine qualifikationen', 'was sie mitbringen',
  'was du mitbringst', 'das bringen sie mit', 'das bringst du mit',
  'sie bringen mit', 'du bringst mit',
  // Angebot / Arbeitgeber
  'wir bieten', 'wir bieten dir', 'wir bieten ihnen', 'das bieten wir',
  'unsere benefits', 'benefits', 'das erwartet sie', 'das erwartet dich',
  'über uns', 'das unternehmen', 'wer wir sind', 'unser angebot', 'vergütung',
])

function asAdHeading(text: string): string | null {
  const bare = text.trim().replace(/:$/, '').trim()
  return AD_SECTION_HEADINGS.has(bare.toLowerCase()) ? bare : null
}

// Satzgrenze: Satzzeichen + Leerraum + Großbuchstabe/Anführungszeichen/Klammer
const SENTENCE_BOUNDARY = /(?<=[.!?;])\s+(?=[A-ZÄÖÜ„“(\d])/

// Überschrift mit Inhalt in einem Satz: „Ihre Aufgaben: Entwicklung von …"
function splitLeadingHeading(sentence: string): { heading: string; rest: string } | null {
  const match = sentence.match(/^([^:.!?]{3,60}):\s+(.+)$/)
  if (!match) return null
  const heading = asAdHeading(match[1])
  return heading ? { heading, rest: match[2] } : null
}

// Gecashte Anzeigen strukturieren: Überschriften isolieren (auch aus der
// Textwand heraus), Wände an Satzgrenzen in Absätze von ~2 Sätzen teilen.
// Gibt Markdown-artige „## "-Zeilen zurück, die MarkdownContent rendert.
export function structureJobDescription(raw: string): string {
  const lines = normalizeTextContent(raw).split('\n')
  const out: string[] = []

  for (const line of lines) {
    if (!line.trim()) {
      out.push('')
      continue
    }

    const headingOnly = asAdHeading(line)
    if (headingOnly) {
      out.push(`## ${headingOnly}`)
      continue
    }

    if (line.length <= 280) {
      out.push(line)
      continue
    }

    // Textwand: Sätze trennen, absorbieren keine Absatzstruktur
    const paragraphs: string[] = []
    let buffer = ''
    for (const sentence of line.split(SENTENCE_BOUNDARY)) {
      const leading = splitLeadingHeading(sentence)
      if (leading) {
        if (buffer.trim()) paragraphs.push(buffer.trim())
        buffer = ''
        paragraphs.push(`## ${leading.heading}`)
        if (leading.rest) buffer = `${leading.rest} `
        continue
      }
      buffer += `${sentence} `
      if (buffer.length > 240) {
        paragraphs.push(buffer.trim())
        buffer = ''
      }
    }
    if (buffer.trim()) paragraphs.push(buffer.trim())
    out.push(paragraphs.join('\n\n'))
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// Short line without trailing punctuation → likely a sub-heading
// (e.g. "Infrastruktur & Server-Management"), not a wrapped paragraph line
function isSubHeading(line: string): boolean {
  return line.length > 2 && line.length <= 60 && !/[.,;:)]$/.test(line)
}

export function MarkdownContent({
  content,
  variant = 'resume',
}: {
  content: string
  variant?: 'resume' | 'chat' | 'description'
}) {
  const lines = content.split('\n').map((l) => l.trim())
  const elements: React.ReactNode[] = []
  let listItems: string[] = []
  let paragraph = ''

  function flushList(key: number) {
    if (listItems.length === 0) return
    elements.push(
      <ul key={`list-${key}`} className="list-disc pl-5 space-y-1 mb-3 text-foreground text-sm last:mb-0">
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    )
    listItems = []
  }

  function flushParagraph(key: number) {
    if (!paragraph) return
    elements.push(
      <p key={`p-${key}`} className="text-foreground text-sm leading-relaxed mb-3 last:mb-0">
        {renderInline(paragraph)}
      </p>
    )
    paragraph = ''
  }

  function flushAll(key: number) {
    flushParagraph(key)
    flushList(key)
  }

  lines.forEach((line, i) => {
    if (!line) {
      flushAll(i)
      return
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      flushParagraph(i)
      listItems.push(line.slice(2))
      return
    }

    if (line.startsWith('### ')) {
      flushAll(i)
      elements.push(<h4 key={i} className="text-sm font-medium text-foreground mt-4 mb-2">{renderInline(line.slice(4))}</h4>)
    } else if (line.startsWith('## ')) {
      flushAll(i)
      elements.push(<SectionHeader key={i} title={line.slice(3)} />)
    } else if (line.startsWith('# ')) {
      flushAll(i)
      elements.push(<h2 key={i} className="text-lg font-medium text-foreground mt-6 mb-3">{renderInline(line.slice(2))}</h2>)
    } else if (variant === 'resume' && SECTION_TITLE.test(line) && line.length <= 60) {
      flushAll(i)
      elements.push(<SectionHeader key={i} title={line} />)
    } else if (variant === 'resume' && isSubHeading(line)) {
      flushAll(i)
      elements.push(<h4 key={i} className="text-sm font-medium text-foreground mt-4 mb-1">{renderInline(line)}</h4>)
    } else {
      // Resume variant: merge hard-wrapped lines back into flowing paragraphs
      // (join directly when the previous line ends with a hyphen).
      // Chat variant: keep one paragraph per line, like the chat log had before.
      flushList(i)
      if (variant === 'chat') flushParagraph(i)
      paragraph = paragraph
        ? paragraph.endsWith('-')
          ? paragraph + line
          : `${paragraph} ${line}`
        : line
    }
  })

  flushAll(lines.length)

  return <div>{elements}</div>
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mt-8 mb-4 first:mt-0">
      <h3 className="flex-shrink-0 text-xs font-semibold uppercase tracking-wider text-accent">
        {renderInline(title)}
      </h3>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

export function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}
