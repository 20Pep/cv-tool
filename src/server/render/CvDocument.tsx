import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { Language } from '../../shared/language.js';
import type { MasterProfile, TailoredCV } from '../../shared/schemas.js';

export interface CvDocumentProps {
  profile: MasterProfile;
  tailoredCv: TailoredCV;
  language: Language;
}

const LABELS = {
  es: {
    summary: 'Resumen',
    experience: 'Experiencia',
    education: 'Educación',
    skills: 'Habilidades',
    adjacent: 'Conocimientos afines',
    projects: 'Proyectos',
    certifications: 'Certificaciones',
    languages: 'Idiomas',
    present: 'Actual',
  },
  en: {
    summary: 'Summary',
    experience: 'Experience',
    education: 'Education',
    skills: 'Skills',
    adjacent: 'Related skills',
    projects: 'Projects',
    certifications: 'Certifications',
    languages: 'Languages',
    present: 'Present',
  },
} as const;

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 34,
    paddingHorizontal: 42,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    lineHeight: 1.4,
    color: '#111827',
  },
  name: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 20,
    lineHeight: 1.15,
  },
  headline: {
    fontSize: 11,
    color: '#374151',
    marginTop: 2,
  },
  contact: {
    fontSize: 9,
    color: '#4b5563',
    marginTop: 6,
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#111827',
    marginBottom: 4,
  },
  summary: {
    color: '#1f2937',
  },
  job: {
    marginTop: 6,
  },
  jobTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  jobMeta: {
    fontSize: 9,
    color: '#4b5563',
    marginTop: 1,
  },
  bullet: {
    marginTop: 2,
    paddingLeft: 8,
  },
  item: {
    marginTop: 4,
  },
  itemTitle: {
    fontFamily: 'Helvetica-Bold',
  },
  itemMeta: {
    color: '#4b5563',
    fontSize: 9,
  },
});

export function CvDocument({ profile, tailoredCv, language }: CvDocumentProps) {
  const labels = LABELS[language];
  const experiences = new Map(profile.experience.map((experience) => [experience.id, experience]));
  const contact = [
    profile.basics.email,
    profile.basics.phone,
    profile.basics.location,
    ...profile.basics.links.map((link) => link.url),
  ]
    .filter((value): value is string => value !== undefined && value.length > 0)
    .join(' · ');

  return (
    <Document
      title={`${profile.basics.fullName} — CV`}
      author={profile.basics.fullName}
      language={language}
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{profile.basics.fullName}</Text>
        {tailoredCv.headline === undefined && profile.basics.headline === undefined ? null : (
          <Text style={styles.headline}>{tailoredCv.headline ?? profile.basics.headline}</Text>
        )}
        {contact.length === 0 ? null : <Text style={styles.contact}>{contact}</Text>}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.summary}</Text>
          <Text style={styles.summary}>{tailoredCv.summary}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.experience}</Text>
          {tailoredCv.experience.map((tailoredExperience) => {
            const source = experiences.get(tailoredExperience.experienceId);
            const role = tailoredExperience.role ?? source?.role ?? '';
            const company = source?.company ?? '';
            const location = source?.location;

            return (
              <View key={tailoredExperience.experienceId} style={styles.job}>
                <Text style={styles.jobTitle}>
                  {role}
                  {company.length === 0 ? '' : ` — ${company}`}
                </Text>
                <Text style={styles.jobMeta}>
                  {source?.start ?? ''} – {source?.end ?? labels.present}
                  {location === undefined ? '' : ` · ${location}`}
                </Text>
                {tailoredExperience.bullets.map((bullet) => (
                  <Text key={bullet.sourceBulletId} style={styles.bullet}>
                    • {bullet.text}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>

        {profile.education.length === 0 ? null : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{labels.education}</Text>
            {profile.education.map((education) => (
              <View key={`${education.institution}-${education.degree}`} style={styles.item}>
                <Text style={styles.itemTitle}>{education.degree}</Text>
                <Text style={styles.itemMeta}>
                  {education.institution}
                  {education.start === undefined && education.end === undefined
                    ? ''
                    : ` · ${education.start ?? ''} – ${education.end ?? ''}`}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.skills}</Text>
          <Text>{tailoredCv.skills.join(' · ')}</Text>
        </View>

        {(tailoredCv.adjacentSkills ?? []).length === 0 ? null : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{labels.adjacent}</Text>
            <Text>
              {(tailoredCv.adjacentSkills ?? [])
                .map((skill) => `${skill.name} (${skill.basedOn})`)
                .join(' · ')}
            </Text>
          </View>
        )}

        {profile.projects.length === 0 ? null : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{labels.projects}</Text>
            {profile.projects.map((project) => (
              <View key={project.id} style={styles.item}>
                <Text style={styles.itemTitle}>{project.name}</Text>
                <Text>{project.description}</Text>
                {project.tech.length === 0 ? null : (
                  <Text style={styles.itemMeta}>{project.tech.join(' · ')}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {profile.certifications.length === 0 ? null : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{labels.certifications}</Text>
            {profile.certifications.map((certification) => (
              <Text key={`${certification.name}-${certification.issuer ?? ''}`} style={styles.item}>
                {certification.name}
                {certification.issuer === undefined ? '' : ` — ${certification.issuer}`}
                {certification.year === undefined ? '' : ` · ${certification.year}`}
              </Text>
            ))}
          </View>
        )}

        {profile.languages.length === 0 ? null : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{labels.languages}</Text>
            <Text>
              {profile.languages
                .map((languageItem) =>
                  languageItem.level === undefined
                    ? languageItem.name
                    : `${languageItem.name} (${languageItem.level})`,
                )
                .join(' · ')}
            </Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
