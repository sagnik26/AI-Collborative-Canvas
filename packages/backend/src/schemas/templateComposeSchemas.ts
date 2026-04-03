import { z } from 'zod';
import {
  DEFAULT_COMPOSE_TEMPLATE_CANDIDATES,
  isValidThemeForTemplateId,
  OPENAI_TEMPLATE_ID_ENUM,
  OPENAI_TEMPLATE_THEME_ENUM,
} from '../constants/templatePackRegistry.js';
import type { TemplatePackId, TemplatePackTheme } from '../types/templatePackRegistry.js';

/**
 * Phase 2: `templateId` / theme literals come from `templatePackRegistry` (single source of truth).
 * Repair `json_schema` enums use the same lists via `OPENAI_*_ENUM`.
 */
function zNonEmptyEnum<T extends string>(values: readonly T[], label: string) {
  if (values.length === 0) {
    throw new Error(`${label}: enum must be non-empty`);
  }
  return z.enum(values as unknown as [T, ...T[]]);
}

export const templateIdSchema = zNonEmptyEnum(
  OPENAI_TEMPLATE_ID_ENUM as readonly TemplatePackId[],
  'templateIdSchema',
);
export const templateThemeSchema = zNonEmptyEnum(
  OPENAI_TEMPLATE_THEME_ENUM as readonly TemplatePackTheme[],
  'templateThemeSchema',
);

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

export const templatePatchFieldsSchema = z
  .object({
    heroBadge: z.string().min(1).max(24),
    heroHeadline: z.string().min(1).max(120),
    heroSubheadline: z.string().min(1).max(220),
    heroPrimaryCta: z.string().min(1).max(32),
    heroSecondaryCta: z.string().min(1).max(32),
    socialProofTitle: z.string().min(1).max(96),
    logos: z.array(z.string().min(1).max(24)).min(1).max(8),
    steps: z.array(stepFieldSchema).min(1).max(4),
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
    templateCandidates: z
      .array(templateIdSchema)
      .min(1)
      .max(8)
      .default([...DEFAULT_COMPOSE_TEMPLATE_CANDIDATES]),
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
  .strict()
  .refine((d) => new Set(d.templateCandidates).size === d.templateCandidates.length, {
    message: 'templateCandidates must not contain duplicates',
  })
  .refine(
    (d) => {
      if (d.themeHint == null) return true;
      return d.templateCandidates.some((id) => isValidThemeForTemplateId(id, d.themeHint!));
    },
    {
      message:
        'themeHint must be an allowed color theme for at least one entry in templateCandidates',
    },
  );

export const templateComposeModelResponseSchema = z
  .object({
    templateId: templateIdSchema,
    theme: templateThemeSchema,
    fields: templateFieldsSchema,
  })
  .strict()
  .refine((d) => isValidThemeForTemplateId(d.templateId, d.theme), {
    message: 'theme must match templateId',
  });

export const templateSelectedEventSchema = z
  .object({
    type: z.literal('template_selected'),
    opId: z.string().min(1),
    templateId: templateIdSchema,
    theme: templateThemeSchema,
    status: z.literal('streaming'),
  })
  .strict()
  .refine((d) => isValidThemeForTemplateId(d.templateId, d.theme), {
    message: 'theme must match templateId',
  });

export const fieldPatchEventSchema = z
  .object({
    type: z.literal('field_patch'),
    opId: z.string().min(1),
    fields: templatePatchFieldsSchema.partial(),
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
