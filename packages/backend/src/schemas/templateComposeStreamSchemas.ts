import { z } from 'zod';

/**
 * Internal schema for parsing model-emitted NDJSON lines before normalizing into
 * the public `TemplateComposeEvent` schemas.
 */
export const templateComposeStreamLineSchema = z.union([
  z
    .object({
      type: z.literal('template_selected'),
      templateId: z.string().min(1),
      theme: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal('field_patch'),
      fields: z.record(z.string(), z.unknown()),
    })
    .strict(),
  z
    .object({
      type: z.literal('complete'),
    })
    .strict(),
]);

export function parseTemplateComposeStreamLine(
  line: string,
): z.infer<typeof templateComposeStreamLineSchema> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  const validated = templateComposeStreamLineSchema.safeParse(parsed);
  return validated.success ? validated.data : null;
}
