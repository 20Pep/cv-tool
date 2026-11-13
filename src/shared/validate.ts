import { areAdjacent } from './adjacent.js';
import type { CoverLetter, Fidelity, MasterProfile, TailoredCV } from './schemas.js';
import { skillsMatch, skillVariants } from './skills.js';
import { normalizeText } from './text.js';

export { normalizeText };

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}

const NUMBER_PATTERN = /\d+(?:[.,]\d+)*/g;

const FORBIDDEN_LEVEL_UP = [
  { pattern: /\blider(?:e|o|as|ar|ando|azgo)\b/, label: 'lideré/liderazgo' },
  { pattern: /\bdirig(?:i|io|ir|iendo|e)\b/, label: 'dirigí' },
  { pattern: /\bgestion(?:e|o|ar|ando)\b/, label: 'gestioné' },
  { pattern: /\bfund(?:e|o|ar|ador|ando)\b/, label: 'fundé' },
  { pattern: /\b(?:led|managed|directed|founded)\b/, label: 'led/managed/directed/founded' },
];

export function extractNumberTokens(text: string): string[] {
  const tokens = text.match(NUMBER_PATTERN) ?? [];
  const normalized = new Set<string>();

  for (const token of tokens) {
    normalized.add(normalizeNumberToken(token));
  }

  return [...normalized];
}

/**
 * Devuelve las cifras de `text` que no aparecen en `allowedText`. Se usa para
 * la carta y el resumen, donde no se permite ningún ajuste de cifras.
 */
export function findNewNumbers(text: string, allowedText: string): string[] {
  const allowed = new Set(extractNumberTokens(allowedText));
  return extractNumberTokens(text).filter((number) => !allowed.has(number));
}

export interface NumberStretch {
  token: string;
  value: number;
  sourceValue: number;
}

export interface NumberClassification {
  /** Cifras que no existen arriba y superan el +10% permitido (o son años). */
  rejected: string[];
  /** Cifras redondeadas hacia arriba dentro del +10%: van marcadas. */
  stretched: NumberStretch[];
}

/**
 * Clasifica las cifras de un bullet adaptado contra el bullet de origen:
 * - iguales: pasan sin marca;
 * - mayores hasta +10%: pasan pero deben declararse como `stretch`;
 * - cualquier otra: se rechaza.
 *
 * Los años (1900-2100) nunca se consideran redondeo: una fecha no se estira.
 */
export function classifyNumbers(text: string, allowedText: string): NumberClassification {
  const allowedTokens = extractNumberTokens(allowedText);
  const allowedSet = new Set(allowedTokens);
  const allowedValues = allowedTokens
    .map((token) => Number(token))
    .filter((value) => Number.isFinite(value));
  const rejected: string[] = [];
  const stretched: NumberStretch[] = [];

  for (const token of extractNumberTokens(text)) {
    if (allowedSet.has(token)) {
      continue;
    }

    const value = Number(token);

    if (!Number.isFinite(value) || isYearLike(value)) {
      rejected.push(token);
      continue;
    }

    const sourceValue = allowedValues
      .filter((candidate) => value > candidate && value <= candidate * 1.1 + 1e-9)
      .sort((left, right) => right - left)[0];

    if (sourceValue === undefined) {
      rejected.push(token);
    } else {
      stretched.push({ token, value, sourceValue });
    }
  }

  return { rejected, stretched };
}

function isYearLike(value: number): boolean {
  return Number.isInteger(value) && value >= 1900 && value <= 2100;
}

export interface ValidationOptions {
  /** En `strict` no se permiten ajustes marcados ni skills afines. */
  fidelity?: Fidelity;
}

