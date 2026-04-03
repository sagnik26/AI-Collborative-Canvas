/**
 * Each template pack allows multiple color themes (same layout, different palettes).
 * Keep arrays aligned with `TEMPLATE_THEMES_BY_PACK` in `packages/backend/src/constants/templatePackRegistry.ts`.
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

export type TemplateId = keyof typeof TEMPLATE_THEMES_BY_PACK;

export type TemplateTheme = (typeof TEMPLATE_THEMES_BY_PACK)[TemplateId][number];

export function isValidThemeForTemplateId(
  templateId: TemplateId,
  theme: string,
): theme is TemplateTheme {
  return (TEMPLATE_THEMES_BY_PACK[templateId] as readonly string[]).includes(theme);
}
