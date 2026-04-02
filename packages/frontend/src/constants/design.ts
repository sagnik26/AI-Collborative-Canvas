import { DEFAULT_TEMPLATE_CANDIDATES } from '../libs/template/templatePacks.ts';
import type { PromptChip } from '../types/design';

export const PROMPT_CHIPS: PromptChip[] = [
  {
    label: 'Landing page',
    prompt:
      'Build a full marketing landing page for a B2B analytics product: hero with badge and dual CTAs, social proof strip, three clear steps, a math-style proof block, and a closing CTA section.',
    templateCandidates: ['landing.v1'],
  },
  {
    label: 'Metrics pitch',
    prompt:
      'Create a metrics-first pitch layout for a fundraise: lead with KPIs and growth, tight copy, emphasize ROI and traction.',
    templateCandidates: ['pitch.v2'],
  },
  {
    label: 'Story pitch',
    prompt:
      'Draft a narrative pitch page for a climate startup: founder story on one side, proof and credibility on the other, warm but confident tone.',
    templateCandidates: ['pitch.v1'],
  },
  {
    label: 'Pitch deck',
    prompt:
      'Outline copy for a 10-slide deck: problem, solution, market, traction with KPIs, business model, team, and ask—headline-style lines per slide.',
    templateCandidates: ['pitch.v2', 'pitch.v1', 'pitch.v3'],
  },
  {
    label: 'Social post',
    prompt:
      'Write channel-ready promo copy: hook, three value bullets, and one CTA—works for LinkedIn, Instagram caption, or a short ad primary text.',
    /** Same allowlist as omitting candidates (explicit so chip click always resets a prior narrow list). */
    templateCandidates: [...DEFAULT_TEMPLATE_CANDIDATES],
  },
];

