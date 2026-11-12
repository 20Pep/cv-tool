import type { CoverLetter, MasterProfile, TailoredCV } from './schemas.js';

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}

const NUMBER_PATTERN = /\d+(?:[.,]\d+)*/g;

/**
 * Normaliza texto para comparar skills sin depender de mayúsculas, acentos o
 * espacios repetidos.
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractNumberTokens(text: string): string[] {
  const tokens = text.match(NUMBER_PATTERN) ?? [];
  const normalized = new Set<string>();

  for (const token of tokens) {
    normalized.add(normalizeNumberToken(token));
  }

  return [...normalized];
}

/**
 * Devuelve las cifras de `text` que no aparecen en `allowedText`.
 *
 * No pretende detectar invenciones sin números. Es la barrera barata y
 * determinista contra métricas inventadas.
 */
export function findNewNumbers(text: string, allowedText: string): string[] {
  const allowed = new Set(extractNumberTokens(allowedText));
  return extractNumberTokens(text).filter((number) => !allowed.has(number));
}

export function validateTailoredCV(cv: TailoredCV, profile: MasterProfile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const experiences = new Map(profile.experience.map((experience) => [experience.id, experience]));
  const profileSkills = new Set(profile.skills.map((skill) => normalizeText(skill.name)));
  const profileText = JSON.stringify(profile);

  cv.experience.forEach((tailoredExperience, experienceIndex) => {
    const sourceExperience = experiences.get(tailoredExperience.experienceId);

    if (!sourceExperience) {
      issues.push({
        code: 'unknown-experience',
        path: `experience[${experienceIndex}].experienceId`,
        message: `El experienceId "${tailoredExperience.experienceId}" no existe en el perfil.`,
      });
      return;
    }

    const sourceBullets = new Map(
      sourceExperience.bullets.map((bullet) => [bullet.id, bullet.text]),
    );

    tailoredExperience.bullets.forEach((tailoredBullet, bulletIndex) => {
      const sourceText = sourceBullets.get(tailoredBullet.sourceBulletId);

      if (sourceText === undefined) {
        issues.push({
          code: 'unknown-source-bullet',
          path: `experience[${experienceIndex}].bullets[${bulletIndex}].sourceBulletId`,
          message: `El sourceBulletId "${tailoredBullet.sourceBulletId}" no existe en la experiencia "${tailoredExperience.experienceId}".`,
        });
        return;
      }

      const newNumbers = findNewNumbers(tailoredBullet.text, sourceText);
      if (newNumbers.length > 0) {
        issues.push({
          code: 'new-number-in-bullet',
          path: `experience[${experienceIndex}].bullets[${bulletIndex}]`,
          message: `El bullet adaptado introduce cifras que no están en el bullet de origen: ${newNumbers.join(', ')}.`,
        });
      }
    });
  });

  cv.skills.forEach((skill, skillIndex) => {
    if (!profileSkills.has(normalizeText(skill))) {
      issues.push({
        code: 'unknown-skill',
        path: `skills[${skillIndex}]`,
        message: `La skill "${skill}" no existe en el perfil.`,
      });
    }
  });

  const summaryNewNumbers = findNewNumbers(cv.summary, profileText);
  if (summaryNewNumbers.length > 0) {
    issues.push({
      code: 'new-number-in-summary',
      path: 'summary',
      message: `El resumen introduce cifras que no están en el perfil: ${summaryNewNumbers.join(', ')}.`,
    });
  }

  return issues;
}

/**
 * La carta no tiene trazabilidad por bullet. Como mínimo, sus cifras deben
 * existir en el perfil, la oferta o el borrador de la persona. Las afirmaciones
 * sin números quedan sujetas a revisión humana (ver docs/decisions.md).
 */
export function validateCoverLetter(letter: CoverLetter, allowedText: string): ValidationIssue[] {
  const letterText = [letter.greeting, ...letter.paragraphs, letter.closing].join('\n');
  const newNumbers = findNewNumbers(letterText, allowedText);

  return newNumbers.map((number) => ({
    code: 'new-number-in-letter',
    path: 'letter',
    message: `La carta introduce la cifra "${number}", que no aparece en el perfil, la oferta ni el borrador.`,
  }));
}

function normalizeNumberToken(token: string): string {
  // "1.000" o "1,000" se interpretan como separadores de miles.
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(token)) {
    return token.replace(/[.,]/g, '');
  }

  const value = Number(token.replace(',', '.'));
  return Number.isFinite(value) ? String(value) : token;
}
