import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { ResumeData, CoverLetterData } from './pdf'

const resumeStyles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 50,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
    paddingBottom: 15,
    marginBottom: 25,
  },
  name: { fontSize: 28, fontWeight: 'bold', color: '#1e3a8a' },
  title: { fontSize: 14, color: '#64748b', marginTop: 3 },
  contact: { flexDirection: 'row', gap: 16, marginTop: 10, fontSize: 9, color: '#64748b' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#1e3a8a', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  company: { fontWeight: 'bold', fontSize: 11 },
  date: { color: '#64748b', fontSize: 9 },
  itemTitle: { color: '#475569', marginBottom: 5, fontSize: 10 },
  bullet: { flexDirection: 'row', marginBottom: 3 },
  bulletDot: { width: 12 },
  bulletText: { flex: 1, fontSize: 9 },
  educationItem: { marginBottom: 8 },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skill: { backgroundColor: '#dbeafe', color: '#1e40af', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3, fontSize: 9 },
})

export function ResumeDocument({ data }: { data: ResumeData }) {
  return (
    <Document>
      <Page size="A4" style={resumeStyles.page}>
        <View style={resumeStyles.header}>
          <Text style={resumeStyles.name}>{data.name}</Text>
          <Text style={resumeStyles.title}>{data.title}</Text>
          <View style={resumeStyles.contact}>
            <Text>{data.email}</Text>
            <Text>{data.phone}</Text>
            <Text>{data.location}</Text>
          </View>
        </View>

        {data.summary ? (
          <View style={resumeStyles.section}>
            <Text style={resumeStyles.sectionTitle}>Profil</Text>
            <Text>{data.summary}</Text>
          </View>
        ) : null}

        <View style={resumeStyles.section}>
          <Text style={resumeStyles.sectionTitle}>Berufserfahrung</Text>
          {data.experience.map((exp, i) => (
            <View key={i} style={{ marginBottom: 12 }}>
              <View style={resumeStyles.itemHeader}>
                <Text style={resumeStyles.company}>{exp.company}</Text>
                <Text style={resumeStyles.date}>{exp.startDate} – {exp.endDate || 'Heute'}</Text>
              </View>
              <Text style={resumeStyles.itemTitle}>{exp.title}</Text>
              {exp.description.map((d, j) => (
                <View key={j} style={resumeStyles.bullet}>
                  <Text style={resumeStyles.bulletDot}>•</Text>
                  <Text style={resumeStyles.bulletText}>{d}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={resumeStyles.section}>
          <Text style={resumeStyles.sectionTitle}>Ausbildung</Text>
          {data.education.map((edu, i) => (
            <View key={i} style={resumeStyles.educationItem}>
              <View style={resumeStyles.itemHeader}>
                <Text style={resumeStyles.company}>{edu.school}</Text>
                <Text style={resumeStyles.date}>{edu.graduationYear}</Text>
              </View>
              <Text style={resumeStyles.itemTitle}>{edu.degree}</Text>
            </View>
          ))}
        </View>

        <View style={resumeStyles.section}>
          <Text style={resumeStyles.sectionTitle}>Skills</Text>
          <View style={resumeStyles.skills}>
            {data.skills.map((skill, i) => (
              <Text key={i} style={resumeStyles.skill}>{skill}</Text>
            ))}
          </View>
        </View>
      </Page>
    </Document>
  )
}

const letterStyles = StyleSheet.create({
  page: {
    paddingTop: 60,
    paddingBottom: 50,
    paddingHorizontal: 50,
    fontFamily: 'Georgia',
    fontSize: 11,
    lineHeight: 1.6,
    color: '#1a1a1a',
  },
  sender: { fontWeight: 'bold', marginBottom: 3 },
  date: { color: '#64748b', marginBottom: 15 },
  recipient: { marginBottom: 15 },
  salutation: { marginBottom: 15 },
  bodyParagraph: { marginBottom: 12, textAlign: 'justify' },
  closing: { marginTop: 20 },
  signature: { marginTop: 30 },
})

export function CoverLetterDocument({ data }: { data: CoverLetterData }) {
  return (
    <Document>
      <Page size="A4" style={letterStyles.page}>
        <Text style={letterStyles.sender}>{data.name}</Text>
        <Text style={letterStyles.date}>{data.date}</Text>
        <View style={letterStyles.recipient}>
          {data.recipientName ? <Text>{data.recipientName}</Text> : null}
          {data.recipientTitle ? <Text>{data.recipientTitle}</Text> : null}
          <Text>{data.recipientCompany}</Text>
        </View>

        <Text style={letterStyles.salutation}>{data.salutation}</Text>

        {data.body.map((para, i) => (
          <Text key={i} style={letterStyles.bodyParagraph}>{para}</Text>
        ))}

        <Text style={letterStyles.closing}>{data.closing}</Text>
        <Text style={letterStyles.signature}>{data.name}</Text>
      </Page>
    </Document>
  )
}

export async function renderResumePDF(data: ResumeData): Promise<Buffer> {
  return renderToBuffer(<ResumeDocument data={data} /> as any)
}

export async function renderCoverLetterPDF(data: CoverLetterData): Promise<Buffer> {
  return renderToBuffer(<CoverLetterDocument data={data} /> as any)
}
