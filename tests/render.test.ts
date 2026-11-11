import { Document, Page, renderToBuffer, Text } from '@react-pdf/renderer';
import { createElement } from 'react';
import { extractText, getDocumentProxy } from 'unpdf';
import { describe, expect, it } from 'vitest';

describe('dependencias de PDF', () => {
  it('genera un PDF con texto extraíble usando @react-pdf/renderer y unpdf', async () => {
    const document = createElement(
      Document,
      null,
      createElement(Page, { size: 'A4' }, createElement(Text, null, 'Hola ATS')),
    );

    const buffer = await renderToBuffer(document);
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: true });
    const text = Array.isArray(result.text) ? result.text.join('\n') : result.text;

    expect(text).toContain('Hola ATS');
  }, 30_000);
});
