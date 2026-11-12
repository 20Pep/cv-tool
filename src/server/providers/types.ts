export interface LLMModel {
  provider: string;
  model: string;
  name?: string;
  variants?: string[];
  isFree?: boolean;
}

export interface ModelRef {
  provider: string;
  model: string;
  variant?: string;
}

export interface GenerateRequest {
  system: string;
  user: string;
  model?: ModelRef;
  /**
   * OpenCode no ofrece salida estructurada en generate/text. Se acepta por
   * compatibilidad con la interfaz, pero el adaptador lo ignora.
   */
  jsonSchema?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface LLMProvider {
  id: string;
  name: string;
  isAvailable(): Promise<boolean>;
  listModels(): Promise<LLMModel[]>;
  generate(req: GenerateRequest): Promise<string>;
  /** Opcional: solo los adaptadores que puedan reportar la versión del servidor. */
  getServerInfo?(): Promise<{ version: string }>;
}

export type ProviderErrorKind =
  | 'unavailable'
  | 'auth'
  | 'rate_limit'
  | 'timeout'
  | 'aborted'
  | 'provider'
  | 'bad_response';

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly retryAfterMs?: number;
  readonly status?: number;

  constructor(
    kind: ProviderErrorKind,
    message: string,
    options: { retryAfterMs?: number; status?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.kind = kind;
    this.retryAfterMs = options.retryAfterMs;
    this.status = options.status;
  }

  override get name(): string {
    return 'ProviderError';
  }
}
