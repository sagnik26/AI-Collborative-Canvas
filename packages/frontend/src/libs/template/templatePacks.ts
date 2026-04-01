import {
  TEMPLATE_THEME_BY_PACK,
  type TemplateId,
  type TemplateSchema,
} from '../../types/template';
import {
  LANDING_TEMPLATE_V1,
  PITCH_TEMPLATE_METRICS_V1,
  PITCH_TEMPLATE_NARRATIVE_V1,
  PITCH_TEMPLATE_NEON_V1,
  PITCH_TEMPLATE_ZEN_V1,
} from './templatePackV1.ts';

export const TEMPLATE_PACKS: Record<TemplateId, TemplateSchema> = {
  'landing.v1': LANDING_TEMPLATE_V1,
  'pitch.v1': PITCH_TEMPLATE_NARRATIVE_V1,
  'pitch.v2': PITCH_TEMPLATE_METRICS_V1,
  'pitch.v3': PITCH_TEMPLATE_ZEN_V1,
  'pitch.v4': PITCH_TEMPLATE_NEON_V1,
};

/** All packs the compose endpoint may choose from (order is prompt order). */
export const DEFAULT_TEMPLATE_CANDIDATES: TemplateId[] = [
  'landing.v1',
  'pitch.v1',
  'pitch.v2',
  'pitch.v3',
  'pitch.v4',
];

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
