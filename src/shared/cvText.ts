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
