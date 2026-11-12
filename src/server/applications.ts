import { z } from 'zod';
import { type ApplicationInfo, ApplicationStatus } from '../shared/schemas.js';
import type { AppDatabase } from './db.js';

const KeywordsSchema = z.array(z.string());

export interface StoredApplication extends ApplicationInfo {
  jobText: string;
  tailoredJson: string;
}

export interface CreateApplicationInput {
  company: string;
  position: string;
  url?: string;
  jobText: string;
  matchPct: number;
  missingKeywords: string[];
  cvPath: string;
  letterPath: string;
  tailoredJson: string;
}

export function createApplication(
  db: AppDatabase,
  input: CreateApplicationInput,
): StoredApplication {
  const result = db
    .prepare(
      `
        INSERT INTO applications (
          company, position, url, job_text, status, match_pct,
          missing_keywords, cv_path, letter_path, tailored_json
        )
        VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
      `,
    )
    .run(
      input.company,
      input.position,
      input.url === undefined || input.url.length === 0 ? null : input.url,
      input.jobText,
      input.matchPct,
      JSON.stringify(input.missingKeywords),
      input.cvPath,
      input.letterPath,
      input.tailoredJson,
    );

  const id = Number(result.lastInsertRowid);
  db.prepare("INSERT INTO status_history (application_id, status) VALUES (?, 'draft')").run(id);

  const application = getApplication(db, id);

  if (application === null) {
    throw new Error('No pude guardar la postulación.');
  }

  return application;
}

export function getApplication(db: AppDatabase, id: number): StoredApplication | null {
  const row = db
    .prepare(
      `
        SELECT
          id, company, position, url, job_text AS jobText, status,
          sent_at AS sentAt, match_pct AS matchPct,
          missing_keywords AS missingKeywords, cv_path AS cvPath,
          letter_path AS letterPath, tailored_json AS tailoredJson,
          notes, created_at AS createdAt, updated_at AS updatedAt
        FROM applications
        WHERE id = ?
      `,
    )
    .get(id) as RawApplicationRow | undefined;

  return row === undefined ? null : toStoredApplication(row);
}

export function listApplications(db: AppDatabase): ApplicationInfo[] {
  const rows = db
    .prepare(
      `
        SELECT
          id, company, position, url, job_text AS jobText, status,
          sent_at AS sentAt, match_pct AS matchPct,
          missing_keywords AS missingKeywords, cv_path AS cvPath,
          letter_path AS letterPath, tailored_json AS tailoredJson,
          notes, created_at AS createdAt, updated_at AS updatedAt
        FROM applications
        ORDER BY created_at DESC, id DESC
      `,
    )
    .all() as RawApplicationRow[];

  return rows.map((row) => {
    const application = toStoredApplication(row);
    return {
      id: application.id,
      company: application.company,
      position: application.position,
      url: application.url,
      status: application.status,
      sentAt: application.sentAt,
      matchPct: application.matchPct,
      missingKeywords: application.missingKeywords,
      cvPath: application.cvPath,
      letterPath: application.letterPath,
      notes: application.notes,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };
  });
}

interface RawApplicationRow {
  id: number;
  company: string;
  position: string;
  url: string | null;
  jobText: string;
  status: string;
  sentAt: string | null;
  matchPct: number | null;
  missingKeywords: string | null;
  cvPath: string | null;
  letterPath: string | null;
  tailoredJson: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function toStoredApplication(row: RawApplicationRow): StoredApplication {
  const parsedKeywords =
    row.missingKeywords === null
      ? []
      : (() => {
          try {
            const parsed = KeywordsSchema.safeParse(JSON.parse(row.missingKeywords));
            return parsed.success ? parsed.data : [];
          } catch {
            return [];
          }
        })();

  return {
    id: row.id,
    company: row.company,
    position: row.position,
    url: row.url,
    status: ApplicationStatus.parse(row.status),
    sentAt: row.sentAt,
    matchPct: row.matchPct,
    missingKeywords: parsedKeywords,
    cvPath: row.cvPath,
    letterPath: row.letterPath,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    jobText: row.jobText,
    tailoredJson: row.tailoredJson ?? '',
  };
}
