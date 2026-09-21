import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { ResumeData, CoverLetterData, InterviewReport } from './pdf'
import { resumeDateRange } from './pdf'
import { DEFAULT_DOC_TEMPLATE, sectionLabelsFor, type DocTemplateId } from './documents'

// Sprache des Inhalts bestimmen — über alles, was Fließtext trägt (der Name
// taugt nicht: „Müller" verrät keine Sprache). deciding nur die Abschnitts-Köpfe.
function resumeText(data: ResumeData): string {
  return [
    data.summary,
    ...data.experience.flatMap((e) => [e.title, ...e.description]),
    ...data.education.map((e) => e.degree),
  ]
    .filter(Boolean)
    .join(' ')
}

// Werkstatt-Set: dieselbe Welt wie die App (DESIGN.md) — Tusche auf Weiß,
// Ocker als der eine Akzent, Tinten-Blau für Messwerte, Salbei für Etiketten.
// Die frühere Bootstrap-Palette (#2563eb, #1e3a8a, #dbeafe) ist draußen; die
// Dokumente sprechen jetzt dieselbe Sprache wie das Werkzeug, das sie baut.
const INK = '#1c1917'
const STONE = '#57534e'
const STONE_SOFT = '#6b645e'
const OCHRE = '#b45309'
const INK_BLUE = '#3f5873'
const HAIRLINE = '#e7e5e4'
const SAGE = '#e3e8d4'
const SAGE_INK = '#3c4a32'
const MOSS = '#55724f'
const MOSS_TINT = '#eef2ec'
const TON = '#96553f'
const TON_TINT = '#f6ece7'

