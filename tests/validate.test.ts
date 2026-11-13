import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type CoverLetter, MasterProfile, type TailoredCV } from '../src/shared/schemas.js';
import { skillsMatch } from '../src/shared/skills.js';
import {
  classifyNumbers,
  extractNumberTokens,
  normalizeText,
  validateCoverLetter,
  validateTailoredCV,
} from '../src/shared/validate.js';

const profile = MasterProfile.parse(
  JSON.parse(readFileSync(new URL('../fixtures/profile.json', import.meta.url), 'utf8')),
);

const validCv: TailoredCV = {
  summary: 'Analista de datos con 4 años de experiencia en SQL y Power BI.',
  experience: [
    {
      experienceId: 'exp-nova',
      bullets: [
        {
          text: 'Analicé datos de ventas con SQL y Power BI y reduje el tiempo de reporte en 30%.',
          sourceBulletId: 'nova-b1',
        },
      ],
    },
  ],
  skills: ['SQL', 'Power BI'],
  keywordsUsed: ['SQL'],
  keywordsMissing: ['Python'],
};

describe('normalizeText', () => {
  it('ignora mayúsculas, acentos y espacios repetidos', () => {
    expect(normalizeText('  Power   BI  ')).toBe('power bi');
    expect(normalizeText('Análisis')).toBe('analisis');
  });
});

describe('extractNumberTokens', () => {
  it('normaliza porcentajes, decimales y separadores de miles', () => {
    expect(extractNumberTokens('30% y 3,5 y 1.000')).toEqual(['30', '3.5', '1000']);
  });
});

describe('skillsMatch', () => {
  it('Git equivale a GitHub y al revés', () => {
    expect(skillsMatch('Git', 'GitHub')).toBe(true);
    expect(skillsMatch('GitHub', 'Git')).toBe(true);
  });

  it('K8s equivale a Kubernetes', () => {
    expect(skillsMatch('K8s', 'Kubernetes')).toBe(true);
  });

  it('no equivale productos distintos', () => {
    expect(skillsMatch('PostgreSQL', 'MySQL')).toBe(false);
    expect(skillsMatch('GitLab', 'GitHub')).toBe(false);
  });

  it('no equivale un framework con su versión móvil', () => {
    expect(skillsMatch('React', 'React Native')).toBe(false);
  });

  it('ignora mayúsculas y acentos', () => {
    expect(skillsMatch('NODE.JS', 'Node')).toBe(true);
  });
});

describe('validateTailoredCV', () => {
  it('acepta un CV que solo usa datos del perfil', () => {
    expect(validateTailoredCV(validCv, profile)).toEqual([]);
  });

  it('rechaza una experiencia inexistente', () => {
    const cv = { ...validCv, experience: [{ experienceId: 'exp-inventada', bullets: [] }] };
    expect(validateTailoredCV(cv, profile).map((issue) => issue.code)).toContain(
      'unknown-experience',
    );
  });

  it('rechaza un sourceBulletId inexistente', () => {
    const cv = {
      ...validCv,
      experience: [
        {
          experienceId: 'exp-nova',
          bullets: [{ text: 'Analicé ventas.', sourceBulletId: 'bullet-inventado' }],
        },
      ],
    };
    expect(validateTailoredCV(cv, profile).map((issue) => issue.code)).toContain(
      'unknown-source-bullet',
    );
  });

  it('rechaza una skill que no está en el perfil', () => {
    const cv = { ...validCv, skills: ['SQL', 'Python'] };
    expect(validateTailoredCV(cv, profile).map((issue) => issue.code)).toContain('unknown-skill');
  });

  it('acepta skills con otra capitalización', () => {
    const cv = { ...validCv, skills: ['sql', 'power bi'] };
    expect(validateTailoredCV(cv, profile)).toEqual([]);
  });

  it('acepta equivalencias de nombre con el perfil', () => {
    // El perfil declara Git: nombrar "GitHub" es una equivalencia de nombre,
    // no un dato nuevo (saber Git implica poder usar GitHub).
    const profileWithGit = {
      ...profile,
      skills: [...profile.skills, { name: 'Git', category: 'Herramientas' }],
    };
    const cv = { ...validCv, skills: ['GitHub'] };

    expect(validateTailoredCV(cv, profileWithGit)).toEqual([]);
  });

  it('rechaza skills de productos distintos aunque la familia se parezca', () => {
    // MongoDB no equivale a nada declarado en el perfil.
    const cv = { ...validCv, skills: ['MongoDB'] };
    expect(validateTailoredCV(cv, profile).map((issue) => issue.code)).toContain('unknown-skill');
  });

  it('rechaza una cifra nueva en un bullet', () => {
    const cv = {
      ...validCv,
      experience: [
        {
          experienceId: 'exp-nova',
          bullets: [
            {
              text: 'Analicé datos de ventas con SQL y reduje el tiempo de reporte en 40%.',
              sourceBulletId: 'nova-b1',
            },
          ],
        },
      ],
    };
    expect(validateTailoredCV(cv, profile).map((issue) => issue.code)).toContain(
      'new-number-in-bullet',
    );
  });

  it('rechaza una cifra nueva en el resumen', () => {
    const cv = { ...validCv, summary: 'Analista de datos con 7 años de experiencia.' };
    expect(validateTailoredCV(cv, profile).map((issue) => issue.code)).toContain(
      'new-number-in-summary',
    );
  });
});

