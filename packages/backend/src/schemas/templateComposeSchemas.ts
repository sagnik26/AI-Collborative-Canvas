import { z } from 'zod';

export const templateIdSchema = z.enum(['landing.v1']);
export const templateThemeSchema = z.enum(['landing-dark']);

const stepFieldSchema = z
  .object({
    title: z.string().min(1).max(48),
    description: z.string().min(1).max(120),
  })
  .strict();

export const templateFieldsSchema = z
  .object({
    heroBadge: z.string().min(1).max(24),
    heroHeadline: z.string().min(1).max(120),
    heroSubheadline: z.string().min(1).max(220),
    heroPrimaryCta: z.string().min(1).max(32),
    heroSecondaryCta: z.string().min(1).max(32),
    socialProofTitle: z.string().min(1).max(96),
    logos: z.array(z.string().min(1).max(24)).min(3).max(8),
    steps: z.array(stepFieldSchema).min(3).max(4),
    mathTitle: z.string().min(1).max(64),
    mathFormula: z.string().min(1).max(120),
    mathFootnote: z.string().min(1).max(140),
    finalCtaHeadline: z.string().min(1).max(120),
    finalCtaLabel: z.string().min(1).max(32),
  })
  .strict();

export const templateComposeRequestSchema = z
  .object({
    prompt: z.string().min(1).max(2000),
    templateCandidates: z.array(templateIdSchema).min(1).max(4).default(['landing.v1']),
    themeHint: templateThemeSchema.optional(),
    brandHints: z
      .object({
        brandName: z.string().min(1).max(64).optional(),
        tone: z.string().min(1).max(64).optional(),
        audience: z.string().min(1).max(120).optional(),
        keywords: z.array(z.string().min(1).max(24)).max(12).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const templateComposeModelResponseSchema = z
  .object({
    templateId: templateIdSchema,
    theme: templateThemeSchema,
    fields: templateFieldsSchema,
  })
  .strict();

export const templateSelectedEventSchema = z
  .object({
    type: z.literal('template_selected'),
    opId: z.string().min(1),
    templateId: templateIdSchema,
    theme: templateThemeSchema,
    status: z.literal('streaming'),
  })
  .strict();

export const fieldPatchEventSchema = z
  .object({
    type: z.literal('field_patch'),
    opId: z.string().min(1),
    fields: templateFieldsSchema.partial(),
  })
  .strict();

export const completeEventSchema = z
  .object({
    type: z.literal('complete'),
    opId: z.string().min(1),
    status: z.literal('complete'),
  })
  .strict();

export const errorEventSchema = z
  .object({
    type: z.literal('error'),
    opId: z.string().min(1),
    message: z.string().min(1).max(280),
  })
  .strict();

export const templateComposeEventSchema = z.discriminatedUnion('type', [
  templateSelectedEventSchema,
  fieldPatchEventSchema,
  completeEventSchema,
  errorEventSchema,
]);

export type TemplateComposeRequest = z.infer<typeof templateComposeRequestSchema>;
export type TemplateComposeModelResponse = z.infer<typeof templateComposeModelResponseSchema>;
export type TemplateComposeEvent = z.infer<typeof templateComposeEventSchema>;
