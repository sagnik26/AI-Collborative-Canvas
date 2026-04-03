import {
  type TemplateFields,
  type TemplateId,
  type TemplateMeta,
  type TemplatePatch,
  type TemplateStepField,
  type TemplateTheme,
} from '../../types/template';
import type { TemplateStringFieldKey } from '../../types/templateFields';
import {
  TEMPLATE_DEFAULT_THEME_BY_PACK,
  TEMPLATE_THEMES_BY_PACK,
  isValidThemeForTemplateId,
} from '../../constants/templateRegistry';
import { TEMPLATE_SCHEMA_VERSION } from '../../constants/templateSchema';

export function createDefaultTemplateMeta(): TemplateMeta {
  const templateId: TemplateId = 'landing.v1';
  return {
    templateId,
    theme: TEMPLATE_DEFAULT_THEME_BY_PACK[templateId],
    status: 'idle',
    version: TEMPLATE_SCHEMA_VERSION,
  };
}

export function createDefaultTemplateFields(): TemplateFields {
  return {
    heroBadge: '',
    heroHeadline: '',
    heroSubheadline: '',
    heroPrimaryCta: '',
    heroSecondaryCta: '',
    socialProofTitle: '',
    logos: [],
    steps: [],
    mathTitle: '',
    mathFormula: '',
    mathFootnote: '',
    finalCtaHeadline: '',
    finalCtaLabel: '',
  };
}

function isString(v: unknown) {
  return typeof v === 'string';
}

function isStringArray(v: unknown) {
  return Array.isArray(v) && v.every((s) => typeof s === 'string');
}

function isStepArray(v: unknown): v is TemplateStepField[] {
  return (
    Array.isArray(v) &&
    v.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        isString((item as { title?: unknown }).title) &&
        isString((item as { description?: unknown }).description),
    )
  );
}

function maxLen(value: unknown, n: number) {
  return typeof value === 'string' && value.length <= n;
}

export function validateTemplatePatch(patch: TemplatePatch): string[] {
  const errors: string[] = [];
  if (!patch.opId) errors.push('patch.opId is required');
  if (!patch.stage) errors.push('patch.stage is required');
  if (!patch.meta && !patch.fields) {
    errors.push('patch must include meta or fields');
  }

  const fields = patch.fields;
  if (!fields) return errors;

  const entries = Object.entries(fields) as Array<[keyof TemplateFields, unknown]>;
  for (const [k, v] of entries) {
    if (k === 'logos') {
      if (!isStringArray(v)) errors.push('fields.logos must be string[]');
      continue;
    }
    if (k === 'steps') {
      if (!isStepArray(v)) errors.push('fields.steps must be step[]');
      continue;
    }
    if (!isString(v)) {
      errors.push(`fields.${k} must be string`);
      continue;
    }
    if (k === 'heroBadge' && !maxLen(v, 24)) errors.push('fields.heroBadge exceeds max length');
    if (k === 'heroHeadline' && !maxLen(v, 120))
      errors.push('fields.heroHeadline exceeds max length');
    if (k === 'heroSubheadline' && !maxLen(v, 220))
      errors.push('fields.heroSubheadline exceeds max length');
    if ((k === 'heroPrimaryCta' || k === 'heroSecondaryCta' || k === 'finalCtaLabel') && !maxLen(v, 32))
      errors.push(`fields.${k} exceeds max length`);
  }
  return errors;
}

function isTemplateId(v: unknown): v is TemplateId {
  return typeof v === 'string' && Object.hasOwn(TEMPLATE_THEMES_BY_PACK, v);
}

export function readTemplateMetaFromMap(map: Map<string, unknown>): TemplateMeta {
  const defaults = createDefaultTemplateMeta();
  const templateId = map.get('templateId');
  const theme = map.get('theme');
  const status = map.get('status');
  const version = map.get('version');

  const resolvedId: TemplateId = isTemplateId(templateId) ? templateId : defaults.templateId;
  const resolvedTheme: TemplateTheme =
    typeof theme === 'string' && isValidThemeForTemplateId(resolvedId, theme)
      ? theme
      : TEMPLATE_DEFAULT_THEME_BY_PACK[resolvedId];

  return {
    templateId: resolvedId,
    theme: resolvedTheme,
    status:
      status === 'idle' ||
      status === 'streaming' ||
      status === 'complete' ||
      status === 'error'
        ? status
        : defaults.status,
    version: version === '1' ? version : defaults.version,
  };
}

export function readTemplateFieldsFromMap(
  map: Map<string, unknown>,
): TemplateFields {
  const defaults = createDefaultTemplateFields();
  const readString = (key: TemplateStringFieldKey) => {
    const v = map.get(String(key));
    return typeof v === 'string' ? v : defaults[key];
  };

  const logos = map.get('logos');
  const steps = map.get('steps');

  return {
    heroBadge: readString('heroBadge'),
    heroHeadline: readString('heroHeadline'),
    heroSubheadline: readString('heroSubheadline'),
    heroPrimaryCta: readString('heroPrimaryCta'),
    heroSecondaryCta: readString('heroSecondaryCta'),
    socialProofTitle: readString('socialProofTitle'),
    logos: isStringArray(logos) ? logos : defaults.logos,
    steps: isStepArray(steps) ? steps : defaults.steps,
    mathTitle: readString('mathTitle'),
    mathFormula: readString('mathFormula'),
    mathFootnote: readString('mathFootnote'),
    finalCtaHeadline: readString('finalCtaHeadline'),
    finalCtaLabel: readString('finalCtaLabel'),
  };
}
