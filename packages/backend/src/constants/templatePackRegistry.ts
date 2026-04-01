/**
 * One canonical theme per template pack.
 * Keep keys/values aligned with `TEMPLATE_THEME_BY_PACK` in
 * `packages/frontend/src/types/template.ts`.
 */
export const TEMPLATE_THEME_BY_PACK = {
  'landing.v1': 'landing-dark',
  'pitch.v1': 'pitch-dark',
  'pitch.v2': 'pitch-light',
  'pitch.v3': 'pitch-zen',
  'pitch.v4': 'pitch-neon',
} as const;

export type TemplatePackId = keyof typeof TEMPLATE_THEME_BY_PACK;
export type TemplatePackTheme = (typeof TEMPLATE_THEME_BY_PACK)[TemplatePackId];

/** For OpenAI `json_schema` repair enums (order stable: insertion order of TEMPLATE_THEME_BY_PACK). */
export const OPENAI_TEMPLATE_ID_ENUM = Object.keys(TEMPLATE_THEME_BY_PACK) as TemplatePackId[];

export const OPENAI_TEMPLATE_THEME_ENUM = [
  ...new Set(Object.values(TEMPLATE_THEME_BY_PACK)),
] as TemplatePackTheme[];

/** Default allowlist for compose when the client omits `templateCandidates` (Phase 2). */
export const DEFAULT_COMPOSE_TEMPLATE_CANDIDATES: TemplatePackId[] = [
  ...OPENAI_TEMPLATE_ID_ENUM,
];

export function isValidThemeForTemplateId(templateId: string, theme: string): boolean {
  if (!Object.hasOwn(TEMPLATE_THEME_BY_PACK, templateId)) return false;
  const id = templateId as TemplatePackId;
  return theme === TEMPLATE_THEME_BY_PACK[id];
}
