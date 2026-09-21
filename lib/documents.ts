// Dokumenten-Designs für Lebenslauf und Anschreiben — bewusst ohne React- oder
// PDF-Imports, damit Settings-Seite, Routen und Tests dasselbe Modul nutzen.
import { detectLanguage } from './language'

export type DocTemplateId = 'modern' | 'klassisch' | 'kompakt'

export const DOC_TEMPLATES: Array<{ id: DocTemplateId; label: string; description: string }> = [
  {
    id: 'modern',
    label: 'Modern',
    description: 'Sans-Schrift, Ocker-Akzent, Skill-Chips',
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

// Abschnitts-Labels in der Sprache des Dokuments — PDF und DOCX teilen sie,
// damit derselbe Datenstand in beiden Formaten gleich heißt. Ein übersetzter
// Lebenslauf (fremdsprachige Anzeige) bekommt keine deutschen Köpfe.
export interface SectionLabels {
  profile: string
  experience: string
  education: string
  skills: string
}

export const SECTION_LABELS: Record<'de' | 'en', SectionLabels> = {
  de: { profile: 'Profil', experience: 'Berufserfahrung', education: 'Ausbildung', skills: 'Kenntnisse' },
  en: { profile: 'Profile', experience: 'Experience', education: 'Education', skills: 'Skills' },
}

export function sectionLabelsFor(text: string): SectionLabels {
  return SECTION_LABELS[detectLanguage(text)]
}
