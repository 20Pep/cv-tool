import { z } from 'zod';

export const LinkSchema = z.object({
  label: z.string(),
  url: z.string(),
});

export const MasterProfile = z.object({
  basics: z.object({
    fullName: z.string(),
    headline: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    links: z.array(LinkSchema).default([]),
  }),
  summary: z.string().optional(),
  experience: z.array(
    z.object({
      id: z.string(),
      company: z.string(),
      role: z.string(),
      start: z.string(),
      end: z.string().nullable(),
      location: z.string().optional(),
      bullets: z.array(
        z.object({
          id: z.string(),
          text: z.string(),
        }),
      ),
    }),
  ),
  education: z
    .array(
      z.object({
        institution: z.string(),
        degree: z.string(),
        start: z.string().optional(),
        end: z.string().optional(),
      }),
    )
    .default([]),
  skills: z.array(
    z.object({
      name: z.string(),
      category: z.string().optional(),
    }),
  ),
  projects: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        url: z.string().optional(),
        tech: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  certifications: z
    .array(
      z.object({
        name: z.string(),
        issuer: z.string().optional(),
        year: z.string().optional(),
      }),
    )
    .default([]),
  languages: z
    .array(
      z.object({
        name: z.string(),
        level: z.string().optional(),
      }),
    )
    .default([]),
});

export type MasterProfile = z.infer<typeof MasterProfile>;

export const TailoredCV = z
  .object({
    summary: z.string(),
    experience: z.array(
      z.object({
        experienceId: z.string(),
        bullets: z.array(
          z.object({
            text: z.string(),
            sourceBulletId: z.string(),
          }),
        ),
      }),
    ),
    skills: z.array(z.string()),
    keywordsUsed: z.array(z.string()),
    keywordsMissing: z.array(z.string()),
  })
  .strict();

export type TailoredCV = z.infer<typeof TailoredCV>;

export const CoverLetter = z
  .object({
    greeting: z.string(),
    paragraphs: z.array(z.string()).min(2).max(5),
    closing: z.string(),
  })
  .strict();

export type CoverLetter = z.infer<typeof CoverLetter>;

export const HealthResponse = z.object({
  status: z.literal('ok'),
  version: z.string(),
  database: z.literal('ok'),
  uptimeSeconds: z.number().int().nonnegative(),
});

export type HealthResponse = z.infer<typeof HealthResponse>;

export const LLMSettings = z
  .object({
    provider: z.string().min(1),
    model: z.string().min(1),
    variant: z.string().min(1).optional(),
  })
  .strict();

export type LLMSettings = z.infer<typeof LLMSettings>;

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  provider: 'opencode-go',
  model: 'deepseek-v4.1-flash',
  variant: 'low',
};

export const LLMModelInfo = z.object({
  provider: z.string(),
  model: z.string(),
  name: z.string().optional(),
  variants: z.array(z.string()).default([]),
  isFree: z.boolean().optional(),
});

export type LLMModelInfo = z.infer<typeof LLMModelInfo>;

export const ProviderInfo = z.object({
  id: z.string(),
  name: z.string(),
  available: z.boolean(),
  version: z.string().optional(),
  error: z.string().optional(),
});

export type ProviderInfo = z.infer<typeof ProviderInfo>;

export const ProvidersResponse = z.object({
  provider: ProviderInfo,
  models: z.array(LLMModelInfo),
  current: LLMSettings,
});

export type ProvidersResponse = z.infer<typeof ProvidersResponse>;

export const SettingsResponse = z.object({
  llm: LLMSettings,
});

export type SettingsResponse = z.infer<typeof SettingsResponse>;

export const SettingsUpdate = z
  .object({
    llm: LLMSettings,
  })
  .strict();

export type SettingsUpdate = z.infer<typeof SettingsUpdate>;

export const TestConnectionRequest = z
  .object({
    provider: z.string().min(1),
    model: z.string().min(1),
    variant: z.string().min(1).optional(),
  })
  .strict();

export type TestConnectionRequest = z.infer<typeof TestConnectionRequest>;

export const TestConnectionResponse = z.union([
  z.object({
    ok: z.literal(true),
    text: z.string(),
    latencyMs: z.number().int().nonnegative(),
    version: z.string().optional(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
    kind: z.string().optional(),
  }),
]);

export type TestConnectionResponse = z.infer<typeof TestConnectionResponse>;