describe('ajustes amarillos (stretch)', () => {
  const bullet = (text: string, stretch?: { kind: 'verb' | 'number'; note: string }) => ({
    ...validCv,
    experience: [
      {
        experienceId: 'exp-nova',
        bullets: [
          { text, sourceBulletId: 'nova-b1', ...(stretch === undefined ? {} : { stretch }) },
        ],
      },
    ],
  });

  it('acepta un redondeo de hasta +10% si está declarado', () => {
    const cv = bullet('Reduje el tiempo de reporte en 33%.', {
      kind: 'number',
      note: 'redondeo de 30 a 33',
    });

    expect(validateTailoredCV(cv, profile)).toEqual([]);
  });

  it('rechaza un redondeo de más de +10%', () => {
    const cv = bullet('Reduje el tiempo de reporte en 34%.', {
      kind: 'number',
      note: 'redondeo de 30 a 34',
    });

    expect(validateTailoredCV(cv, profile).map((issue) => issue.code)).toContain(
      'new-number-in-bullet',
    );
  });

  it('exige declarar el redondeo', () => {
    const cv = bullet('Reduje el tiempo de reporte en 33%.');
    expect(validateTailoredCV(cv, profile).map((issue) => issue.code)).toContain(
      'unmarked-stretch',
    );
  });

  it('nunca estira un año', () => {
    expect(classifyNumbers('en 2024', 'en 2020')).toEqual({
      rejected: ['2024'],
      stretched: [],
    });
  });

  it('rechaza un verbo de responsabilidad mayor no respaldado', () => {
    const cv = bullet('Lideré la estrategia de datos de la compañía.');
    expect(validateTailoredCV(cv, profile).map((issue) => issue.code)).toContain(
      'level-up-not-backed',
    );
  });

  it('permite el verbo si el bullet de origen ya lo decía', () => {
    const profileWithLeader = {
      ...profile,
      experience: profile.experience.map((experience) =>
        experience.id === 'exp-nova'
          ? {
              ...experience,
              bullets: [
                {
                  id: 'nova-b1',
                  text: 'Lideré el área de datos y reduje el tiempo de reporte en 30%.',
                },
              ],
            }
          : experience,
      ),
    };
    const cv = bullet('Lideré el área de datos y reduje el tiempo de reporte en 30%.');

    expect(validateTailoredCV(cv, profileWithLeader).map((issue) => issue.code)).not.toContain(
      'level-up-not-backed',
    );
  });

  it('rechaza una herramienta atribuida a una experiencia donde no estaba', () => {
    const cv = {
      ...validCv,
      experience: [
        {
          experienceId: 'exp-logitrans',
          bullets: [
            {
              text: 'Preparé reportes de entregas con Power BI y SQL.',
              sourceBulletId: 'logi-b2',
            },
          ],
        },
      ],
    };

    expect(validateTailoredCV(cv, profile).map((issue) => issue.code)).toContain(
      'tool-not-in-experience',
    );
  });

  it('la fidelidad estricta rechaza ajustes y afines', () => {
    const cv = {
      ...bullet('Reduje el tiempo de reporte en 33%.', {
        kind: 'number' as const,
        note: 'redondeo',
      }),
      adjacentSkills: [{ name: 'Google Sheets', basedOn: 'Excel', why: 'planillas' }],
    };

    const codes = validateTailoredCV(cv, profile, { fidelity: 'strict' }).map(
      (issue) => issue.code,
    );
    expect(codes).toContain('stretch-not-allowed');
    expect(codes).toContain('adjacent-not-allowed');
  });
});

