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
