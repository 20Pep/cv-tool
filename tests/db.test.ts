import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../src/server/db.js';
import { PACKAGE_ROOT } from '../src/server/paths.js';

const migrationsDir = path.join(PACKAGE_ROOT, 'migrations');
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((directory) => rm(directory, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('openDatabase', () => {
  it('aplica la migración 001 y crea las tablas', () => {
    const db = openDatabase(':memory:', migrationsDir);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual(
      expect.arrayContaining([
        'applications',
        'documents',
        'profile',
        'schema_migrations',
        'settings',
        'status_history',
      ]),
    );
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(
      (db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get() as { count: number })
        .count,
    ).toBe(1);

    db.close();
  });

  it('es idempotente y usa WAL en un archivo', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'cvtool-db-'));
    tempDirs.push(directory);
    const dbPath = path.join(directory, 'cv.sqlite');

    const first = openDatabase(dbPath, migrationsDir);
    expect(first.pragma('journal_mode', { simple: true })).toBe('wal');
    first.close();

    const second = openDatabase(dbPath, migrationsDir);
    expect(
      (
        second.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get() as {
          count: number;
        }
      ).count,
    ).toBe(1);
    second.close();
  });

  it('rechaza un estado inválido en status_history', () => {
    const db = openDatabase(':memory:', migrationsDir);

    db.prepare(
      "INSERT INTO applications (company, position, job_text) VALUES ('Acme', 'Analista', 'texto')",
    ).run();

    expect(() =>
      db
        .prepare("INSERT INTO status_history (application_id, status) VALUES (1, 'inventado')")
        .run(),
    ).toThrow();

    db.close();
  });
});
