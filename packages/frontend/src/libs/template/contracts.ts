import type {
  TemplateFields,
  TemplateMeta,
  TemplatePatch,
  TemplateSchema,
  TemplateStepField,
} from '../../types/template';

export const TEMPLATE_SCHEMA_VERSION: TemplateSchema['schemaVersion'] = '1';

export function createDefaultTemplateMeta(): TemplateMeta {
  return {
    templateId: 'landing.v1',
    theme: 'landing-dark',
    status: 'idle',
    version: TEMPLATE_SCHEMA_VERSION,
  };
}

export function createDefaultTemplateFields(): TemplateFields {
  return {
    heroBadge: 'NEW',
    heroHeadline: 'Launch faster with AI-powered creative workflows',
    heroSubheadline:
      'Turn one prompt into a polished landing page concept with deterministic layout and collaborative edits.',
    heroPrimaryCta: 'Start free',
    heroSecondaryCta: 'View demo',
    socialProofTitle: 'Trusted by fast-moving product teams',
    logos: ['Acme', 'Orbit', 'Northstar', 'Helio', 'Summit', 'Pulse'],
    steps: [
      { title: 'Prompt', description: 'Describe your offer and audience.' },
      { title: 'Generate', description: 'Fill semantic fields with stream patches.' },
      { title: 'Polish', description: 'Refine copy together in real-time.' },
    ],
    mathTitle: 'Expected impact',
    mathFormula: '3 hrs saved/day x 20 teammates = 60 hrs/week',
    mathFootnote: 'Estimate based on replacing manual layout work.',
    finalCtaHeadline: 'Ready to design your next launch page?',
    finalCtaLabel: 'Generate template',
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

export function readTemplateMetaFromMap(map: Map<string, unknown>): TemplateMeta {
  const defaults = createDefaultTemplateMeta();
  const templateId = map.get('templateId');
  const theme = map.get('theme');
  const status = map.get('status');
  const version = map.get('version');

  return {
    templateId: templateId === 'landing.v1' ? templateId : defaults.templateId,
    theme: theme === 'landing-dark' ? theme : defaults.theme,
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
  type StringFieldKey =
    | 'heroBadge'
    | 'heroHeadline'
    | 'heroSubheadline'
    | 'heroPrimaryCta'
    | 'heroSecondaryCta'
    | 'socialProofTitle'
    | 'mathTitle'
    | 'mathFormula'
    | 'mathFootnote'
    | 'finalCtaHeadline'
    | 'finalCtaLabel';
  const readString = (key: StringFieldKey) => {
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
