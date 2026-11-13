import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { buildCvTextForMatch } from '../../src/shared/cvText';
import { extractKeywords, matchKeywords } from '../../src/shared/keywords';
import type { CoverLetter, PreviewApplicationResponse, TailoredCV } from '../../src/shared/schemas';

const profile = JSON.parse(readFileSync('fixtures/profile.json', 'utf8'));
const offer = readFileSync('fixtures/offers/analista-ia-es.md', 'utf8');

/**
 * Reproduce el flujo completo de una postulación. La IA se simula interceptando
 * `/api/applications/preview`: el resto (validación, PDFs, tracker, descargas)
 * corre de verdad contra el servidor, que no necesita IA para eso.
 */
test('flujo de postulación: previsualizar, editar, validar y descargar', async ({ page }) => {
  // El launch token es de un solo uso; acá la sesión se arma con la cookie
  // conocida del entorno de pruebas.
  await page.context().addCookies([
    {
      name: 'cvtool_session',
      value: 'e2e-session',
      domain: '127.0.0.1',
      path: '/',
    },
  ]);

  await page.goto('/');

  const savedProfile = await page.request.put('/api/profile', { data: { profile } });
  expect(savedProfile.ok()).toBe(true);

  const preview = buildMockPreview();
  await page.route('**/api/applications/preview', (route) => route.fulfill({ json: preview }));

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Pegá la oferta' })).toBeVisible();

  await page.getByPlaceholder(/Pegá acá el texto completo de la oferta/).fill(offer);
  await page.getByRole('button', { name: 'Generar vista previa' }).click();

  await expect(page.getByRole('heading', { name: 'Vista previa del CV' })).toBeVisible();
  await expect(page.getByText('Analista de Datos con orientación a IA ·')).toBeVisible();

  // Edición con una skill que no existe en el perfil: la UI debe rechazarla con
  // el mensaje específico antes de que el guardado falle en el servidor.
  const invalidCv: TailoredCV = {
    ...preview.tailoredCv,
    skills: ['SQL', 'Power BI', 'Excel', 'Docker'],
  };
  await fillEditor(page, 'CV adaptado (JSON)', JSON.stringify(invalidCv, null, 2));
  await page.getByRole('button', { name: 'Validar edición' }).click();
  await expect(page.getByText(/La skill "Docker" no existe en el perfil\./)).toBeVisible();

  // Edición válida: la UI acepta los cambios y recalcula el match con el mismo
  // código que usa el servidor.
  await fillEditor(page, 'CV adaptado (JSON)', JSON.stringify(preview.tailoredCv, null, 2));
  await page.getByRole('button', { name: 'Validar edición' }).click();
  await expect(page.getByText(/Edición validada\. Match recalculado: \d+%/)).toBeVisible();

  // Descarga el CV ANTES de guardar: se genera al momento y no debe quedar
  // ninguna postulación en el tracker por esta acción.
  const earlyDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar CV', exact: true }).click();
  expect((await earlyDownload).suggestedFilename()).toMatch(/^Ana_Perez_.*\.pdf$/);

  const earlyLetterDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar la carta', exact: true }).click();
  expect((await earlyLetterDownload).suggestedFilename()).toMatch(/^Ana_Perez_.*_Carta\.pdf$/);

  await page.getByRole('button', { name: 'Guardar en el tracker' }).click();
  await expect(page.getByText(/Postulación #\d+ guardada como borrador\./)).toBeVisible();

  // Después de guardar no se repiten las descargas: solo el acceso al tracker.
  await expect(page.getByRole('link', { name: 'Ir al tracker' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Descargar/ })).toHaveCount(0);
});

test('tracker: elimina una postulación con confirmación', async ({ page }) => {
  await page.context().addCookies([
    {
      name: 'cvtool_session',
      value: 'e2e-session',
      domain: '127.0.0.1',
      path: '/',
    },
  ]);

  await page.goto('/tracker');
  await page.getByRole('heading', { name: 'Tracker', level: 1 }).waitFor();

  const rows = page.locator('tbody tr');
  const initialCount = await rows.count();

  if (initialCount === 0) {
    test.skip(true, 'No hay postulaciones para eliminar en esta corrida.');
    return;
  }

  await rows.first().getByRole('button', { name: 'Eliminar' }).click();
  await rows.first().getByRole('button', { name: 'Confirmar' }).click();

  await expect(page.getByText(/eliminada del tracker\./)).toBeVisible();
  await expect(rows).toHaveCount(initialCount - 1);
});

function buildMockPreview(): PreviewApplicationResponse {
  const nova = profile.experience.find(
    (experience: { id: string }) => experience.id === 'exp-nova',
  );

  if (nova === undefined) {
    throw new Error('El fixture de perfil no tiene la experiencia exp-nova.');
  }

  const tailoredCv: TailoredCV = {
    summary: profile.summary,
    headline: 'Analista de datos con foco en IA',
    experience: [
      {
        experienceId: 'exp-nova',
        bullets: nova.bullets.map((bullet: { id: string; text: string }) => ({
          text: bullet.text,
          sourceBulletId: bullet.id,
        })),
      },
    ],
    skills: ['SQL', 'Power BI', 'Excel'],
    keywordsUsed: [],
    keywordsMissing: [],
  };

  const keywords = matchKeywords(
    extractKeywords(offer, { limit: 20 }),
    buildCvTextForMatch(profile, tailoredCv),
  );

  const coverLetter: CoverLetter = {
    greeting: 'Hola,',
    paragraphs: [
      'Les escribo porque la búsqueda de Analista de Datos con foco en IA se alinea con mi experiencia en análisis y automatización de reportes.',
      'En Nova Retail construí tableros y automatizaciones que siguen usando los equipos, y me interesa llevar ese trabajo hacia soluciones con IA.',
    ],
    closing: 'Saludos, Ana Pérez',
  };

  return {
    tailoredCv: {
      ...tailoredCv,
      keywordsUsed: keywords.matched,
      keywordsMissing: keywords.missing,
    },
    coverLetter,
    keywords,
    suggestedCompany: 'Talento & Datos',
    suggestedPosition: 'Analista de Datos con orientación a IA',
  };
}

async function fillEditor(page: Page, label: string, value: string): Promise<void> {
  const labelLocator = page.getByText(label, { exact: true });
  const editor = labelLocator.locator('xpath=following-sibling::textarea');
  await editor.fill(value);
}
