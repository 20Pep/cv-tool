import { expect, test } from '@playwright/test';

test('flujo base de la interfaz', async ({ page }) => {
  await page.goto('/?t=e2e-launch');

  await expect(page).toHaveURL('http://127.0.0.1:3200/');
  await expect(page.getByRole('heading', { name: 'cv-tool' })).toBeVisible();
  await expect(page.getByText('Servidor local conectado')).toBeVisible();

  await page.getByRole('link', { name: 'Ajustes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'OpenCode' })).toBeVisible();

  await page.getByRole('link', { name: 'Perfil', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu perfil' })).toBeVisible();

  await page.setInputFiles('input[type=file]', 'fixtures/documents/ana-perez-cv.txt');
  await page.getByRole('button', { name: 'Subir documento' }).click();
  await expect(page.getByText('ana-perez-cv.txt')).toBeVisible();

  await page.getByRole('link', { name: 'Tracker', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tracker' })).toBeVisible();
  await expect(page.getByText('Todavía no hay postulaciones.')).toBeVisible();
});
