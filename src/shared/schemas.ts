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
  letterOutline: z.string().optional(),
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
    headline: z.string().optional(),
    experience: z.array(
      z.object({
        experienceId: z.string(),
        role: z.string().optional(),
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

export const DocumentKind = z.enum(['cv', 'portfolio', 'presentation', 'certificate', 'other']);

export type DocumentKind = z.infer<typeof DocumentKind>;

export const DocumentInfo = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  kind: DocumentKind,
  createdAt: z.string(),
});

export type DocumentInfo = z.infer<typeof DocumentInfo>;

export const DocumentsResponse = z.object({
  documents: z.array(DocumentInfo),
});

export type DocumentsResponse = z.infer<typeof DocumentsResponse>;

export const UploadDocumentResponse = z.object({
  document: DocumentInfo,
});

export type UploadDocumentResponse = z.infer<typeof UploadDocumentResponse>;

export const DeleteResponse = z.object({
  ok: z.literal(true),
});

export type DeleteResponse = z.infer<typeof DeleteResponse>;

export const ProfileResponse = z.object({
  profile: MasterProfile.nullable(),
  version: z.number().int().nonnegative().nullable(),
  updatedAt: z.string().nullable(),
});

export type ProfileResponse = z.infer<typeof ProfileResponse>;

export const ProfileSaveRequest = z
  .object({
    profile: MasterProfile,
  })
  .strict();

export type ProfileSaveRequest = z.infer<typeof ProfileSaveRequest>;

export const GenerateProfileResponse = z.object({
  profile: MasterProfile,
});

export type GenerateProfileResponse = z.infer<typeof GenerateProfileResponse>;

export const KeywordMatch = z.object({
  keywords: z.array(z.string()),
  matched: z.array(z.string()),
  missing: z.array(z.string()),
  matchPct: z.number().min(0).max(100),
});

export type KeywordMatch = z.infer<typeof KeywordMatch>;

export const PreviewApplicationRequest = z
  .object({
    offerText: z.string().min(50, 'La oferta es demasiado corta.'),
    draftText: z.string().optional(),
    url: z.string().optional(),
  })
  .strict();

export type PreviewApplicationRequest = z.infer<typeof PreviewApplicationRequest>;

export const PreviewApplicationResponse = z.object({
  tailoredCv: TailoredCV,
  coverLetter: CoverLetter,
  keywords: KeywordMatch,
  suggestedCompany: z.string(),
  suggestedPosition: z.string(),
});

export type PreviewApplicationResponse = z.infer<typeof PreviewApplicationResponse>;

export const ApplicationStatus = z.enum([
  'draft',
  'sent',
  'in_process',
  'interview',
  'offer',
  'hired',
  'rejected',
  'withdrawn',
]);

export type ApplicationStatus = z.infer<typeof ApplicationStatus>;

export const CreateApplicationRequest = z
  .object({
    company: z.string().optional(),
    position: z.string().optional(),
    url: z.string().optional(),
    jobText: z.string().min(50, 'La oferta es demasiado corta.'),
    tailoredCv: TailoredCV,
    coverLetter: CoverLetter,
  })
  .strict();

export type CreateApplicationRequest = z.infer<typeof CreateApplicationRequest>;

export const ApplicationInfo = z.object({
  id: z.number().int().positive(),
  company: z.string(),
  position: z.string(),
  url: z.string().nullable(),
  status: ApplicationStatus,
  sentAt: z.string().nullable(),
  matchPct: z.number().nullable(),
  missingKeywords: z.array(z.string()),
  cvPath: z.string().nullable(),
  letterPath: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ApplicationInfo = z.infer<typeof ApplicationInfo>;

export const ApplicationResponse = z.object({
  application: ApplicationInfo,
});

export type ApplicationResponse = z.infer<typeof ApplicationResponse>;

export const ApplicationsResponse = z.object({
  applications: z.array(ApplicationInfo),
});

export type ApplicationsResponse = z.infer<typeof ApplicationsResponse>;

export const StatusHistoryEntry = z.object({
  id: z.number().int().positive(),
  status: ApplicationStatus,
  changedAt: z.string(),
  note: z.string().nullable(),
});

export type StatusHistoryEntry = z.infer<typeof StatusHistoryEntry>;

export const ApplicationDetail = ApplicationInfo.extend({
  jobText: z.string(),
});

export type ApplicationDetail = z.infer<typeof ApplicationDetail>;

export const ApplicationDetailResponse = z.object({
  application: ApplicationDetail,
  history: z.array(StatusHistoryEntry),
});

export type ApplicationDetailResponse = z.infer<typeof ApplicationDetailResponse>;

export const UpdateApplicationRequest = z
  .object({
    status: ApplicationStatus.optional(),
    notes: z.string().optional(),
    url: z.string().optional(),
    company: z.string().min(1).optional(),
    position: z.string().min(1).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No hay cambios para guardar.',
  });

export type UpdateApplicationRequest = z.infer<typeof UpdateApplicationRequest>;
