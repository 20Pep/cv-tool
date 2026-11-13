import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { Language } from '../../shared/language.js';
import type { CoverLetter, MasterProfile } from '../../shared/schemas.js';

export interface LetterDocumentProps {
  profile: MasterProfile;
  coverLetter: CoverLetter;
  language: Language;
  company: string;
  position: string;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 56,
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    lineHeight: 1.5,
    color: '#111827',
  },
  name: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
  },
  contact: {
    fontSize: 9,
    color: '#4b5563',
    marginTop: 3,
  },
  date: {
    marginTop: 20,
    color: '#374151',
  },
  subject: {
    marginTop: 16,
    fontFamily: 'Helvetica-Bold',
  },
  greeting: {
    marginTop: 16,
  },
  paragraph: {
    marginTop: 10,
  },
  closing: {
    marginTop: 18,
  },
});

export function LetterDocument({
  profile,
  coverLetter,
  language,
  company,
  position,
}: LetterDocumentProps) {
  const contact = [profile.basics.email, profile.basics.phone, profile.basics.location]
    .filter((value): value is string => value !== undefined && value.length > 0)
    .join(' · ');
  const date = new Date().toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const subject =
    language === 'es'
      ? `Postulación: ${position} — ${company}`
      : `Application: ${position} — ${company}`;

  return (
    <Document
      title={`${profile.basics.fullName} — Carta`}
      author={profile.basics.fullName}
      language={language}
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{profile.basics.fullName}</Text>
        {contact.length === 0 ? null : <Text style={styles.contact}>{contact}</Text>}

        <Text style={styles.date}>{date}</Text>
        {position.length === 0 && company.length === 0 ? null : (
          <Text style={styles.subject}>{subject}</Text>
        )}

        <Text style={styles.greeting}>{coverLetter.greeting}</Text>

        {coverLetter.paragraphs.map((paragraph) => (
          <Text key={paragraph} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}

        <View style={styles.closing}>
          <Text>{coverLetter.closing}</Text>
        </View>
      </Page>
    </Document>
  );
}
