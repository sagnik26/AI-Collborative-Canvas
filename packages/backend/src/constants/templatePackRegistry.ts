/**
 * One canonical theme per template pack.
 * Keep keys/values aligned with `TEMPLATE_THEME_BY_PACK` in
 * `packages/frontend/src/types/template.ts`.
 */
export const TEMPLATE_THEME_BY_PACK = {
  'landing.v1': 'landing-dark',
} as const;

/** For OpenAI `json_schema` repair enums (order stable: insertion order of TEMPLATE_THEME_BY_PACK). */
export const OPENAI_TEMPLATE_ID_ENUM = Object.keys(TEMPLATE_THEME_BY_PACK) as Array<
  keyof typeof TEMPLATE_THEME_BY_PACK
>;

export const OPENAI_TEMPLATE_THEME_ENUM = [
  ...new Set(Object.values(TEMPLATE_THEME_BY_PACK)),
] as Array<(typeof TEMPLATE_THEME_BY_PACK)[keyof typeof TEMPLATE_THEME_BY_PACK]>;

/** Default allowlist for compose when the client omits `templateCandidates` (Phase 2). */
export const DEFAULT_COMPOSE_TEMPLATE_CANDIDATES = [
  ...OPENAI_TEMPLATE_ID_ENUM,
];

export function isValidThemeForTemplateId(templateId: string, theme: string): boolean {
  if (!Object.hasOwn(TEMPLATE_THEME_BY_PACK, templateId)) return false;
  const id = templateId as keyof typeof TEMPLATE_THEME_BY_PACK;
  return theme === TEMPLATE_THEME_BY_PACK[id];
}
