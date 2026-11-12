const SPANISH_STOPWORDS = new Set([
  'a',
  'al',
  'algo',
  'algunas',
  'algunos',
  'ante',
  'antes',
  'como',
  'con',
  'contra',
  'cual',
  'cuando',
  'de',
  'del',
  'desde',
  'donde',
  'durante',
  'e',
  'el',
  'ella',
  'ellas',
  'ellos',
  'en',
  'entre',
  'era',
  'eres',
  'es',
  'esa',
  'esas',
  'ese',
  'eso',
  'esos',
  'esta',
  'estas',
  'este',
  'esto',
  'estos',
  'fue',
  'ha',
  'hace',
  'hasta',
  'hay',
  'la',
  'las',
  'le',
  'les',
  'lo',
  'los',
  'mas',
  'me',
  'mi',
  'mis',
  'mucho',
  'muy',
  'no',
  'nos',
  'o',
  'para',
  'pero',
  'por',
  'porque',
  'que',
  'se',
  'sin',
  'sobre',
  'su',
  'sus',
  'te',
  'tiene',
  'todo',
  'tu',
  'tus',
  'un',
  'una',
  'uno',
  'unos',
  'y',
  'ya',
]);

const ENGLISH_STOPWORDS = new Set([
  'a',
  'about',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'but',
  'by',
  'can',
  'do',
  'for',
  'from',
  'has',
  'have',
  'he',
  'her',
  'his',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'more',
  'most',
  'my',
  'no',
  'not',
  'of',
  'on',
  'or',
  'our',
  'out',
  'she',
  'so',
  'that',
  'the',
  'their',
  'them',
  'there',
  'these',
  'they',
  'this',
  'to',
  'us',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'will',
  'with',
  'you',
  'your',
]);

const GENERIC_FILLER = new Set([
  'acciones',
  'acompanar',
  'acompañar',
  'adquirir',
  'analisis',
  'análisis',
  'analysis',
  'analizar',
  'analyze',
  'asegurar',
  'build',
  'colaborar',
  'collaborate',
  'compare',
  'comparar',
  'comunicacion',
  'comunicación',
  'comunication',
  'construccion',
  'construcción',
  'construir',
  'coordinar',
  'coordinate',
  'definir',
  'define',
  'definitions',
  'deploy',
  'desarrollar',
  'desarrollo',
  'desarrollar',
  'detectar',
  'develop',
  'development',
  'direccion',
  'dirección',
  'documentar',
  'document',
  'drive',
  'ensure',
  'environments',
  'escribir',
  'escrita',
  'excluyente',
  'explicar',
  'mantener',
  'negocio',
  'non',
  'objetivo',
  'partner',
  'prioridades',
  'reales',
  'superior',
  'tecnicas',
  'técnicas',
  'explain',
  'follow',
  'gestionar',
  'improve',
  'impulsar',
  'liderar',
  'maintain',
  'managers',
  'mejorar',
  'monitor',
  'nuevas',
  'optimizar',
  'participar',
  'participate',
  'planificar',
  'plan',
  'preparar',
  'prepare',
  'principales',
  'producir',
  'produce',
  'produccion',
  'producción',
  'reportar',
  'results',
  'resultados',
  'retener',
  'review',
  'seguir',
  'supervisar',
  'supervise',
  'support',
  'sumarse',
  'track',
  'trabajar',
  'work',
  'write',
  'ano',
  'anos',
  'anual',
  'annual',
  'año',
  'años',
  'area',
  'areas',
  'automatizacion',
  'automatización',
  'automatizar',
  'automate',
  'automation',
  'avanzado',
  'advanced',
  'b1',
  'b2',
  'basico',
  'básico',
  'beneficio',
  'beneficios',
  'benefits',
  'budget',
  'buena',
  'buscamos',
  'candidato',
  'candidata',
  'capacidad',
  'capacitacion',
  'capacitación',
  'cargo',
  'cargos',
  'claras',
  'closely',
  'company',
  'construir',
  'consumo',
  'contenido',
  'coordinar',
  'design',
  'desarrollar',
  'desarrollo',
  'estrategia',
  'flexible',
  'maintain',
  'procesos',
  'services',
  'work',
  'conocimiento',
  'conocimientos',
  'conocer',
  'convenio',
  'cordoba',
  'córdoba',
  'empresa',
  'empresas',
  'equipo',
  'equipos',
  'excelente',
  'excellent',
  'experiencia',
  'experience',
  'fictional',
  'ficticia',
  'fuerte',
  'habilidad',
  'habilidades',
  'health',
  'herramienta',
  'herramientas',
  'hibrido',
  'híbrido',
  'insurance',
  'intermedio',
  'intermediate',
  'knowledge',
  'learning',
  'location',
  'manejo',
  'manejar',
  'market',
  'modalidad',
  'nivel',
  'ofrecemos',
  'obra',
  'persona',
  'personas',
  'perfil',
  'puesto',
  'puestos',
  'remote',
  'remoto',
  'requisito',
  'requisitos',
  'requirements',
  'responsabilidad',
  'responsabilidades',
  'responsibilities',
  'rol',
  'role',
  'salario',
  'schedule',
  'social',
  'sueldo',
  'strong',
  'tecnologia',
  'tecnologias',
  'tecnología',
  'tecnologías',
  'trabajo',
  'trabajar',
  'type',
  'ubicacion',
  'ubicación',
  'uso',
  'usar',
  'vacaciones',
  'years',
]);

