import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import type { CoverLetter, MasterProfile, TailoredCV } from '../../shared/schemas.js';
import { detectLanguage, type Language } from '../generate/language.js';
import { CvDocument } from './CvDocument.js';
import { buildPdfFilename, uniqueFilename } from './filename.js';
import { LetterDocument } from './LetterDocument.js';

export interface RenderApplicationInput {
  profile: MasterProfile;
  tailoredCv: TailoredCV;
  coverLetter: CoverLetter;
  company: string;
  position: string;
  jobText: string;
  outputsDir: string;
}

export interface RenderedApplication {
  cvFilename: string;
  letterFilename: string;
  language: Language;
}

export async function renderCvPdf(
  profile: MasterProfile,
  tailoredCv: TailoredCV,
  language: Language,
): Promise<Buffer> {
  return renderToBuffer(createElement(CvDocument, { profile, tailoredCv, language }));
}

export async function renderLetterPdf(
  profile: MasterProfile,
  coverLetter: CoverLetter,
  language: Language,
  company: string,
  position: string,
): Promise<Buffer> {
  return renderToBuffer(
    createElement(LetterDocument, { profile, coverLetter, language, company, position }),
  );
}

export async function renderApplicationPdfs(
  input: RenderApplicationInput,
): Promise<RenderedApplication> {
  const language = detectLanguage(input.jobText);
  const fullName = input.profile.basics.fullName;
  const cvFilename = uniqueFilename(
    input.outputsDir,
    buildPdfFilename({ fullName, position: input.position, company: input.company }, 'cv'),
  );
  const letterFilename = uniqueFilename(
    input.outputsDir,
    buildPdfFilename({ fullName, position: input.position, company: input.company }, 'letter'),
  );

  const [cvBuffer, letterBuffer] = await Promise.all([
    renderCvPdf(input.profile, input.tailoredCv, language),
    renderLetterPdf(input.profile, input.coverLetter, language, input.company, input.position),
  ]);

  await mkdir(input.outputsDir, { recursive: true });
  const cvFile = path.join(input.outputsDir, cvFilename);
  const letterFile = path.join(input.outputsDir, letterFilename);

  try {
    await writeFile(cvFile, cvBuffer);
    await writeFile(letterFile, letterBuffer);
  } catch (error) {
    await Promise.all([rm(cvFile, { force: true }), rm(letterFile, { force: true })]);
    throw error;
  }

  return { cvFilename, letterFilename, language };
}
