import ExcelJS from 'exceljs';
import { daysSince } from '../../shared/dates.js';
import type { ApplicationInfo } from '../../shared/schemas.js';

const STATUS_LABELS: Record<ApplicationInfo['status'], string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  in_process: 'En proceso',
  interview: 'Entrevista',
  offer: 'Oferta',
  hired: 'Contratada',
  rejected: 'Rechazada',
  withdrawn: 'Retirada',
};

export async function buildApplicationsWorkbook(
  applications: ApplicationInfo[],
  now = new Date(),
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'cv-tool';
  workbook.created = now;

  const sheet = workbook.addWorksheet('Postulaciones');
  sheet.columns = [
    { header: 'Empresa', key: 'company', width: 24 },
    { header: 'Puesto', key: 'position', width: 28 },
    { header: 'Estado', key: 'status', width: 14 },
    { header: 'Fecha de envío', key: 'sentAt', width: 18 },
    { header: 'Días transcurridos', key: 'days', width: 18 },
    { header: 'Match %', key: 'matchPct', width: 10 },
    { header: 'URL', key: 'url', width: 32 },
    { header: 'Keywords faltantes', key: 'missingKeywords', width: 40 },
    { header: 'Notas', key: 'notes', width: 40 },
  ];

  for (const application of applications) {
    sheet.addRow({
      company: application.company,
      position: application.position,
      status: STATUS_LABELS[application.status],
      sentAt: application.sentAt ?? '',
      days: daysSince(application.sentAt ?? application.createdAt, now),
      matchPct: application.matchPct ?? '',
      url: application.url ?? '',
      missingKeywords: application.missingKeywords.join(', '),
      notes: application.notes ?? '',
    });
  }

  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = { from: 'A1', to: 'I1' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
