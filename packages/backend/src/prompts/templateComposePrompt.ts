import { TEMPLATE_THEMES_BY_PACK } from '../constants/templatePackRegistry.js';
import type { TemplatePackId } from '../types/templatePackRegistry.js';
import type { TemplateComposeRequest } from '../types/templateCompose.js';

/** Per-candidate intent so the model can ground `template_selected` in the user message (Phase 4). */
const PACK_INTENT_BY_ID: Record<TemplatePackId, string> = {
  'landing.v1':
    'landing.v1: full marketing landing (hero, proof, steps, math callout, final CTA). Pick any allowed color `theme` for this id each generation. Prefer when the user wants a broad page, many sections, or “website/landing” style.',
};

function isTemplatePackId(id: string): id is TemplatePackId {
  return Object.hasOwn(TEMPLATE_THEMES_BY_PACK, id);
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
    : 'No per-pack guide for this allowlist; still pick one allowed templateId and an allowed color theme for it.';
}

const SELECTION_FROM_PROMPT =
  'Choose templateId only from Allowed template candidates. Read the user message: match layout intent (long landing vs short pitch, metrics vs narrative, minimal vs bold). If several fit, prefer the most specific; if still tied, use the first listed candidate.';

/** Social/ads ask for short copy but the schema still needs a full page-shaped payload. */
const FULL_TEMPLATE_SHAPE_FOR_SHORT_PROMPTS =
  'Even if the user asks for a social post, ad, caption, or thread: you must still fill EVERY semantic field (hero, social proof title + at least 3 distinct logo labels, at least 3 steps each with title+description, math title+formula+footnote, final CTA headline+label). Map the hook/headline into hero lines, bullets into steps, CTA into primary/final CTAs; use short plausible logo names (e.g. partner or channel names) and a simple numeric or symbolic mathFormula that fits the promo. All strings must be non-empty after trimming.';

/** Push variety across regenerations; stay within length limits and factual to the user prompt. */
const CREATIVE_COPY_VOICE =
  'Copy style: be distinctive and creative—specific verbs, concrete images, and a clear point of view. Avoid generic SaaS filler ("unlock", "leverage", "synergy", "best-in-class") unless the user clearly wants that tone. Vary metaphor, rhythm, and CTA wording from run to run; each generation should feel freshly written, not templated. Still respect max lengths and stay faithful to the user prompt and brand hints.';

function shuffleCopy<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Per-request shuffled theme order reduces list-position bias (models often overweight early options).
 * Explicit note counters over-selection of green/cyan for generic marketing prompts.
 */
function buildColorThemeInstruction(): string {
  const lines: string[] = [];
  for (const id of Object.keys(TEMPLATE_THEMES_BY_PACK) as TemplatePackId[]) {
    const themes = shuffleCopy(TEMPLATE_THEMES_BY_PACK[id]);
    lines.push(
      `For templateId "${id}", theme must be exactly one of: ${themes.join(', ')}. Pick a different hue than your previous pick when the user prompt is neutral or unrelated to color; do not always reuse the same theme.`,
    );
  }
  return [
    'Color theme: the `theme` field is a predefined color palette id (not free-form hex). It only changes hues and tints—the layout is fixed.',
    'Contrast: every palette is designed so body text and labels stay dark on light surfaces and CTA label text stays light on saturated buttons. Never choose a theme that would imply light-on-light or dark-on-dark for those pairs (the allowed ids already satisfy this).',
    'Theme diversity: `landing-emerald` and `landing-teal` are green/cyan. Models often over-pick them for generic marketing copy; resist that. Use them when the user clearly implies nature, sustainability, wellness, climate, or explicit green branding. For neutral or unspecified style, spread choices evenly across all eight themes (do not favor green over blue, slate, rose, amber, violet, or crimson).',
    ...lines,
  ].join('\n');
}

function themeHintLine(req: TemplateComposeRequest): string {
  return req.themeHint != null
    ? `Required color theme for this run: ${req.themeHint}. Set "theme" in template_selected to exactly this string (it is already valid for the template pack in use).`
    : 'No theme hint: pick one allowed templateId and any allowed color theme for that id (vary across runs when appropriate).';
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
    CREATIVE_COPY_VOICE,
    buildColorThemeInstruction(),
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
    'First line MUST be template selection (pick one allowed color theme for the chosen templateId — see COLOR_THEME list in the system prompt):',
    '{"type":"template_selected","templateId":"<one allowed templateId>","theme":"<allowed theme string for that templateId>"}',
    'Then emit field patches in this order as separate lines:',
    '1) hero fields',
    '2) social/steps fields',
    '3) math/final CTA fields',
    'Then emit: {"type":"complete"}',
    'Allowed line shapes:',
    '{"type":"template_selected","templateId":"...","theme":"<must be allowed for that templateId>"}',
    '{"type":"field_patch","fields":{...partial template fields...}}',
    '{"type":"complete"}',
    FULL_TEMPLATE_SHAPE_FOR_SHORT_PROMPTS,
    CREATIVE_COPY_VOICE,
    buildColorThemeInstruction(),
    'Keep every string concise and production-ready.',
  ].join('\n');
}
