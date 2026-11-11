import { createOpenCodeProvider } from './opencode.js';
import type { LLMProvider } from './types.js';

export type {
  GenerateRequest,
  LLMModel,
  LLMProvider,
  ModelRef,
  ProviderErrorKind,
} from './types.js';
export { ProviderError } from './types.js';

/**
 * Punto de composición de proveedores. El resto de la app no importa
 * `opencode.ts` directamente: usa esta fábrica y la interfaz LLMProvider.
 */
export async function createProvider(): Promise<LLMProvider> {
  return createOpenCodeProvider();
}