const STOPWORDS = new Set([...SPANISH_STOPWORDS, ...ENGLISH_STOPWORDS, ...GENERIC_FILLER]);

const TECH_TERMS = new Set([
  'airflow',
  'angular',
  'ansible',
  'api',
  'apis',
  'aws',
  'azure',
  'bash',
  'bigquery',
  'c#',
  'c++',
  'ci cd',
  'ci/cd',
  'email marketing',
  'google analytics',
  'meta ads',
  'node js',
  'power bi',
  'rest apis',
  'css',
  'dbt',
  'django',
  'docker',
  'etl',
  'excel',
  'fastapi',
  'figma',
  'flask',
  'flutter',
  'gcp',
  'git',
  'github',
  'gitlab',
  'google analytics',
  'hadoop',
  'html',
  'java',
  'javascript',
  'jenkins',
  'jira',
  'kotlin',
  'kubernetes',
  'laravel',
  'linux',
  'looker',
  'machine learning',
  'meta ads',
  'mongodb',
  'mysql',
  'next.js',
  'node',
  'node.js',
  'numpy',
  'pandas',
  'php',
  'postgresql',
  'power bi',
  'powerbi',
  'python',
  'qlik',
  'react',
  'react native',
  'rest',
  'salesforce',
  'sap',
  'scrum',
  'seo',
  'sem',
  'snowflake',
  'spark',
  'spring',
  'sql',
  'swift',
  'tableau',
  'tailwind',
  'terraform',
  'typescript',
  'vue',
]);

const REQUIREMENT_HEADING =
  /(requisitos|requerimientos|requirements|qualifications|must have|nice to have|buscamos|we are looking for|responsabilidades|responsibilities|perfil|about you|what you.?ll need)/i;

export interface KeywordOptions {
  limit?: number;
}

export interface KeywordMatch {
  keywords: string[];
  matched: string[];
  missing: string[];
  matchPct: number;
}

