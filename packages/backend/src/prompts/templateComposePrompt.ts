import {
  type TemplatePackId,
  TEMPLATE_THEME_BY_PACK,
} from '../constants/templatePackRegistry.js';
import type { TemplateComposeRequest } from '../schemas/templateComposeSchemas.js';

/** Per-candidate intent so the model can ground `template_selected` in the user message (Phase 4). */
const PACK_INTENT_BY_ID: Record<TemplatePackId, string> = {
  'landing.v1':
    'landing.v1 + landing-dark: full marketing landing (hero, proof, steps, math callout, final CTA). Prefer when the user wants a broad page, many sections, or “website/landing” style.',
  'pitch.v1':
    'pitch.v1 + pitch-dark: narrative pitch (proof left, story right). Prefer story-led decks, founder narrative, or “tell our story”.',
  'pitch.v2':
    'pitch.v2 + pitch-light: metrics-first, light hero band. Prefer KPIs, numbers, growth, ROI, or “show the metrics”.',
  'pitch.v3':
    'pitch.v3 + pitch-zen: centered column + side math rail. Prefer calm, minimal, editorial, or “clean zen” tone.',
  'pitch.v4':
    'pitch.v4 + pitch-neon: split hero vs proof stack, high-contrast. Prefer bold, product-launch, or “stand out / neon” energy.',
};

function isTemplatePackId(id: string): id is TemplatePackId {
  return Object.hasOwn(TEMPLATE_THEME_BY_PACK, id);
}

function buildPackSelectionGuideForCandidates(candidateIds: readonly string[]): string {
  const lines: string[] = [];
  for (const id of candidateIds) {
    if (isTemplatePackId(id)) {
      lines.push(`- ${PACK_INTENT_BY_ID[id]}`);
    }
  }
  return lines.length > 0
    ? `Candidate guide (only these ids are allowed — pick one that best matches the USER PROMPT and brand hints):\n${lines.join('\n')}`
    : 'No per-pack guide for this allowlist; still pick one allowed templateId and its canonical theme.';
}

const SELECTION_FROM_PROMPT =
  'Choose templateId only from Allowed template candidates. Read the user message: match layout intent (long landing vs short pitch, metrics vs narrative, minimal vs bold). If several fit, prefer the most specific; if still tied, use the first listed candidate.';

/** Social/ads ask for short copy but the schema still needs a full page-shaped payload. */
const FULL_TEMPLATE_SHAPE_FOR_SHORT_PROMPTS =
  'Even if the user asks for a social post, ad, caption, or thread: you must still fill EVERY semantic field (hero, social proof title + at least 3 distinct logo labels, at least 3 steps each with title+description, math title+formula+footnote, final CTA headline+label). Map the hook/headline into hero lines, bullets into steps, CTA into primary/final CTAs; use short plausible logo names (e.g. partner or channel names) and a simple numeric or symbolic mathFormula that fits the promo. All strings must be non-empty after trimming.';

function themeHintLine(req: TemplateComposeRequest): string {
  return req.themeHint != null
    ? `Optional theme hint from client: ${req.themeHint} (still must match templateId if you follow it).`
    : 'No theme hint: pick one candidate and use exactly the theme that belongs to that templateId.';
}

export function buildTemplateComposeSystemPrompt(req: TemplateComposeRequest) {
  const candidates = req.templateCandidates.join(', ');
  const brandHints = req.brandHints
    ? JSON.stringify(req.brandHints, null, 2)
    : 'none';

  return [
    'You are a template composition assistant.',
    'Return ONLY valid JSON matching the required schema.',
    'Fill semantic fields only. Never output coordinates, x/y positions, width/height, geometry, or layout metadata.',
    'Respect max lengths and concise copy limits implied by each field.',
    `Allowed template candidates: ${candidates}.`,
    SELECTION_FROM_PROMPT,
    buildPackSelectionGuideForCandidates(req.templateCandidates),
    themeHintLine(req),
    `Brand hints: ${brandHints}.`,
    FULL_TEMPLATE_SHAPE_FOR_SHORT_PROMPTS,
    'Use practical, product-ready marketing copy.',
  ].join('\n');
}

export function buildTemplateComposeStreamingPrompt(req: TemplateComposeRequest) {
  const candidates = req.templateCandidates.join(', ');
  const brandHints = req.brandHints ? JSON.stringify(req.brandHints, null, 2) : 'none';

  return [
    'You are a template composition assistant.',
    'Output ONLY NDJSON (one compact JSON object per line, no markdown, no prose).',
    'Print each line as soon as it is complete (do not wait until the end to output all lines).',
    'Do NOT output coordinates, geometry, x/y positions, width/height, or layout metadata.',
    `Allowed template candidates: ${candidates}.`,
    SELECTION_FROM_PROMPT,
    buildPackSelectionGuideForCandidates(req.templateCandidates),
    themeHintLine(req),
    `Brand hints: ${brandHints}.`,
    'First line MUST be template selection (exactly one theme per templateId — use the canonical theme for the chosen id):',
    '{"type":"template_selected","templateId":"<one allowed templateId>","theme":"<canonical theme for that templateId>"}',
    'Then emit field patches in this order as separate lines:',
    '1) hero fields',
    '2) social/steps fields',
    '3) math/final CTA fields',
    'Then emit: {"type":"complete"}',
    'Allowed line shapes:',
    '{"type":"template_selected","templateId":"...","theme":"<must match that templateId>"}',
    '{"type":"field_patch","fields":{...partial template fields...}}',
    '{"type":"complete"}',
    FULL_TEMPLATE_SHAPE_FOR_SHORT_PROMPTS,
    'Keep every string concise and production-ready.',
  ].join('\n');
}
