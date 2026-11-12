import { MasterProfile } from '../../shared/schemas.js';
import type { AppDatabase } from '../db.js';

export interface StoredProfile {
  profile: MasterProfile;
  version: number;
  updatedAt: string;
}

export function getStoredProfile(db: AppDatabase): StoredProfile | null {
  const row = db
    .prepare('SELECT data, version, updated_at AS updatedAt FROM profile WHERE id = 1')
    .get() as { data: string; version: number; updatedAt: string } | undefined;

  if (row === undefined) {
    return null;
  }

  try {
    const parsed = MasterProfile.safeParse(JSON.parse(row.data));

    if (!parsed.success) {
      return null;
    }

    return {
      profile: parsed.data,
      version: row.version,
      updatedAt: row.updatedAt,
    };
  } catch {
    return null;
  }
}

export function saveProfile(db: AppDatabase, profile: MasterProfile): StoredProfile {
  const parsed = MasterProfile.parse(profile);

  db.prepare(
    `
      INSERT INTO profile (id, data, version, updated_at)
      VALUES (1, ?, 1, datetime('now'))
      ON CONFLICT (id) DO UPDATE SET
        data = excluded.data,
        version = version + 1,
        updated_at = datetime('now')
    `,
  ).run(JSON.stringify(parsed));

  const saved = getStoredProfile(db);

  if (saved === null) {
    throw new Error('No pude guardar el perfil maestro.');
  }

  return saved;
}
