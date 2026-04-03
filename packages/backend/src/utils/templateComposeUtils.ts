import {
  OPENAI_TEMPLATE_ID_ENUM,
  OPENAI_TEMPLATE_THEME_ENUM,
  TEMPLATE_DEFAULT_THEME_BY_PACK,
  TEMPLATE_THEMES_BY_PACK,
} from '../constants/templatePackRegistry.js';
import type { TemplatePackId, TemplatePackTheme } from '../types/templatePackRegistry.js';
import {
  templatePatchFieldsSchema,
} from '../schemas/templateComposeSchemas.js';
import type { TemplateComposeModelResponse } from '../types/templateCompose.js';
import { defaultTemplateIdForCandidates } from './templatePackPolicy.js';

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function sanitizeText(input: string, max: number) {
  const compact = input.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return compact.slice(0, max);
}

export function sanitizePatchFields(input: unknown) {
  if (!isObject(input)) return null;
  const out: Record<string, unknown> = {};
  const setString = (
    key:
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
      | 'finalCtaLabel',
    max: number,
  ) => {
    const value = input[key];
    if (typeof value === 'string') out[key] = sanitizeText(value, max);
  };
  setString('heroBadge', 24);
  setString('heroHeadline', 120);
  setString('heroSubheadline', 220);
  setString('heroPrimaryCta', 32);
  setString('heroSecondaryCta', 32);
  setString('socialProofTitle', 96);
  setString('mathTitle', 64);
  setString('mathFormula', 120);
  setString('mathFootnote', 140);
  setString('finalCtaHeadline', 120);
  setString('finalCtaLabel', 32);

  if (Array.isArray(input.logos)) {
    const logos = input.logos
      .filter((item) => typeof item === 'string')
      .map((item) => sanitizeText(item, 24))
      .slice(0, 8);
    if (logos.length > 0) out.logos = logos;
  }

  if (Array.isArray(input.steps)) {
    const steps = input.steps
      .filter((item) => isObject(item))
      .map((item) => ({
        title: typeof item.title === 'string' ? sanitizeText(item.title, 48) : '',
        description: typeof item.description === 'string' ? sanitizeText(item.description, 120) : '',
      }))
      .filter((item) => item.title.length > 0 && item.description.length > 0)
      .slice(0, 4);
    if (steps.length > 0) out.steps = steps;
  }

  const validated = templatePatchFieldsSchema.partial().safeParse(out);
  if (!validated.success) return null;
  return validated.data;
}

export function sanitizeFullFields(
  input: TemplateComposeModelResponse['fields'],
): TemplateComposeModelResponse['fields'] {
  return {
    heroBadge: sanitizeText(input.heroBadge, 24),
    heroHeadline: sanitizeText(input.heroHeadline, 120),
    heroSubheadline: sanitizeText(input.heroSubheadline, 220),
    heroPrimaryCta: sanitizeText(input.heroPrimaryCta, 32),
    heroSecondaryCta: sanitizeText(input.heroSecondaryCta, 32),
    socialProofTitle: sanitizeText(input.socialProofTitle, 96),
    logos: input.logos.map((logo) => sanitizeText(logo, 24)).slice(0, 8),
    steps: input.steps.slice(0, 4).map((step) => ({
      title: sanitizeText(step.title, 48),
      description: sanitizeText(step.description, 120),
    })),
    mathTitle: sanitizeText(input.mathTitle, 64),
    mathFormula: sanitizeText(input.mathFormula, 120),
    mathFootnote: sanitizeText(input.mathFootnote, 140),
    finalCtaHeadline: sanitizeText(input.finalCtaHeadline, 120),
    finalCtaLabel: sanitizeText(input.finalCtaLabel, 32),
  };
}

export function extractJsonCandidate(raw: string): string | null {
  const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return raw.slice(start, end + 1);
  }
  return null;
}

/** Delay between synthetic patch lines so clients see incremental NDJSON (repair / JSON fallback). */
function getProgressivePatchStaggerMs(): number {
  const raw = process.env.TEMPLATE_COMPOSE_PATCH_STAGGER_MS;
  if (raw === undefined || raw === '') return 200;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 200;
}

export async function staggerProgressivePatch(): Promise<void> {
  const ms = getProgressivePatchStaggerMs();
  if (ms <= 0) return;
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function mergeIntoAccumulated(
  accumulated: Record<string, unknown>,
  patch: Record<string, unknown>,
) {
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) accumulated[k] = v;
  }
}

export type ResolveTemplateSelectionOpts = {
  /** When set and valid for the resolved pack, wins over the model's `theme` (server rotation / client hint). */
  serverTheme?: TemplatePackTheme;
};

/** Clamp model output to the client allowlist; optional server theme overrides model (never throw on wrong id). */
export function resolveTemplateSelection(
  templateId: string,
  theme: string,
  candidates: readonly TemplatePackId[],
  opts?: ResolveTemplateSelectionOpts,
): { templateId: TemplatePackId; theme: TemplatePackTheme } {
  const allowed = new Set(candidates);
  const tid: TemplatePackId = allowed.has(templateId as TemplatePackId)
    ? (templateId as TemplatePackId)
    : defaultTemplateIdForCandidates(candidates);
  const allowedThemes = TEMPLATE_THEMES_BY_PACK[tid] as readonly string[];
  const server = opts?.serverTheme;
  const picked =
    server != null && allowedThemes.includes(server)
      ? server
      : typeof theme === 'string' && allowedThemes.includes(theme)
        ? theme
        : TEMPLATE_DEFAULT_THEME_BY_PACK[tid];
  return { templateId: tid, theme: picked as TemplatePackTheme };
}

export function templateIdEnumForRepair(candidates: readonly TemplatePackId[]): TemplatePackId[] {
  return candidates.length > 0 ? [...candidates] : [...OPENAI_TEMPLATE_ID_ENUM];
}

export function themeEnumForRepair(candidates: readonly TemplatePackId[]): TemplatePackTheme[] {
  if (candidates.length === 0) return [...OPENAI_TEMPLATE_THEME_ENUM];
  const out = new Set<TemplatePackTheme>();
  for (const id of candidates) {
    for (const t of TEMPLATE_THEMES_BY_PACK[id]) {
      out.add(t as TemplatePackTheme);
    }
  }
  return [...out];
}
