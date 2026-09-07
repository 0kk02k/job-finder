import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { ResumeData, CoverLetterData } from './pdf'
import { DEFAULT_DOC_TEMPLATE, type DocTemplateId } from './documents'

// Theme-Basiswerte für die drei Dokumenten-Designs (siehe lib/documents.ts).
// Die Layout-Struktur bleibt gleich — Schrift, Farben, Dichte ändern sich.
interface DocTheme {
  fontFamily: 'Helvetica' | 'Times-Roman'
  nameSize: number
  nameColor: string
  accentColor: string
  headerBorderWidth: number
  textColor: string
  mutedColor: string
  skillBg: string
  skillColor: string
  baseFontSize: number
  sectionGap: number
  itemGap: number
  paddingTop: number
  paddingBottom: number
  paddingHorizontal: number
}

const THEMES: Record<DocTemplateId, DocTheme> = {
  modern: {
    fontFamily: 'Helvetica',
    nameSize: 28,
    nameColor: '#1e3a8a',
    accentColor: '#2563eb',
    headerBorderWidth: 2,
    textColor: '#1a1a1a',
    mutedColor: '#64748b',
    skillBg: '#dbeafe',
    skillColor: '#1e40af',
    baseFontSize: 10,
    sectionGap: 20,
    itemGap: 12,
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 50,
  },
  klassisch: {
    fontFamily: 'Times-Roman',
    nameSize: 26,
    nameColor: '#1a1a1a',
    accentColor: '#1a1a1a',
    headerBorderWidth: 1,
    textColor: '#1a1a1a',
    mutedColor: '#525252',
    skillBg: '#e5e5e5',
    skillColor: '#171717',
    baseFontSize: 10.5,
    sectionGap: 18,
    itemGap: 10,
    paddingTop: 50,
    paddingBottom: 50,
    paddingHorizontal: 60,
  },
  kompakt: {
    fontFamily: 'Helvetica',
    nameSize: 22,
    nameColor: '#111827',
    accentColor: '#111827',
    headerBorderWidth: 1,
    textColor: '#111827',
    mutedColor: '#4b5563',
    skillBg: '#f3f4f6',
    skillColor: '#1f2937',
    baseFontSize: 9,
    sectionGap: 12,
    itemGap: 8,
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 36,
  },
}

function createResumeStyles(t: DocTheme) {
  return StyleSheet.create({
    page: {
      paddingTop: t.paddingTop,
      paddingBottom: t.paddingBottom,
      paddingHorizontal: t.paddingHorizontal,
      fontFamily: t.fontFamily,
      fontSize: t.baseFontSize,
      color: t.textColor,
    },
    header: {
      borderBottomWidth: t.headerBorderWidth,
      borderBottomColor: t.accentColor,
      paddingBottom: 15,
      marginBottom: t.sectionGap,
    },
    name: { fontSize: t.nameSize, fontWeight: 'bold', color: t.nameColor },
    title: { fontSize: t.nameSize * 0.5, color: t.mutedColor, marginTop: 3 },
    contact: { flexDirection: 'row', gap: 16, marginTop: 10, fontSize: t.baseFontSize - 1, color: t.mutedColor },
    section: { marginBottom: t.sectionGap },
    sectionTitle: {
      fontSize: t.baseFontSize + 3,
      fontWeight: 'bold',
      color: t.nameColor,
      textTransform: 'uppercase',
      marginBottom: 10,
      letterSpacing: 0.5,
    },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    company: { fontWeight: 'bold', fontSize: t.baseFontSize + 1 },
    date: { color: t.mutedColor, fontSize: t.baseFontSize - 1 },
    itemTitle: { color: t.mutedColor, marginBottom: 5, fontSize: t.baseFontSize },
    bullet: { flexDirection: 'row', marginBottom: 3 },
    bulletDot: { width: 12 },
    bulletText: { flex: 1, fontSize: t.baseFontSize - 1 },
    educationItem: { marginBottom: 8 },
    skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    skill: {
      backgroundColor: t.skillBg,
      color: t.skillColor,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 3,
      fontSize: t.baseFontSize - 1,
    },
  })
}