export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractKeywords(text: string, options: KeywordOptions = {}): string[] {
  const limit = options.limit ?? 30;
  const lines = candidateLines(text);
  const requirementText = normalizeForMatch(extractRequirementText(text));
  const counts = new Map<string, number>();

  for (const line of lines) {
    const tokens = tokenize(line);

    for (let size = 1; size <= 3; size += 1) {
      for (let index = 0; index <= tokens.length - size; index += 1) {
        const slice = tokens.slice(index, index + size);

        if (slice.some((token) => STOPWORDS.has(token))) {
          continue;
        }

        if (slice.some((token) => token.length < 2)) {
          continue;
        }

        const keyword = slice.join(' ');

        if (/^\d+$/.test(keyword)) {
          continue;
        }

        counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
      }
    }
  }

  const candidates = [...counts.entries()]
    .map(([keyword, frequency]) => {
      const words = keyword.split(' ');
      const inRequirements = requirementText.includes(keyword);
      const technical = words.some((word) => TECH_TERMS.has(word)) || TECH_TERMS.has(keyword);

      return {
        keyword,
        frequency,
        words: words.length,
        score:
          frequency +
          (inRequirements ? 3 : 0) +
          (technical ? 2 : 0) +
          Math.max(0, words.length - 1) * 0.5,
      };
    })
    .filter((candidate) => {
      if (candidate.words === 1) {
        return true;
      }

      return candidate.frequency >= 3 || TECH_TERMS.has(candidate.keyword);
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.words - left.words ||
        left.keyword.localeCompare(right.keyword),
    );

  const selected: string[] = [];

  for (const candidate of candidates) {
    if (selected.length >= limit) {
      break;
    }

    if (selected.includes(candidate.keyword)) {
      continue;
    }

    if (
      candidate.words === 1 &&
      selected.some((selectedKeyword) => selectedKeyword.split(' ').includes(candidate.keyword))
    ) {
      continue;
    }

    selected.push(candidate.keyword);
  }

  return selected.filter(
    (keyword) =>
      keyword.includes(' ') ||
      !selected.some(
        (selectedKeyword) =>
          selectedKeyword.includes(' ') && selectedKeyword.split(' ').includes(keyword),
      ),
  );
}

export function matchKeywords(offerKeywords: string[], cvText: string): KeywordMatch {
  const cv = ` ${normalizeForMatch(cvText)} `;
  const matched: string[] = [];
  const missing: string[] = [];

  for (const keyword of offerKeywords) {
    const normalized = normalizeForMatch(keyword);
    const pattern = new RegExp(`(?:^| )${escapeRegExp(normalized)}(?: |$)`);

    if (pattern.test(cv)) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  const total = offerKeywords.length;

  return {
    keywords: offerKeywords,
    matched,
    missing,
    matchPct: total === 0 ? 0 : Math.round((matched.length / total) * 100),
  };
}

export function analyzeOffer(
  offerText: string,
  cvText: string,
  options: KeywordOptions = {},
): KeywordMatch {
  return matchKeywords(extractKeywords(offerText, options), cvText);
}

export function extractRequirementText(text: string): string {
  const lines = text.split(/\r?\n/);
  const result: string[] = [];
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      continue;
    }

    if (REQUIREMENT_HEADING.test(trimmed) && trimmed.length < 100) {
      inSection = true;
      result.push(trimmed);
      continue;
    }

    if (inSection && isSectionHeading(trimmed)) {
      inSection = false;
      continue;
    }

    if (inSection || /^\s*[-*•]/.test(line)) {
      result.push(trimmed);
    }
  }

  return result.join('\n');
}

function tokenize(text: string): string[] {
  return normalizeForMatch(text)
    .split(' ')
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token) && !/^\d+\+?$/.test(token));
}

type Section = 'requirements' | 'responsibilities' | 'other';

function candidateLines(text: string): string[] {
  const lines: string[] = [];
  let section: Section = 'other';

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line.length === 0) {
      continue;
    }

    if (isHeadingLine(line)) {
      section = classifySection(line);
      continue;
    }

    if (
      /^\*\*(empresa|company|ubicación|ubicacion|location|modalidad|type|salario|sueldo|jornada|schedule)\b/i.test(
        line,
      )
    ) {
      continue;
    }

    const isBullet = /^\s*[-*•]/.test(rawLine);
    const technical = hasTechTerm(line);

    if (section === 'other' && !technical) {
      continue;
    }

    if (isBullet && section === 'other') {
      continue;
    }

    lines.push(cleanLine(line));
  }

  return lines;
}

function isHeadingLine(line: string): boolean {
  if (/^#+\s/.test(line)) {
    return true;
  }

  if (line.length > 80) {
    return false;
  }

  return (
    /^(sobre el puesto|about the role|responsabilidades|responsibilities|requisitos|requirements|beneficios|benefits|descripción|description|perfil|about you|what you.?ll need|funciones|what you.?ll do)\b/i.test(
      line,
    ) || /^\*\*[^*]+\*\*:?$/.test(line)
  );
}

function classifySection(line: string): Section {
  if (
    /(requisitos|requirements|qualifications|must have|nice to have|about you|what you.?ll need|perfil)/i.test(
      line,
    )
  ) {
    return 'requirements';
  }

  if (/(responsabilidades|responsibilities|funciones|what you.?ll do)/i.test(line)) {
    return 'responsibilities';
  }

  return 'other';
}

function cleanLine(line: string): string {
  return line.replace(/^[-*•]\s*/, '').replace(/\*\*/g, '');
}

function hasTechTerm(text: string): boolean {
  return normalizeForMatch(text)
    .split(' ')
    .some((token) => TECH_TERMS.has(token));
}

function isSectionHeading(line: string): boolean {
  if (line.length > 60 || /^\s*[-*•]/.test(line)) {
    return false;
  }

  return (
    /^[A-ZÁÉÍÓÚÑ0-9\s/&]+$/.test(line) ||
    /^(sobre|about|beneficios|benefits|responsabilidades|responsibilities|requisitos|requirements|educaci[oó]n|education|habilidades|skills|idiomas|languages)\b/i.test(
      line,
    )
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
