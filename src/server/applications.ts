import { z } from 'zod';
import {
  type ApplicationInfo,
  ApplicationStatus,
  type StatusHistoryEntry,
} from '../shared/schemas.js';
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

export interface ApplicationFilters {
  status?: ApplicationStatus;
  query?: string;
}

export function listApplications(
  db: AppDatabase,
  filters: ApplicationFilters = {},
): ApplicationInfo[] {
  const clauses: string[] = [];
  const parameters: unknown[] = [];

  if (filters.status !== undefined) {
    clauses.push('status = ?');
    parameters.push(filters.status);
  }

  if (filters.query !== undefined && filters.query.trim().length > 0) {
    clauses.push('(company LIKE ? OR position LIKE ?)');
    const pattern = `%${filters.query.trim()}%`;
    parameters.push(pattern, pattern);
  }

  const where = clauses.length === 0 ? '' : `WHERE ${clauses.join(' AND ')}`;
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
        ${where}
        ORDER BY created_at DESC, id DESC
      `,
    )
    .all(...parameters) as RawApplicationRow[];

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

export function getApplicationHistory(
  db: AppDatabase,
  applicationId: number,
): StatusHistoryEntry[] {
  const rows = db
    .prepare(
      `
        SELECT id, status, changed_at AS changedAt, note
        FROM status_history
        WHERE application_id = ?
        ORDER BY changed_at ASC, id ASC
      `,
    )
    .all(applicationId) as Array<{
    id: number;
    status: string;
    changedAt: string;
    note: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    status: ApplicationStatus.parse(row.status),
    changedAt: row.changedAt,
    note: row.note,
  }));
}

export interface UpdateApplicationInput {
  status?: ApplicationStatus;
  notes?: string;
  url?: string;
  company?: string;
  position?: string;
}

export function updateApplication(
  db: AppDatabase,
  id: number,
  input: UpdateApplicationInput,
): StoredApplication | null {
  const existing = getApplication(db, id);

  if (existing === null) {
    return null;
  }

  const updates: string[] = [];
  const parameters: unknown[] = [];

  if (input.status !== undefined) {
    updates.push('status = ?');
    parameters.push(input.status);
    updates.push(
      "sent_at = CASE WHEN ? = 'sent' AND sent_at IS NULL THEN datetime('now') ELSE sent_at END",
    );
    parameters.push(input.status);
  }

  if (input.notes !== undefined) {
    updates.push('notes = ?');
    parameters.push(input.notes);
  }

  if (input.url !== undefined) {
    const url = input.url.trim();
    updates.push('url = ?');
    parameters.push(url.length === 0 ? null : url);
  }

  if (input.company !== undefined) {
    updates.push('company = ?');
    parameters.push(input.company.trim());
  }

  if (input.position !== undefined) {
    updates.push('position = ?');
    parameters.push(input.position.trim());
  }

  if (updates.length === 0) {
    return existing;
  }

  updates.push("updated_at = datetime('now')");
  db.prepare(`UPDATE applications SET ${updates.join(', ')} WHERE id = ?`).run(...parameters, id);

  if (input.status !== undefined && input.status !== existing.status) {
    db.prepare('INSERT INTO status_history (application_id, status, note) VALUES (?, ?, ?)').run(
      id,
      input.status,
      input.notes ?? null,
    );
  }

  return getApplication(db, id);
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
