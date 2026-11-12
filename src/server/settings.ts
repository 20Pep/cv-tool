import { DEFAULT_LLM_SETTINGS, LLMSettings } from '../shared/schemas.js';
import type { AppDatabase } from './db.js';

const LLM_KEY = 'llm';

export function getLlmSettings(db: AppDatabase): LLMSettings {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(LLM_KEY) as
    | { value: string }
    | undefined;

  if (row === undefined) {
    return { ...DEFAULT_LLM_SETTINGS };
  }

  try {
    const parsed = LLMSettings.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : { ...DEFAULT_LLM_SETTINGS };
  } catch {
    return { ...DEFAULT_LLM_SETTINGS };
  }
}

export function saveLlmSettings(db: AppDatabase, settings: LLMSettings): LLMSettings {
  const parsed = LLMSettings.parse(settings);

  db.prepare(
    `
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT (key) DO UPDATE SET value = excluded.value
    `,
  ).run(LLM_KEY, JSON.stringify(parsed));

  return parsed;
}
