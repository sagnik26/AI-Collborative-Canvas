import { fixtureForTemplate } from '../../Design System/templateFixtures.ts';
import type { TemplateFields, TemplateId, TemplateStepField } from '../../types/template';

function nonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function mergeSteps(source: TemplateStepField[], fallback: TemplateStepField[]) {
  const size = Math.max(3, fallback.length, source.length);
  const merged: TemplateStepField[] = [];
  for (let i = 0; i < size; i += 1) {
    const src = source[i];
    const fb = fallback[i] ?? { title: `Step ${i + 1}`, description: '' };
    merged.push({
      title: nonEmpty(src?.title) ? src.title : fb.title,
      description: nonEmpty(src?.description) ? src.description : fb.description,
    });
  }
  return merged;
}

function mergeLogos(source: string[], fallback: string[]) {
  const size = Math.max(6, fallback.length, source.length);
  const merged: string[] = [];
  for (let i = 0; i < size; i += 1) {
    const src = source[i];
    const fb = fallback[i] ?? `Metric ${i + 1}`;
    merged.push(nonEmpty(src) ? src : fb);
  }
  return merged;
}

/**
 * Compose responses can omit optional fields (especially logos/steps entries).
 * This function keeps generated values, but backfills blanks from per-template fixtures.
 */
export function withTemplateFieldFallbacks(
  templateId: TemplateId,
  fields: TemplateFields,
  options?: { enabled?: boolean },
): TemplateFields {
  if (options?.enabled === false) return fields;
  const fallback = fixtureForTemplate(templateId);
  const merged: TemplateFields = {
    heroBadge: nonEmpty(fields.heroBadge) ? fields.heroBadge : fallback.heroBadge,
    heroHeadline: nonEmpty(fields.heroHeadline) ? fields.heroHeadline : fallback.heroHeadline,
    heroSubheadline: nonEmpty(fields.heroSubheadline)
      ? fields.heroSubheadline
      : fallback.heroSubheadline,
    heroPrimaryCta: nonEmpty(fields.heroPrimaryCta)
      ? fields.heroPrimaryCta
      : fallback.heroPrimaryCta,
    heroSecondaryCta: nonEmpty(fields.heroSecondaryCta)
      ? fields.heroSecondaryCta
      : fallback.heroSecondaryCta,
    socialProofTitle: nonEmpty(fields.socialProofTitle)
      ? fields.socialProofTitle
      : fallback.socialProofTitle,
    logos: mergeLogos(fields.logos, fallback.logos),
    steps: mergeSteps(fields.steps, fallback.steps),
    mathTitle: nonEmpty(fields.mathTitle) ? fields.mathTitle : fallback.mathTitle,
    mathFormula: nonEmpty(fields.mathFormula) ? fields.mathFormula : fallback.mathFormula,
    mathFootnote: nonEmpty(fields.mathFootnote) ? fields.mathFootnote : fallback.mathFootnote,
    finalCtaHeadline: nonEmpty(fields.finalCtaHeadline)
      ? fields.finalCtaHeadline
      : fallback.finalCtaHeadline,
    finalCtaLabel: nonEmpty(fields.finalCtaLabel) ? fields.finalCtaLabel : fallback.finalCtaLabel,
  };

  return merged;
}

