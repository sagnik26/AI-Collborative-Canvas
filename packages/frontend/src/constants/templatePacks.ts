import type { TemplateId, TemplateSchema } from '../types/template';
import {
  LANDING_TEMPLATE_V1,
  PITCH_TEMPLATE_METRICS_V1,
  PITCH_TEMPLATE_NARRATIVE_V1,
  PITCH_TEMPLATE_NEON_V1,
  PITCH_TEMPLATE_ZEN_V1,
} from './templateSchemas';

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

