import type { TemplateSchema } from '../types/template';
import { buildTemplatePack } from '../libs/template/templatePackV1.ts';
import {
  LANDING_PATCHES,
  PITCH_METRICS_PATCHES,
  PITCH_NARRATIVE_PATCHES,
  PITCH_NEON_PATCHES,
  PITCH_ZEN_PATCHES,
} from './templatePackV1';

export const LANDING_TEMPLATE_V1: TemplateSchema = buildTemplatePack('landing.v1', LANDING_PATCHES);
export const PITCH_TEMPLATE_NARRATIVE_V1: TemplateSchema = buildTemplatePack('pitch.v1', PITCH_NARRATIVE_PATCHES);
export const PITCH_TEMPLATE_METRICS_V1: TemplateSchema = buildTemplatePack('pitch.v2', PITCH_METRICS_PATCHES);
export const PITCH_TEMPLATE_ZEN_V1: TemplateSchema = buildTemplatePack('pitch.v3', PITCH_ZEN_PATCHES);
export const PITCH_TEMPLATE_NEON_V1: TemplateSchema = buildTemplatePack('pitch.v4', PITCH_NEON_PATCHES);

