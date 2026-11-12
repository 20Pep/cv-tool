import { type DocumentInfo, DocumentKind } from '../shared/schemas.js';
import type { AppDatabase } from './db.js';

export interface DocumentRecord {
  id: number;
  name: string;
  kind: DocumentKind;
  path: string;
  extractedText: string;
  createdAt: string;
}

export interface DocumentSource {
  name: string;
  kind: DocumentKind;
  text: string;
}

export function listDocuments(db: AppDatabase): DocumentInfo[] {
  const rows = db
    .prepare(
      `
        SELECT id, name, kind, created_at AS createdAt
        FROM documents
        ORDER BY created_at DESC, id DESC
      `,
    )
    .all() as Array<{ id: number; name: string; kind: string; createdAt: string }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: DocumentKind.parse(row.kind),
    createdAt: row.createdAt,
  }));
}

export function listDocumentsForProfile(db: AppDatabase): DocumentSource[] {
  const rows = db
    .prepare(
      `
        SELECT name, kind, extracted_text AS extractedText
        FROM documents
        WHERE extracted_text IS NOT NULL AND length(extracted_text) > 0
        ORDER BY
          CASE kind WHEN 'cv' THEN 0 ELSE 1 END,
          created_at DESC,
          id DESC
      `,
    )
    .all() as Array<{ name: string; kind: string; extractedText: string }>;

  return rows.map((row) => ({
    name: row.name,
    kind: DocumentKind.parse(row.kind),
    text: row.extractedText,
  }));
}

export function getDocument(db: AppDatabase, id: number): DocumentRecord | null {
  const row = db
    .prepare(
      `
        SELECT id, name, kind, path, extracted_text AS extractedText, created_at AS createdAt
        FROM documents
        WHERE id = ?
      `,
    )
    .get(id) as
    | {
        id: number;
        name: string;
        kind: string;
        path: string;
        extractedText: string | null;
        createdAt: string;
      }
    | undefined;

  if (row === undefined) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    kind: DocumentKind.parse(row.kind),
    path: row.path,
    extractedText: row.extractedText ?? '',
    createdAt: row.createdAt,
  };
}

export function insertDocument(
  db: AppDatabase,
  input: { name: string; kind: DocumentKind; path: string; extractedText: string },
): DocumentInfo {
  const result = db
    .prepare(
      `
        INSERT INTO documents (name, kind, path, extracted_text)
        VALUES (?, ?, ?, ?)
      `,
    )
    .run(input.name, input.kind, input.path, input.extractedText);

  return {
    id: Number(result.lastInsertRowid),
    name: input.name,
    kind: input.kind,
    createdAt: new Date().toISOString(),
  };
}

export function deleteDocumentRow(db: AppDatabase, id: number): void {
  db.prepare('DELETE FROM documents WHERE id = ?').run(id);
}
