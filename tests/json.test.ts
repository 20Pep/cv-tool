import { describe, expect, it } from 'vitest';
import { extractJsonObject, parseJsonObject } from '../src/server/generate/json.js';

describe('extractJsonObject', () => {
  it('extrae un objeto plano', () => {
    expect(extractJsonObject('{"ok":true}')).toBe('{"ok":true}');
  });

  it('extrae el objeto de un bloque markdown', () => {
    expect(extractJsonObject('```json\n{"ok":true}\n```')).toBe('{"ok":true}');
  });

  it('ignora texto antes y después del objeto', () => {
    expect(extractJsonObject('Listo:\n{"ok":true}\nEspero que sirva.')).toBe('{"ok":true}');
  });

  it('respeta llaves y comillas dentro de strings', () => {
    expect(extractJsonObject('{"text":"un {ejemplo} con } y \\"comillas\\""}')).toBe(
      '{"text":"un {ejemplo} con } y \\"comillas\\""}',
    );
  });

  it('falla si no hay un objeto', () => {
    expect(() => extractJsonObject('no hay json')).toThrow(/no contiene un objeto JSON/);
  });

  it('falla si el objeto está incompleto', () => {
    expect(() => extractJsonObject('{"ok":true')).toThrow(/incompleto/);
  });

  it('parsea el objeto extraído', () => {
    expect(parseJsonObject('```\n{"ok":true}\n```')).toEqual({ ok: true });
  });
});
