/**
 * Per-pack allowed color themes (layout unchanged; palette varies).
 * Keep keys/arrays aligned with `TEMPLATE_THEMES_BY_PACK` in
 * `packages/frontend/src/constants/templateRegistry.ts`.
 */
export const TEMPLATE_THEMES_BY_PACK = {
  'landing.v1': [
    'landing-dark',
    'landing-slate',
    'landing-emerald',
    'landing-rose',
    'landing-amber',
    'landing-violet',
    'landing-teal',
    'landing-crimson',
  ] as const,
} as const;

export const TEMPLATE_DEFAULT_THEME_BY_PACK = {
  'landing.v1': 'landing-dark',
} as const;

/** For OpenAI `json_schema` repair enums (template ids). */
export const OPENAI_TEMPLATE_ID_ENUM = Object.keys(TEMPLATE_THEMES_BY_PACK) as Array<
  keyof typeof TEMPLATE_THEMES_BY_PACK
>;

/** All themes the model may output (union across packs). */
export const OPENAI_TEMPLATE_THEME_ENUM = [
  ...new Set(
    (Object.values(TEMPLATE_THEMES_BY_PACK) as readonly (readonly string[])[]).flat(),
  ),
] as Array<
  (typeof TEMPLATE_THEMES_BY_PACK)[keyof typeof TEMPLATE_THEMES_BY_PACK][number]
>;

/** Default allowlist for compose when the client omits `templateCandidates` (Phase 2). */
export const DEFAULT_COMPOSE_TEMPLATE_CANDIDATES = [...OPENAI_TEMPLATE_ID_ENUM];

export function isValidThemeForTemplateId(templateId: string, theme: string): boolean {
  if (!Object.hasOwn(TEMPLATE_THEMES_BY_PACK, templateId)) return false;
  const id = templateId as keyof typeof TEMPLATE_THEMES_BY_PACK;
  return (TEMPLATE_THEMES_BY_PACK[id] as readonly string[]).includes(theme);
}