describe('skills afines declaradas', () => {
  const profileWithDb = {
    ...profile,
    skills: [...profile.skills, { name: 'MySQL' }],
  };

  const cvWithAdjacent = (adjacent: { name: string; basedOn: string; why: string }) => ({
    ...validCv,
    skills: ['SQL', 'Power BI'],
    adjacentSkills: [adjacent],
  });

  it('acepta un par de la tabla con base real en el perfil', () => {
    const cv = cvWithAdjacent({
      name: 'PostgreSQL',
      basedOn: 'MySQL',
      why: 'Ambas son bases SQL relacionales.',
    });

    expect(validateTailoredCV(cv, profileWithDb)).toEqual([]);
  });

  it('acepta una base declarada como tecnología familiar', () => {
    const profileWithFamiliar = { ...profile, familiarSkills: ['MySQL'] };
    const cv = cvWithAdjacent({
      name: 'PostgreSQL',
      basedOn: 'MySQL',
      why: 'Tocó MySQL en un proyecto chico.',
    });

    expect(validateTailoredCV(cv, profileWithFamiliar)).toEqual([]);
  });

  it('rechaza una base que no existe en el perfil', () => {
    const cv = cvWithAdjacent({
      name: 'PostgreSQL',
      basedOn: 'Oracle',
      why: 'Bases SQL.',
    });

    expect(validateTailoredCV(cv, profileWithDb).map((issue) => issue.code)).toContain(
      'unknown-adjacent-base',
    );
  });

  it('rechaza un par que no está en la tabla de afinidades', () => {
    const cv = cvWithAdjacent({
      name: 'Kubernetes',
      basedOn: 'MySQL',
      why: 'No son afines.',
    });

    expect(validateTailoredCV(cv, profileWithDb).map((issue) => issue.code)).toContain(
      'unknown-adjacency',
    );
  });

  it('rechaza llamar afín a algo que ya está en el perfil', () => {
    const cv = cvWithAdjacent({ name: 'SQL', basedOn: 'MySQL', why: 'Ya la tengo.' });
    expect(validateTailoredCV(cv, profileWithDb).map((issue) => issue.code)).toContain(
      'redundant-adjacent',
    );
  });

  it('no permite meter la skill afín dentro de un bullet', () => {
    const cv = {
      ...cvWithAdjacent({
        name: 'PostgreSQL',
        basedOn: 'MySQL',
        why: 'Bases SQL.',
      }),
      experience: [
        {
          experienceId: 'exp-nova',
          bullets: [
            {
              text: 'Analicé datos con SQL y PostgreSQL y reduje el tiempo de reporte en 30%.',
              sourceBulletId: 'nova-b1',
            },
          ],
        },
      ],
    };

    expect(validateTailoredCV(cv, profileWithDb).map((issue) => issue.code)).toContain(
      'adjacent-in-bullet',
    );
  });
});

describe('validateCoverLetter', () => {
  const allowedText = `${JSON.stringify(profile)}\nLa oferta pide 3 años de experiencia.`;

  it('acepta cifras que existen en el perfil o la oferta', () => {
    const letter: CoverLetter = {
      greeting: 'Hola:',
      paragraphs: [
        'Tengo 4 años de experiencia en análisis de datos.',
        'Reduje el tiempo de reporte en 30% y la oferta pide 3 años.',
      ],
      closing: 'Saludos.',
    };
    expect(validateCoverLetter(letter, allowedText)).toEqual([]);
  });

  it('rechaza una cifra inventada', () => {
    const letter: CoverLetter = {
      greeting: 'Hola:',
      paragraphs: [
        'Tengo 4 años de experiencia en análisis de datos.',
        'Aumenté las ventas en 45% durante el último año.',
      ],
      closing: 'Saludos.',
    };
    expect(validateCoverLetter(letter, allowedText).map((issue) => issue.code)).toContain(
      'new-number-in-letter',
    );
  });
});