function ResumeDocument({ data, template }: { data: ResumeData; template: DocTemplateId }) {
  const t = THEMES[template]
  const s = createResumeStyles(t)
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.name}>{data.name}</Text>
          <Text style={s.title}>{data.title}</Text>
          <View style={s.contact}>
            <Text>{data.email}</Text>
            <Text>{data.phone}</Text>
            <Text>{data.location}</Text>
          </View>
        </View>

        {data.summary ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Profil</Text>
            <Text>{data.summary}</Text>
          </View>
        ) : null}

        <View style={s.section}>
          <Text style={s.sectionTitle}>Berufserfahrung</Text>
          {data.experience.map((exp, i) => (
            <View key={i} style={{ marginBottom: t.itemGap }}>
              <View style={s.itemHeader}>
                <Text style={s.company}>{exp.company}</Text>
                <Text style={s.date}>{exp.startDate} – {exp.endDate || 'Heute'}</Text>
              </View>
              <Text style={s.itemTitle}>{exp.title}</Text>
              {exp.description.map((d, j) => (
                <View key={j} style={s.bullet}>
                  <Text style={s.bulletDot}>•</Text>
                  <Text style={s.bulletText}>{d}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Ausbildung</Text>
          {data.education.map((edu, i) => (
            <View key={i} style={s.educationItem}>
              <View style={s.itemHeader}>
                <Text style={s.company}>{edu.school}</Text>
                <Text style={s.date}>{edu.graduationYear}</Text>
              </View>
              <Text style={s.itemTitle}>{edu.degree}</Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Skills</Text>
          <View style={s.skills}>
            {data.skills.map((skill, i) => (
              <Text key={i} style={s.skill}>{skill}</Text>
            ))}
          </View>
        </View>
      </Page>
    </Document>
  )
}

function createLetterStyles(t: DocTheme) {
  return StyleSheet.create({
    page: {
      paddingTop: t.paddingTop + 10,
      paddingBottom: t.paddingBottom,
      paddingHorizontal: t.paddingHorizontal,
      fontFamily: t.fontFamily,
      fontSize: t.baseFontSize + 0.5,
      lineHeight: 1.6,
      color: t.textColor,
    },
    sender: { fontWeight: 'bold', marginBottom: 3 },
    date: { color: t.mutedColor, marginBottom: 15 },
    recipient: { marginBottom: 15 },
    salutation: { marginBottom: 15 },
    bodyParagraph: { marginBottom: 12, textAlign: 'justify' },
    closing: { marginTop: 20 },
    signature: { marginTop: 30 },
  })
}

function CoverLetterDocument({ data, template }: { data: CoverLetterData; template: DocTemplateId }) {
  const s = createLetterStyles(THEMES[template])
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.sender}>{data.name}</Text>
        <Text style={s.date}>{data.date}</Text>
        <View style={s.recipient}>
          {data.recipientName ? <Text>{data.recipientName}</Text> : null}
          {data.recipientTitle ? <Text>{data.recipientTitle}</Text> : null}
          <Text>{data.recipientCompany}</Text>
        </View>

        <Text style={s.salutation}>{data.salutation}</Text>

        {data.body.map((para, i) => (
          <Text key={i} style={s.bodyParagraph}>{para}</Text>
        ))}

        <Text style={s.closing}>{data.closing}</Text>
        <Text style={s.signature}>{data.name}</Text>
      </Page>
    </Document>
  )
}

// @react-pdf/renderer und React 19 sind typseitig leicht verträgt — eine
// dokumentierte Grenzstelle für alle Aufrufe statt `as any` an jedem Dokument.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function toBuffer(element: any): Promise<Buffer> {
  return renderToBuffer(element)
}

export async function renderResumePDF(data: ResumeData, template: DocTemplateId = DEFAULT_DOC_TEMPLATE): Promise<Buffer> {
  return toBuffer(<ResumeDocument data={data} template={template} />)
}

export async function renderCoverLetterPDF(data: CoverLetterData, template: DocTemplateId = DEFAULT_DOC_TEMPLATE): Promise<Buffer> {
  return toBuffer(<CoverLetterDocument data={data} template={template} />)
}

const rawTextStyles = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 50,
    paddingHorizontal: 50,
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    lineHeight: 1.6,
    color: '#1a1a1a',
  },
})

// Nie-leer-Fallback: Der Parser hat keine Struktur erkannt — dann bekommt die
// Nutzerin ihren eigenen Text schlicht gesetzt statt einer leeren Seite. Der
// Inhalt bleibt ihr Inhalt: keine erfundenen Abschnitte, keine Warnungen.
export async function renderResumeTextPDF(rawText: string): Promise<Buffer> {
  return toBuffer(
    (
      <Document>
        <Page size="A4" style={rawTextStyles.page}>
          {rawText
            .split('\n')
            .map((line) => line.trim())
            .map((line, i) =>
              line ? (
                <Text key={i} style={{ marginBottom: 6 }}>
                  {line}
                </Text>
              ) : null
            )}
        </Page>
      </Document>
    )
  )
}
