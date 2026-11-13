import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { type AppDatabase, openDatabase } from '../src/server/db.js';
import { PACKAGE_ROOT } from '../src/server/paths.js';
import { getLlmSettings, saveLlmSettings } from '../src/server/settings.js';
import { DEFAULT_LLM_SETTINGS } from '../src/shared/schemas.js';

const migrationsDir = path.join(PACKAGE_ROOT, 'migrations');
let db: AppDatabase;

afterEach(() => {
  db.close();
});

describe('settings de LLM', () => {
  it('devuelve el default cuando no hay ajustes guardados', () => {
    db = openDatabase(':memory:', migrationsDir);
    expect(getLlmSettings(db)).toEqual(DEFAULT_LLM_SETTINGS);
  });

  it('guarda y recupera la selección', () => {
    db = openDatabase(':memory:', migrationsDir);
    const selection = {
      provider: 'opencode-go',
      model: 'mimo-v2.5',
      variant: 'low',
    };

    expect(saveLlmSettings(db, selection)).toEqual(selection);
    expect(getLlmSettings(db)).toEqual(selection);
  });

  it('guarda la fidelidad elegida', () => {
    db = openDatabase(':memory:', migrationsDir);
    const selection = {
      provider: 'opencode-go',
      model: 'mimo-v2.5',
      variant: 'low',
      fidelity: 'strict' as const,
    };

    expect(saveLlmSettings(db, selection)).toEqual(selection);
    expect(getLlmSettings(db).fidelity).toBe('strict');
  });

  it('vuelve al default si el JSON guardado es inválido', () => {
    db = openDatabase(':memory:', migrationsDir);
    db.prepare("INSERT INTO settings (key, value) VALUES ('llm', 'esto no es json')").run();

    expect(getLlmSettings(db)).toEqual(DEFAULT_LLM_SETTINGS);
  });

  it('vuelve al default si el JSON no cumple el esquema', () => {
    db = openDatabase(':memory:', migrationsDir);
    db.prepare('INSERT INTO settings (key, value) VALUES (\'llm\', \'{"provider":""}\')').run();

    expect(getLlmSettings(db)).toEqual(DEFAULT_LLM_SETTINGS);
  });
});
