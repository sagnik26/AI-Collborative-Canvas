import type { TemplateFields } from '../../types/template';

/** True when any template field has non-whitespace content (compose / user input). */
export function hasAnyTemplateContent(fields: TemplateFields): boolean {
  const stringFields: Array<keyof Pick<
    TemplateFields,
    | 'heroBadge'
    | 'heroHeadline'
    | 'heroSubheadline'
    | 'heroPrimaryCta'
    | 'heroSecondaryCta'
    | 'socialProofTitle'
    | 'mathTitle'
    | 'mathFormula'
    | 'mathFootnote'
    | 'finalCtaHeadline'
    | 'finalCtaLabel'
  >> = [
    'heroBadge',
    'heroHeadline',
    'heroSubheadline',
    'heroPrimaryCta',
    'heroSecondaryCta',
    'socialProofTitle',
    'mathTitle',
    'mathFormula',
    'mathFootnote',
    'finalCtaHeadline',
    'finalCtaLabel',
  ];
  for (const k of stringFields) {
    const v = fields[k];
    if (typeof v === 'string' && v.trim().length > 0) return true;
  }
  for (const logo of fields.logos) {
    if (typeof logo === 'string' && logo.trim().length > 0) return true;
  }
  for (const step of fields.steps) {
    if (
      (typeof step.title === 'string' && step.title.trim().length > 0) ||
      (typeof step.description === 'string' && step.description.trim().length > 0)
    ) {
      return true;
    }
  }
  return false;
}
