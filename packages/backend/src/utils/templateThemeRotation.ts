import { TEMPLATE_THEMES_BY_PACK } from '../constants/templatePackRegistry.js';
import type { TemplatePackId, TemplatePackTheme } from '../types/templatePackRegistry.js';
import { defaultTemplateIdForCandidates } from './templatePackPolicy.js';

let rotationCursor = 0;

/**
 * Cycles through allowed themes per compose request so consecutive generations
 * change palette without relying on the model to pick a different `theme`.
 */
export function nextRotatingThemeForCandidates(
  candidates: readonly TemplatePackId[],
): TemplatePackTheme {
  const tid = defaultTemplateIdForCandidates(candidates);
  const themes = TEMPLATE_THEMES_BY_PACK[tid];
  const idx = rotationCursor % themes.length;
  rotationCursor += 1;
  return themes[idx] as TemplatePackTheme;
}
