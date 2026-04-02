import { TEMPLATE_THEME_BY_PACK } from '../constants/templatePackRegistry.js';
import type { TemplatePackId } from '../types/templatePackRegistry.js';
import type {
  FieldGroup,
  SanitizedFullFields,
  TemplatePackFieldPolicy,
} from '../types/templatePackPolicy.js';

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/**
 * Option A (CONTEXT-template-packs): all registered packs share the same `TemplateFields` shape,
 * so completeness rules match the landing baseline. Pitch packs differ only in slot layout on the client.
 */
const SHARED_LANDING_FAMILY_POLICY: TemplatePackFieldPolicy = {
  fieldGroupEmitOrder: ['hero', 'social', 'steps', 'math', 'final'],

  missingFieldGroups(acc: Record<string, unknown>): FieldGroup[] {
    const gaps: FieldGroup[] = [];
    const heroKeys = [
      'heroBadge',
      'heroHeadline',
      'heroSubheadline',
      'heroPrimaryCta',
      'heroSecondaryCta',
    ] as const;
    if (
      !heroKeys.every(
        (k) => typeof acc[k] === 'string' && (acc[k] as string).trim().length > 0,
      )
    ) {
      gaps.push('hero');
    }

    const socialTitle = acc.socialProofTitle;
    const logos = acc.logos;
    if (
      typeof socialTitle !== 'string' ||
      socialTitle.trim().length === 0 ||
      !Array.isArray(logos) ||
      logos.length < 3 ||
      !logos.every((x) => typeof x === 'string' && x.trim().length > 0)
    ) {
      gaps.push('social');
    }

    const steps = acc.steps;
    if (
      !Array.isArray(steps) ||
      steps.length < 3 ||
      !steps.every(
        (s: unknown) =>
          isObject(s) &&
          typeof s.title === 'string' &&
          s.title.trim().length > 0 &&
          typeof s.description === 'string' &&
          s.description.trim().length > 0,
      )
    ) {
      gaps.push('steps');
    }

    let mathOk = true;
    for (const k of ['mathTitle', 'mathFormula', 'mathFootnote'] as const) {
      if (typeof acc[k] !== 'string' || (acc[k] as string).trim().length === 0) {
        mathOk = false;
        break;
      }
    }
    if (!mathOk) gaps.push('math');

    if (
      typeof acc.finalCtaHeadline !== 'string' ||
      acc.finalCtaHeadline.trim().length === 0 ||
      typeof acc.finalCtaLabel !== 'string' ||
      acc.finalCtaLabel.trim().length === 0
    ) {
      gaps.push('final');
    }

    return gaps;
  },

  chunkForGroup(safe: SanitizedFullFields, g: FieldGroup): Record<string, unknown> {
    switch (g) {
      case 'hero':
        return {
          heroBadge: safe.heroBadge,
          heroHeadline: safe.heroHeadline,
          heroSubheadline: safe.heroSubheadline,
          heroPrimaryCta: safe.heroPrimaryCta,
          heroSecondaryCta: safe.heroSecondaryCta,
        };
      case 'social':
        return { socialProofTitle: safe.socialProofTitle, logos: safe.logos };
      case 'steps':
        return { steps: safe.steps };
      case 'math':
        return {
          mathTitle: safe.mathTitle,
          mathFormula: safe.mathFormula,
          mathFootnote: safe.mathFootnote,
        };
      case 'final':
        return {
          finalCtaHeadline: safe.finalCtaHeadline,
          finalCtaLabel: safe.finalCtaLabel,
        };
      default:
        return {};
    }
  },

  progressiveChunks(safe: SanitizedFullFields): Record<string, unknown>[] {
    return [
      {
        heroBadge: safe.heroBadge,
        heroHeadline: safe.heroHeadline,
        heroSubheadline: safe.heroSubheadline,
        heroPrimaryCta: safe.heroPrimaryCta,
        heroSecondaryCta: safe.heroSecondaryCta,
      },
      {
        socialProofTitle: safe.socialProofTitle,
        logos: safe.logos,
      },
      { steps: safe.steps },
      {
        mathTitle: safe.mathTitle,
        mathFormula: safe.mathFormula,
        mathFootnote: safe.mathFootnote,
      },
      {
        finalCtaHeadline: safe.finalCtaHeadline,
        finalCtaLabel: safe.finalCtaLabel,
      },
    ];
  },
};

/**
 * Field completeness and synthetic chunk layout for `templateId`.
 * Option A: all packs share `SHARED_LANDING_FAMILY_POLICY`; extend with a `switch` when a pack needs different rules.
 */
export function getFieldPolicyForTemplateId(templateId: string): TemplatePackFieldPolicy {
  void templateId;
  return SHARED_LANDING_FAMILY_POLICY;
}

export function defaultTemplateIdForCandidates(candidates: readonly string[]): TemplatePackId {
  const first = candidates[0];
  if (first && Object.hasOwn(TEMPLATE_THEME_BY_PACK, first)) {
    return first as TemplatePackId;
  }
  return 'landing.v1';
}

