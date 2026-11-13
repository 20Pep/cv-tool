import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const profile = JSON.parse(readFileSync('fixtures/profile.json', 'utf8'));

test('flujo base de la interfaz', async ({ page }) => {
  await page.goto('/?t=e2e-launch');

  await expect(page).toHaveURL('http://127.0.0.1:3200/');
  await expect(page.getByRole('heading', { name: 'Adaptá tu CV a la oferta' })).toBeVisible();
  await expect(page.getByText('Servidor local: conectado')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cargar mi perfil' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Cambiar a modo oscuro' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Cambiar a modo claro' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);

  await page.getByRole('link', { name: 'Ajustes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'OpenCode' })).toBeVisible();

  await page.getByRole('link', { name: 'Perfil', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu perfil' })).toBeVisible();

  await page.setInputFiles('input[type=file]', 'fixtures/documents/ana-perez-cv.txt');
  await page.getByRole('button', { name: 'Subir documento' }).click();
  await expect(page.getByText('ana-perez-cv.txt')).toBeVisible();

  // El perfil todavía no está guardado: el inicio debe seguir pidiendo cargarlo.
  await page.getByRole('link', { name: 'Inicio', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Cargar mi perfil' }).first()).toBeVisible();

  // Al guardar el perfil, el inicio debe pasar a ofrecer “Adaptar para la oferta”.
  const saved = await page.request.put('/api/profile', {
    data: { profile },
  });
  expect(saved.ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Pegá la oferta' })).toBeVisible();
  await expect(page.getByPlaceholder(/Pegá acá el texto completo de la oferta/)).toBeVisible();

  await page.getByRole('link', { name: 'Tracker', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tracker' })).toBeVisible();
  await expect(page.getByText('Todavía no hay postulaciones.')).toBeVisible();

  // El editor amigable arranca en modo formulario y guarda cambios reales.
  await page.getByRole('link', { name: 'Perfil', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu perfil' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Formulario' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'JSON avanzado' })).toBeVisible();

  await page.getByLabel('Nombre completo').fill('Ana Pérez Gómez');
  await page.getByRole('button', { name: 'Guardar perfil' }).click();
  await expect(page.getByText('Perfil guardado.')).toBeVisible();

  const updated = await page.request.get('/api/profile');
  expect((await updated.json()).profile.basics.fullName).toBe('Ana Pérez Gómez');

  // El modo JSON sigue disponible como alternativa avanzada.
  await page.getByRole('button', { name: 'JSON avanzado' }).click();
  await expect(page.getByText('Formatear JSON')).toBeVisible();
  await expect(page.locator('textarea[spellcheck="false"]')).toHaveValue(/Ana Pérez Gómez/);
});
