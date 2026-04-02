import {
  type TemplateId,
  type TemplateSchema,
} from '../../types/template';
import { TEMPLATE_THEME_BY_PACK } from '../../constants/templateRegistry';
import {
  DEFAULT_TEMPLATE_CANDIDATES,
  TEMPLATE_PACKS,
} from '../../constants/templatePacks';
import { LANDING_TEMPLATE_V1 } from '../../constants/templateSchemas';

/**
 * Optional `?candidates=landing.v1,pitch.v2` for TemplateEditorPage (Phase 4 route-level allowlist).
 * Unknown ids are dropped; empty after filtering → undefined (use default list).
 */
export function parseTemplateCandidatesQueryParam(
  param: string | null | undefined,
): TemplateId[] | undefined {
  if (param == null || param.trim() === '') return undefined;
  const raw = param.split(',').map((s) => s.trim()).filter(Boolean);
  const out: TemplateId[] = [];
  for (const id of raw) {
    if (Object.hasOwn(TEMPLATE_THEME_BY_PACK, id)) {
      out.push(id as TemplateId);
    }
  }
  return out.length > 0 ? out : undefined;
}

export function getTemplatePack(id: string): TemplateSchema {
  if (Object.hasOwn(TEMPLATE_PACKS, id)) {
    return TEMPLATE_PACKS[id as TemplateId];
  }
  return LANDING_TEMPLATE_V1;
}

export { DEFAULT_TEMPLATE_CANDIDATES, TEMPLATE_PACKS };
