// Lightweight markdown renderer: headings, bullet lists, paragraphs, **bold**.
// variant="resume" additionally detects plain-text resume structure
// (section titles, sub-headings, hard-wrapped lines from PDF extraction).
const SECTION_TITLE = /^(profil|berufserfahrung|werdegang|(ausgewählte\s+)?projekte|erfahrung|ausbildung|bildung|kenntnisse|fähigkeiten|skills|sprachen|zertifikate|ehrenamt|interessen|referenzen)\b/i

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
  variant?: 'resume' | 'chat'
}) {
  const lines = content.split('\n').map((l) => l.trim())
  const elements: React.ReactNode[] = []
  let listItems: string[] = []
  let paragraph = ''

  function flushList(key: number) {
    if (listItems.length === 0) return
    elements.push(
      <ul key={`list-${key}`} className="list-disc pl-5 space-y-1 mb-3 text-[var(--color-foreground)] text-sm last:mb-0">
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
      <p key={`p-${key}`} className="text-[var(--color-foreground)] text-sm leading-relaxed mb-3 last:mb-0">
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
      elements.push(<h4 key={i} className="text-sm font-medium text-[var(--color-foreground)] mt-4 mb-2">{renderInline(line.slice(4))}</h4>)
    } else if (line.startsWith('## ')) {
      flushAll(i)
      elements.push(<SectionHeader key={i} title={line.slice(3)} />)
    } else if (line.startsWith('# ')) {
      flushAll(i)
      elements.push(<h2 key={i} className="text-lg font-medium text-[var(--color-foreground)] mt-6 mb-3">{renderInline(line.slice(2))}</h2>)
    } else if (variant === 'resume' && SECTION_TITLE.test(line) && line.length <= 60) {
      flushAll(i)
      elements.push(<SectionHeader key={i} title={line} />)
    } else if (variant === 'resume' && isSubHeading(line)) {
      flushAll(i)
      elements.push(<h4 key={i} className="text-sm font-medium text-[var(--color-foreground)] mt-4 mb-1">{renderInline(line)}</h4>)
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
      <h3 className="flex-shrink-0 text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
        {renderInline(title)}
      </h3>
      <div className="flex-1 h-px bg-[var(--color-border)]" />
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
