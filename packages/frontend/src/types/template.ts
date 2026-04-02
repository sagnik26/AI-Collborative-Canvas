export type TemplateSlotType =
  | 'text'
  | 'pill'
  | 'box'
  | 'connector'
  | 'logo'
  | 'cta';

import { TEMPLATE_THEME_BY_PACK } from '../constants/templateRegistry';

export type TemplateOverflow = 'wrap' | 'ellipsis' | 'clip';

export type TemplateId = keyof typeof TEMPLATE_THEME_BY_PACK;

export type TemplateTheme = (typeof TEMPLATE_THEME_BY_PACK)[TemplateId];

/**
 * Shared field model for all packs (Option A): same keys everywhere; packs differ by `TemplateSchema` slots.
 */
export type TemplateSlot = {
  id: string;
  type: TemplateSlotType;
  x: number;
  y: number;
  w: number;
  h: number;
  maxChars?: number;
  maxLines?: number;
  overflow?: TemplateOverflow;
};

export type TemplateSchema = {
  schemaVersion: '1';
  templateId: TemplateId;
  page: { width: number; height: number };
  slots: TemplateSlot[];
};

export type TemplateStepField = {
  title: string;
  description: string;
};

export type TemplateFields = {
  heroBadge: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  socialProofTitle: string;
  logos: string[];
  steps: TemplateStepField[];
  mathTitle: string;
  mathFormula: string;
  mathFootnote: string;
  finalCtaHeadline: string;
  finalCtaLabel: string;
};

export type TemplateStatus = 'idle' | 'streaming' | 'complete' | 'error';

export type TemplateMeta = {
  templateId: TemplateId;
  theme: TemplateTheme;
  status: TemplateStatus;
  version: TemplateSchema['schemaVersion'];
};

export type TemplatePatch = {
  opId: string;
  stage: 'meta_header' | 'steps' | 'math' | 'complete';
  meta?: Partial<TemplateMeta>;
  fields?: Partial<TemplateFields>;
};

export type TemplateComposeRequest = {
  prompt: string;
  templateCandidates: Array<TemplateSchema['templateId']>;
  themeHint?: TemplateMeta['theme'];
  brandHints?: {
    brandName?: string;
    tone?: string;
    audience?: string;
    keywords?: string[];
  };
};

export type TemplateComposeEvent =
  | {
      type: 'template_selected';
      opId: string;
      templateId: TemplateSchema['templateId'];
      theme: TemplateMeta['theme'];
      status: 'streaming';
    }
  | {
      type: 'field_patch';
      opId: string;
      fields: Partial<TemplateFields>;
    }
  | {
      type: 'complete';
      opId: string;
      status: 'complete';
    }
  | {
      type: 'error';
      opId: string;
      message: string;
    };

export type TemplateRenderDiagnostics = {
  missingFields: string[];
  overflowWarnings: string[];
};
