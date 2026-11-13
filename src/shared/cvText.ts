import { detectLanguage, type Language } from './language.js';
import type { MasterProfile, TailoredCV } from './schemas.js';

export function buildCvTextForMatch(profile: MasterProfile, cv: TailoredCV): string {
  const experiences = new Map(profile.experience.map((experience) => [experience.id, experience]));
  const parts: string[] = [cv.headline ?? '', cv.summary, ...cv.skills];

  for (const tailoredExperience of cv.experience) {
    const source = experiences.get(tailoredExperience.experienceId);
    parts.push(tailoredExperience.role ?? source?.role ?? '');
    parts.push(...tailoredExperience.bullets.map((bullet) => bullet.text));
  }

  for (const education of profile.education) {
    parts.push(education.degree, education.institution);
  }

  for (const project of profile.projects) {
    parts.push(project.name, project.description, ...project.tech);
  }

  for (const certification of profile.certifications) {
    parts.push(certification.name);
  }

  for (const language of profile.languages) {
    parts.push(language.name, language.level ?? '');
  }

  return parts.filter((part) => part.length > 0).join('\n');
}

interface Labels {
  summary: string;
  experience: string;
  skills: string;
  education: string;
  projects: string;
  certifications: string;
  languages: string;
  present: string;
}

const LABELS: Record<Language, Labels> = {
  es: {
    summary: 'Resumen',
    experience: 'Experiencia',
    skills: 'Habilidades',
    education: 'Educación',
    projects: 'Proyectos',
    certifications: 'Certificaciones',
    languages: 'Idiomas',
    present: 'Actual',
  },
  en: {
    summary: 'Summary',
    experience: 'Experience',
    skills: 'Skills',
    education: 'Education',
    projects: 'Projects',
    certifications: 'Certifications',
    languages: 'Languages',
    present: 'Present',
  },
};

/**
 * CV en texto plano para copiar al portapapeles y pegar en portales o
 * formularios que no aceptan PDF. Es el mismo contenido del PDF, sin formato.
 */
export function exportCvText(profile: MasterProfile, cv: TailoredCV): string {
  const labels = LABELS[detectLanguage(cv.summary)];
  const lines: string[] = [];
  const basics = [profile.basics.email, profile.basics.phone, profile.basics.location]
    .filter((part) => part !== undefined && part.length > 0)
    .join(' · ');

  lines.push(profile.basics.fullName);
  lines.push(cv.headline ?? profile.basics.headline ?? '');
  if (basics.length > 0) {
    lines.push(basics);
  }

  lines.push('', `${labels.summary.toUpperCase()}`, cv.summary);

  lines.push('', `${labels.experience.toUpperCase()}`);
  const experiences = new Map(profile.experience.map((experience) => [experience.id, experience]));

  for (const tailoredExperience of cv.experience) {
    const source = experiences.get(tailoredExperience.experienceId);
    const period = [source?.start ?? '', source?.end ?? labels.present]
      .filter((part) => part.length > 0)
      .join(' – ');

    lines.push(
      `${tailoredExperience.role ?? source?.role ?? ''} — ${source?.company ?? ''} (${period})`,
    );

    for (const bullet of tailoredExperience.bullets) {
      lines.push(`- ${bullet.text}`);
    }

    lines.push('');
  }

  lines.push(`${labels.skills.toUpperCase()}`, cv.skills.join(' · '));

  if (profile.education.length > 0) {
    lines.push('', `${labels.education.toUpperCase()}`);

    for (const education of profile.education) {
      lines.push(`${education.degree} — ${education.institution}`);
    }
  }

  if (profile.projects.length > 0) {
    lines.push('', `${labels.projects.toUpperCase()}`);

    for (const project of profile.projects) {
      lines.push(
        `${project.name}${project.tech.length > 0 ? ` (${project.tech.join(', ')})` : ''}`,
        project.description,
      );
    }
  }

  if (profile.certifications.length > 0) {
    lines.push('', `${labels.certifications.toUpperCase()}`);

    for (const certification of profile.certifications) {
      lines.push(certification.name);
    }
  }

  if (profile.languages.length > 0) {
    lines.push('', `${labels.languages.toUpperCase()}`);

    for (const language of profile.languages) {
      lines.push(`${language.name}${language.level === undefined ? '' : ` (${language.level})`}`);
    }
  }

  return lines
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line, index, all) => line.length > 0 || (index > 0 && all[index - 1] !== ''))
    .join('\n')
    .trim();
}
