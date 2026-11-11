/**
 * Extrae el primer objeto JSON balanceado de un texto.
 *
 * Los modelos a veces envuelven la respuesta en bloques markdown o agregan
 * explicaciones antes/después. Esto no "repara" JSON inválido: solo recorta el
 * objeto para que JSON.parse pueda trabajarlo.
 */
export function extractJsonObject(raw: string): string {
  const trimmed = stripCodeFence(raw.trim());
  const start = trimmed.indexOf('{');

  if (start === -1) {
    throw new Error('La respuesta de la IA no contiene un objeto JSON.');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < trimmed.length; index += 1) {
    const char = trimmed[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return trimmed.slice(start, index + 1);
      }
    }
  }

  throw new Error('La respuesta de la IA tiene un objeto JSON incompleto.');
}

export function parseJsonObject(raw: string): unknown {
  return JSON.parse(extractJsonObject(raw));
}

function stripCodeFence(value: string): string {
  if (!value.startsWith('```')) {
    return value;
  }

  const firstNewline = value.indexOf('\n');
  if (firstNewline === -1) {
    return value;
  }

  const withoutOpeningFence = value.slice(firstNewline + 1);
  const closingFence = withoutOpeningFence.lastIndexOf('```');

  if (closingFence === -1) {
    return withoutOpeningFence;
  }

  return withoutOpeningFence.slice(0, closingFence);
}
