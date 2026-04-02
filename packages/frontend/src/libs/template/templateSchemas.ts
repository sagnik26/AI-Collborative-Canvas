import type { TemplateSchema } from '../../types/template.ts';
import { buildTemplatePack } from './templatePackV1.ts';
import {
  LANDING_BASE_SLOTS_PORTRAIT,
  LANDING_PAGE_PORTRAIT,
} from '../../constants/templatePackV1.ts';

export const LANDING_TEMPLATE_V1: TemplateSchema = buildTemplatePack('landing.v1', {}, {
  page: LANDING_PAGE_PORTRAIT,
  baseSlots: LANDING_BASE_SLOTS_PORTRAIT,
});
