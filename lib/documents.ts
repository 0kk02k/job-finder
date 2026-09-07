// Dokumenten-Designs für Lebenslauf und Anschreiben — bewusst ohne React- oder
// PDF-Imports, damit Settings-Seite, Routen und Tests dasselbe Modul nutzen.
export type DocTemplateId = 'modern' | 'klassisch' | 'kompakt'

export const DOC_TEMPLATES: Array<{ id: DocTemplateId; label: string; description: string }> = [
  {
    id: 'modern',
    label: 'Modern',
    description: 'Sans-Schrift, blaue Akzente, Skill-Chips',
  },
  {
    id: 'klassisch',
    label: 'Klassisch',
    description: 'Serifenschrift, schwarz-weiß, klassische Bewerbung',
  },
  {
    id: 'kompakt',
    label: 'Kompakt',
    description: 'Kleine Schrift, enge Ränder, viel Inhalt auf eine Seite',
  },
]

export const DEFAULT_DOC_TEMPLATE: DocTemplateId = 'modern'

// Ungültige Werte (alter Datenbankstand, fremde Clients) fallen aufs Default
// zurück — die Dokumenten-Routen können damit blind vertrauen.
export function resolveDocTemplate(value: string | null | undefined): DocTemplateId {
  return DOC_TEMPLATES.some((t) => t.id === value) ? (value as DocTemplateId) : DEFAULT_DOC_TEMPLATE
}