export function validateTailoredCV(
  cv: TailoredCV,
  profile: MasterProfile,
  options: ValidationOptions = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const fidelity = options.fidelity ?? 'enhanced';
  const experiences = new Map(profile.experience.map((experience) => [experience.id, experience]));
  const profileSkills = profile.skills.map((skill) => normalizeText(skill.name));
  const familiarSkills = profile.familiarSkills.map((skill) => normalizeText(skill));
  const profileText = normalizeText(JSON.stringify(profile));
  const adjacentSkills = cv.adjacentSkills ?? [];
  const adjacentNames: string[] = [];

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
    const sourceExperienceText = normalizeText(
      [sourceExperience.role, ...sourceExperience.bullets.map((bullet) => bullet.text)].join('\n'),
    );

    tailoredExperience.bullets.forEach((tailoredBullet, bulletIndex) => {
      const path = `experience[${experienceIndex}].bullets[${bulletIndex}]`;
      const sourceText = sourceBullets.get(tailoredBullet.sourceBulletId);

      if (sourceText === undefined) {
        issues.push({
          code: 'unknown-source-bullet',
          path: `${path}.sourceBulletId`,
          message: `El sourceBulletId "${tailoredBullet.sourceBulletId}" no existe en la experiencia "${tailoredExperience.experienceId}".`,
        });
        return;
      }

      const numbers = classifyNumbers(tailoredBullet.text, sourceText);

      if (numbers.rejected.length > 0) {
        issues.push({
          code: 'new-number-in-bullet',
          path,
          message: `El bullet adaptado introduce cifras que no están en el bullet de origen o superan el +10% permitido: ${numbers.rejected.join(', ')}.`,
        });
      }

      if (numbers.stretched.length > 0 && tailoredBullet.stretch?.kind !== 'number') {
        issues.push({
          code: 'unmarked-stretch',
          path,
          message: `El bullet redondea cifras (${numbers.stretched
            .map((stretch) => `${stretch.sourceValue} → ${stretch.token}`)
            .join(', ')}) sin declararlo en "stretch" con kind "number".`,
        });
      }

      if (tailoredBullet.stretch !== undefined && fidelity === 'strict') {
        issues.push({
          code: 'stretch-not-allowed',
          path: `${path}.stretch`,
          message: 'La fidelidad estricta no permite ajustes marcados en los bullets.',
        });
      }

      if (hasForbiddenLevelUp(tailoredBullet.text, sourceText)) {
        issues.push({
          code: 'level-up-not-backed',
          path,
          message:
            'El bullet usa un verbo de responsabilidad mayor (lideré, dirigí, gestioné o fundé) que no aparece en el perfil.',
        });
      }

      const unbackedTools = findUnbackedTools(tailoredBullet.text, sourceExperienceText, profile);

      if (unbackedTools.length > 0) {
        issues.push({
          code: 'tool-not-in-experience',
          path,
          message: `El bullet atribuye a esta experiencia herramientas que no figuran en ella: ${unbackedTools.join(', ')}.`,
        });
      }

      for (const adjacent of adjacentSkills) {
        if (containsWord(normalizeText(tailoredBullet.text), normalizeText(adjacent.name))) {
          issues.push({
            code: 'adjacent-in-bullet',
            path,
            message: `La skill afín "${adjacent.name}" no puede aparecer dentro de un bullet de experiencia.`,
          });
          break;
        }
      }
    });
  });

  cv.skills.forEach((skill, skillIndex) => {
    if (!profileSkills.some((profileSkill) => skillsMatch(profileSkill, skill))) {
      issues.push({
        code: 'unknown-skill',
        path: `skills[${skillIndex}]`,
        message: `La skill "${skill}" no existe en el perfil.`,
      });
    }
  });

  adjacentSkills.forEach((adjacent, index) => {
    const path = `adjacentSkills[${index}]`;
    const name = normalizeText(adjacent.name);
    const basedOn = normalizeText(adjacent.basedOn);

    if (fidelity === 'strict') {
      issues.push({
        code: 'adjacent-not-allowed',
        path,
        message: 'La fidelidad estricta no permite skills afines.',
      });
    }

    if (
      !profileSkills.some((profileSkill) => skillsMatch(profileSkill, basedOn)) &&
      !familiarSkills.some((familiarSkill) => skillsMatch(familiarSkill, basedOn))
    ) {
      issues.push({
        code: 'unknown-adjacent-base',
        path: `${path}.basedOn`,
        message: `La skill base "${adjacent.basedOn}" no existe en el perfil.`,
      });
    } else if (!areAdjacent(name, basedOn)) {
      issues.push({
        code: 'unknown-adjacency',
        path,
        message: `"${adjacent.name}" no está en la tabla de afinidades de "${adjacent.basedOn}".`,
      });
    }

    if (profileSkills.some((profileSkill) => skillsMatch(profileSkill, name))) {
      issues.push({
        code: 'redundant-adjacent',
        path,
        message: `La skill "${adjacent.name}" ya está en el perfil: no es afín, es propia.`,
      });
    }

    if (adjacentNames.some((existing) => skillsMatch(existing, name))) {
      issues.push({
        code: 'duplicate-adjacent',
        path,
        message: `La skill afín "${adjacent.name}" está repetida.`,
      });
    }

    adjacentNames.push(name);
  });

  const summaryNumbers = classifyNumbers(cv.summary, profileText);

  if (summaryNumbers.rejected.length > 0 || summaryNumbers.stretched.length > 0) {
    issues.push({
      code: 'new-number-in-summary',
      path: 'summary',
      message: `El resumen introduce cifras que no están en el perfil: ${[
        ...summaryNumbers.rejected,
        ...summaryNumbers.stretched.map((stretch) => stretch.token),
      ].join(', ')}.`,
    });
  }

  if (hasForbiddenLevelUp(cv.summary, profileText)) {
    issues.push({
      code: 'level-up-not-backed',
      path: 'summary',
      message:
        'El resumen usa un verbo de responsabilidad mayor (lideré, dirigí, gestioné o fundé) que no aparece en el perfil.',
    });
  }

  return issues;
}

function hasForbiddenLevelUp(text: string, allowedText: string): boolean {
  const normalized = normalizeText(text);
  const allowed = normalizeText(allowedText);

  return FORBIDDEN_LEVEL_UP.some(
    (verb) => verb.pattern.test(normalized) && !verb.pattern.test(allowed),
  );
}

/**
 * Herramientas del perfil que el bullet atribuye a una experiencia donde no
 * figuraban. Es la regla roja "una herramienta atribuida a un empleo concreto
 * donde no estaba".
 */
function findUnbackedTools(text: string, allowedText: string, profile: MasterProfile): string[] {
  const normalized = normalizeText(text);
  const allowed = normalizeText(allowedText);

  return profile.skills
    .map((skill) => skill.name)
    .filter((name) => {
      const variants = skillVariants(name);
      return (
        variants.some((variant) => containsWord(normalized, variant)) &&
        !variants.some((variant) => containsWord(allowed, variant))
      );
    });
}

function containsWord(haystack: string, needle: string): boolean {
  if (needle.length === 0) {
    return false;
  }

  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
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
