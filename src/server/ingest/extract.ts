import path from 'node:path';
import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';

export class IngestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IngestError';
  }
}

export interface ExtractedText {
  text: string;
  pages?: number;
}

const MAX_TEXT_CHARS = 200_000;
const MAX_PDF_PAGES = 40;
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.md']);

export function isAllowedDocument(filename: string): boolean {
  return ALLOWED_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

export function hasValidSignature(buffer: Buffer, filename: string): boolean {
  const extension = path.extname(filename).toLowerCase();

  if (extension === '.pdf') {
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }

  if (extension === '.docx') {
    return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  }

  return extension === '.txt' || extension === '.md';
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  filename: string,
): Promise<ExtractedText> {
  const extension = path.extname(filename).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new IngestError('Formato no soportado. Usá PDF, DOCX, TXT o MD.');
  }

  if (!hasValidSignature(buffer, filename)) {
    throw new IngestError(
      'El contenido del archivo no coincide con su extensión. Revisá el archivo.',
    );
  }

  if (extension === '.pdf') {
    return extractPdf(buffer);
  }

  if (extension === '.docx') {
    return extractDocx(buffer);
  }

  return extractPlainText(buffer);
}

async function extractPdf(buffer: Buffer): Promise<ExtractedText> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));

    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new IngestError(`El PDF tiene ${pdf.numPages} páginas. El máximo es ${MAX_PDF_PAGES}.`);
    }

    const result = await extractText(pdf, { mergePages: true });
    const text = Array.isArray(result.text) ? result.text.join('\n') : result.text;

    return { text: validateText(text), pages: pdf.numPages };
  } catch (error) {
    if (error instanceof IngestError) {
      throw error;
    }

    throw new IngestError(
      'No pude leer el PDF. Verificá que no esté dañado o protegido con contraseña.',
    );
  }
}

async function extractDocx(buffer: Buffer): Promise<ExtractedText> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return { text: validateText(result.value) };
  } catch {
    throw new IngestError('No pude leer el DOCX. Verificá que no esté dañado.');
  }
}

function extractPlainText(buffer: Buffer): ExtractedText {
  const text = new TextDecoder('utf-8', { fatal: false })
    .decode(buffer)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n');

  return { text: validateText(text) };
}

function validateText(raw: string): string {
  const text = raw.trim();

  if (text.length < 20) {
    throw new IngestError(
      'El documento no tiene texto suficiente. Si es un PDF escaneado, necesitás una versión con texto seleccionable.',
    );
  }

  if (text.length > MAX_TEXT_CHARS) {
    throw new IngestError(
      `El documento tiene demasiado texto (${text.length.toLocaleString('es-AR')} caracteres). El máximo es ${MAX_TEXT_CHARS.toLocaleString('es-AR')}.`,
    );
  }

  return text;
}
