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