// Theme-Basiswerte für die drei Dokumenten-Designs (siehe lib/documents.ts).
// Die Layout-Struktur bleibt gleich — Schrift, Farben, Dichte ändern sich.
// modern: Ocker-Regel + Salbei-Etiketten. klassisch: monochrom Tusche.
// kompakt: dicht, Ocker-Haarkante.
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
    nameColor: INK,
    accentColor: OCHRE,
    headerBorderWidth: 2,
    textColor: INK,
    mutedColor: STONE_SOFT,
    skillBg: SAGE,
    skillColor: SAGE_INK,
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
    nameColor: INK,
    accentColor: INK,
    headerBorderWidth: 1,
    textColor: INK,
    mutedColor: STONE,
    skillBg: '#f5f5f4',
    skillColor: STONE,
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
    nameColor: INK,
    accentColor: OCHRE,
    headerBorderWidth: 1,
    textColor: INK,
    mutedColor: STONE_SOFT,
    skillBg: SAGE,
    skillColor: SAGE_INK,
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
  const labels = sectionLabelsFor(resumeText(data))
  const hasHeader = Boolean(data.name || data.title || data.email || data.phone || data.location)
  const contact = [data.email, data.phone, data.location].filter(Boolean)
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Kopf nur, wenn er etwas zeigt — ohne Name/Kontakt ist eine Akzentlinie über leerer Fläche nur ein Loch */}
        {hasHeader ? (
          <View style={s.header}>
            {data.name ? <Text style={s.name}>{data.name}</Text> : null}
            {data.title ? <Text style={s.title}>{data.title}</Text> : null}
            {contact.length > 0 ? (
              <View style={s.contact}>
                {contact.map((line, i) => (
                  <Text key={i}>{line}</Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {data.summary ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{labels.profile}</Text>
            <Text>{data.summary}</Text>
          </View>
        ) : null}

        {data.experience.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{labels.experience}</Text>
            {data.experience.map((exp, i) => (
              <View key={i} style={{ marginBottom: t.itemGap }}>
                <View style={s.itemHeader}>
                  {exp.company ? <Text style={s.company}>{exp.company}</Text> : null}
                  {exp.startDate || exp.endDate ? (
                    <Text style={s.date}>{resumeDateRange(exp.startDate, exp.endDate)}</Text>
                  ) : null}
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
        ) : null}

        {data.education.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{labels.education}</Text>
            {data.education.map((edu, i) => (
              <View key={i} style={s.educationItem}>
                <View style={s.itemHeader}>
                  {edu.school ? <Text style={s.company}>{edu.school}</Text> : null}
                  {edu.graduationYear ? <Text style={s.date}>{edu.graduationYear}</Text> : null}
                </View>
                <Text style={s.itemTitle}>{edu.degree}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {data.skills.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{labels.skills}</Text>
            <View style={s.skills}>
              {data.skills.map((skill, i) => (
                <Text key={i} style={s.skill}>{skill}</Text>
              ))}
            </View>
          </View>
        ) : null}
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
    contact: { color: t.mutedColor, fontSize: t.baseFontSize - 0.5 },
    // DIN 5008: das Datum steht rechtsbündig
    date: { color: t.mutedColor, marginTop: 12, marginBottom: 15, textAlign: 'right' },
    recipient: { marginBottom: 15 },
    // Betreff: fett, ohne das Wort „Betreff" davor
    subject: { fontWeight: 'bold', marginBottom: 15 },
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
        {data.name ? <Text style={s.sender}>{data.name}</Text> : null}
        {data.contactLine ? <Text style={s.contact}>{data.contactLine}</Text> : null}
        <Text style={s.date}>{data.date}</Text>
        <View style={s.recipient}>
          {data.recipientName ? <Text>{data.recipientName}</Text> : null}
          {data.recipientTitle ? <Text>{data.recipientTitle}</Text> : null}
          <Text>{data.recipientCompany}</Text>
        </View>

        {data.subject ? <Text style={s.subject}>{data.subject}</Text> : null}
        <Text style={s.salutation}>{data.salutation}</Text>

        {data.body.map((para, i) => (
          <Text key={i} style={s.bodyParagraph}>{para}</Text>
        ))}

        <Text style={s.closing}>{data.closing}</Text>
        {data.name ? <Text style={s.signature}>{data.name}</Text> : null}
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

const reportStyles = StyleSheet.create({
  block: { marginBottom: 16 },
  blockTitle: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  paragraph: { fontSize: 10.5, lineHeight: 1.5 },
  // Stärken/Entwicklungsfelder als Tint-Flächen statt Farbritze am Rand —
  // Bedeutung gedämpft (Honest Signal), der Text bleibt in Tusche lesbar.
  item: { marginBottom: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 4 },
  itemName: { fontSize: 10, fontWeight: 'bold' },
  itemText: { fontSize: 9.5, lineHeight: 1.4 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  barLabel: { width: 110, fontSize: 9.5 },
  barTrack: { flex: 1, height: 6, backgroundColor: HAIRLINE, borderRadius: 3 },
  barFill: { height: 6, borderRadius: 3 },
  barValue: { width: 30, fontSize: 9, textAlign: 'right', color: STONE_SOFT },
  scoreChip: { marginRight: 6, fontSize: 9, backgroundColor: '#f5f5f4', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 3, color: STONE_SOFT },
  footnote: { marginTop: 24, fontSize: 8, color: '#8a837c' },
})

// Bedeutung trägt die Fläche, nicht der Rand: Moos für Stärken, Ton für
// Entwicklungsfelder — jeweils als 10%-Tint, der Name in Vollton.
const TONE_SUCCESS = { backgroundColor: MOSS_TINT }
const TONE_WARNING = { backgroundColor: TON_TINT }

function InterviewReportDocument({ report, template }: { report: InterviewReport; template: DocTemplateId }) {
  const t = THEMES[template]
  const s = reportStyles
  return (
    <Document>
      <Page size="A4" style={{ paddingTop: 50, paddingBottom: 50, paddingHorizontal: 55, fontFamily: t.fontFamily, fontSize: t.baseFontSize, color: t.textColor }}>
        {/* Kopf */}
        <View style={{ borderBottomWidth: t.headerBorderWidth, borderBottomColor: t.accentColor, paddingBottom: 14, marginBottom: 18 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: t.nameColor }}>Interview-Auswertung</Text>
          <Text style={{ fontSize: 9.5, color: t.mutedColor, marginTop: 4 }}>
            {report.date}
            {report.personalityType ? `  ·  16Personalities-Typ: ${report.personalityType}` : ''}
          </Text>
        </View>

        {report.summary ? (
          <View style={s.block}>
            <Text style={[s.blockTitle, { color: t.nameColor }]}>Gesamteindruck</Text>
            <Text style={s.paragraph}>{report.summary}</Text>
          </View>
        ) : null}

        {/* Kompetenz-Profil als Balken (Skala 1-5) */}
        <View style={s.block}>
          <Text style={[s.blockTitle, { color: t.nameColor }]}>Kompetenz-Profil</Text>
          {report.competencies.map((c) => (
            <View key={c.key} style={s.barRow}>
              <Text style={s.barLabel}>{c.label}</Text>
              <View style={s.barTrack}>
                {/* Messwerte tragen Tinten-Blau (Zustand), nicht den Ocker-Akzent */}
                <View style={[s.barFill, { width: `${(c.value / 5) * 100}%`, backgroundColor: INK_BLUE }]} />
              </View>
              <Text style={s.barValue}>{c.value}/5</Text>
            </View>
          ))}
        </View>

        {report.strengths.length > 0 && (
          <View style={s.block}>
            <Text style={[s.blockTitle, { color: t.nameColor }]}>Stärken mit Belegen</Text>
            {report.strengths.map((item, i) => (
              <View key={i} style={[s.item, TONE_SUCCESS]}>
                <Text style={[s.itemName, { color: MOSS }]}>{item.name}</Text>
                <Text style={s.itemText}>{item.starExample}</Text>
              </View>
            ))}
          </View>
        )}

        {report.weaknesses.length > 0 && (
          <View style={s.block}>
            <Text style={[s.blockTitle, { color: t.nameColor }]}>Entwicklungsfelder</Text>
            {report.weaknesses.map((item, i) => (
              <View key={i} style={[s.item, TONE_WARNING]}>
                <Text style={[s.itemName, { color: TON }]}>{item.name}</Text>
                <Text style={s.itemText}>Gegenmaßnahme: {item.mitigation}</Text>
              </View>
            ))}
          </View>
        )}

        {report.miniTask && (
          <View style={s.block}>
            <Text style={[s.blockTitle, { color: t.nameColor }]}>Praxisaufgabe</Text>
            <Text style={s.itemText}><Text style={{ fontWeight: 'bold' }}>Aufgabe: </Text>{report.miniTask.task}</Text>
            <Text style={[s.itemText, { marginTop: 4 }]}><Text style={{ fontWeight: 'bold' }}>Antwort: </Text>{report.miniTask.answer}</Text>
            <Text style={[s.itemText, { marginTop: 4 }]}><Text style={{ fontWeight: 'bold' }}>Bewertung: </Text>{report.miniTask.assessment}</Text>
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              <Text style={s.scoreChip}>Korrektheit: {report.miniTask.scores.correctness}/5</Text>
              <Text style={s.scoreChip}>Begründung: {report.miniTask.scores.reasoning}/5</Text>
              <Text style={s.scoreChip}>Vollständigkeit: {report.miniTask.scores.completeness}/5</Text>
            </View>
          </View>
        )}

        <Text style={s.footnote}>
          KI-gestützte Auswertung des HR-Interviews — nur aus dem Transkript belegte Aussagen. Die Einordnung deiner Entwicklungsfelder bleibt dir überlassen.
        </Text>
      </Page>
    </Document>
  )
}

export async function renderInterviewReportPDF(report: InterviewReport, template: DocTemplateId = DEFAULT_DOC_TEMPLATE): Promise<Buffer> {
  return toBuffer(<InterviewReportDocument report={report} template={template} />)
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
