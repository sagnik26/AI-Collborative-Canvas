import type { TemplateId, TemplateSchema } from '../types/template';
import {
  LANDING_TEMPLATE_V1,
} from '../libs/template/templateSchemas.ts';

export const TEMPLATE_PACKS: Record<TemplateId, TemplateSchema> = {
  'landing.v1': LANDING_TEMPLATE_V1,
};

/** All packs the compose endpoint may choose from (order is prompt order). */
export const DEFAULT_TEMPLATE_CANDIDATES: TemplateId[] = [
  'landing.v1',
];

