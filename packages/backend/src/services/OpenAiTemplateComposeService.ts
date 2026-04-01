import OpenAI from 'openai';
import { z } from 'zod';
import {
  buildTemplateComposeStreamingPrompt,
  buildTemplateComposeSystemPrompt,
} from '../prompts/templateComposePrompt.js';
import {
  OPENAI_TEMPLATE_ID_ENUM,
  OPENAI_TEMPLATE_THEME_ENUM,
  TEMPLATE_THEME_BY_PACK,
  type TemplatePackId,
  type TemplatePackTheme,
} from '../constants/templatePackRegistry.js';
import {
  type TemplateComposeEvent,
  type TemplateComposeModelResponse,
  type TemplateComposeRequest,
  completeEventSchema,
  fieldPatchEventSchema,
  templatePatchFieldsSchema,
  templateComposeModelResponseSchema,
  templateSelectedEventSchema,
} from '../schemas/templateComposeSchemas.js';
import {
  defaultTemplateIdForCandidates,
  getFieldPolicyForTemplateId,
  type FieldGroup,
  type TemplatePackFieldPolicy,
} from './templatePackPolicy.js';

function sanitizeText(input: string, max: number) {
  const compact = input.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return compact.slice(0, max);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function sanitizePatchFields(input: unknown) {
  if (!isObject(input)) return null;
  const out: Record<string, unknown> = {};
  const setString = (
    key:
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
      | 'finalCtaLabel',
    max: number,
  ) => {
    const value = input[key];
    if (typeof value === 'string') out[key] = sanitizeText(value, max);
  };
  setString('heroBadge', 24);
  setString('heroHeadline', 120);
  setString('heroSubheadline', 220);
  setString('heroPrimaryCta', 32);
  setString('heroSecondaryCta', 32);
  setString('socialProofTitle', 96);
  setString('mathTitle', 64);
  setString('mathFormula', 120);
  setString('mathFootnote', 140);
  setString('finalCtaHeadline', 120);
  setString('finalCtaLabel', 32);

  if (Array.isArray(input.logos)) {
    const logos = input.logos
      .filter((item) => typeof item === 'string')
      .map((item) => sanitizeText(item, 24))
      .slice(0, 8);
    if (logos.length > 0) out.logos = logos;
  }

  if (Array.isArray(input.steps)) {
    const steps = input.steps
      .filter((item) => isObject(item))
      .map((item) => ({
        title: typeof item.title === 'string' ? sanitizeText(item.title, 48) : '',
        description:
          typeof item.description === 'string'
            ? sanitizeText(item.description, 120)
            : '',
      }))
      .filter((item) => item.title.length > 0 && item.description.length > 0)
      .slice(0, 4);
    if (steps.length > 0) out.steps = steps;
  }

  const validated = templatePatchFieldsSchema.partial().safeParse(out);
  if (!validated.success) return null;
  return validated.data;
}

function sanitizeFullFields(
  input: TemplateComposeModelResponse['fields'],
): TemplateComposeModelResponse['fields'] {
  return {
    heroBadge: sanitizeText(input.heroBadge, 24),
    heroHeadline: sanitizeText(input.heroHeadline, 120),
    heroSubheadline: sanitizeText(input.heroSubheadline, 220),
    heroPrimaryCta: sanitizeText(input.heroPrimaryCta, 32),
    heroSecondaryCta: sanitizeText(input.heroSecondaryCta, 32),
    socialProofTitle: sanitizeText(input.socialProofTitle, 96),
    logos: input.logos.map((logo) => sanitizeText(logo, 24)).slice(0, 8),
    steps: input.steps.slice(0, 4).map((step) => ({
      title: sanitizeText(step.title, 48),
      description: sanitizeText(step.description, 120),
    })),
    mathTitle: sanitizeText(input.mathTitle, 64),
    mathFormula: sanitizeText(input.mathFormula, 120),
    mathFootnote: sanitizeText(input.mathFootnote, 140),
    finalCtaHeadline: sanitizeText(input.finalCtaHeadline, 120),
    finalCtaLabel: sanitizeText(input.finalCtaLabel, 32),
  };
}

function extractJsonCandidate(raw: string): string | null {
  const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return raw.slice(start, end + 1);
  }
  return null;
}

/** Delay between synthetic patch lines so clients see incremental NDJSON (repair / JSON fallback). */
function getProgressivePatchStaggerMs(): number {
  const raw = process.env.TEMPLATE_COMPOSE_PATCH_STAGGER_MS;
  if (raw === undefined || raw === '') return 200;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 200;
}

async function staggerProgressivePatch(): Promise<void> {
  const ms = getProgressivePatchStaggerMs();
  if (ms <= 0) return;
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function mergeIntoAccumulated(
  accumulated: Record<string, unknown>,
  patch: Record<string, unknown>,
) {
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) accumulated[k] = v;
  }
}

/** Clamp model output to the client allowlist and canonical theme (never throw on wrong id). */
function resolveTemplateSelection(
  templateId: string,
  _theme: string,
  candidates: readonly TemplatePackId[],
): { templateId: TemplatePackId; theme: TemplatePackTheme } {
  const allowed = new Set(candidates);
  const tid: TemplatePackId = allowed.has(templateId as TemplatePackId)
    ? (templateId as TemplatePackId)
    : defaultTemplateIdForCandidates(candidates);
  return { templateId: tid, theme: TEMPLATE_THEME_BY_PACK[tid] };
}

function templateIdEnumForRepair(candidates: readonly TemplatePackId[]): TemplatePackId[] {
  return candidates.length > 0 ? [...candidates] : [...OPENAI_TEMPLATE_ID_ENUM];
}

function themeEnumForRepair(candidates: readonly TemplatePackId[]): TemplatePackTheme[] {
  if (candidates.length === 0) return [...OPENAI_TEMPLATE_THEME_ENUM];
  const out = new Set<TemplatePackTheme>();
  for (const id of candidates) {
    out.add(TEMPLATE_THEME_BY_PACK[id]);
  }
  return [...out];
}

const streamLineSchema = z.union([
  z
    .object({
      type: z.literal('template_selected'),
      templateId: z.string().min(1),
      theme: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal('field_patch'),
      fields: z.record(z.string(), z.unknown()),
    })
    .strict(),
  z
    .object({
      type: z.literal('complete'),
    })
    .strict(),
]);

export class OpenAiTemplateComposeService {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(opts: { apiKey: string; model?: string }) {
    this.client = new OpenAI({ apiKey: opts.apiKey });
    this.model = opts.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  }

  private async requestRepairCompose(
    req: TemplateComposeRequest,
    signal?: AbortSignal,
    repairHint?: string,
  ): Promise<TemplateComposeModelResponse> {
    const userContent =
      repairHint != null && repairHint.length > 0
        ? `${req.prompt}\n\n---\n${repairHint}`
        : req.prompt;
    const completion = await this.client.chat.completions.create(
      {
        model: this.model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: buildTemplateComposeSystemPrompt(req) },
          { role: 'user', content: userContent },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'template_compose_response_repair',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['templateId', 'theme', 'fields'],
              properties: {
                templateId: {
                  type: 'string',
                  enum: templateIdEnumForRepair(req.templateCandidates),
                },
                theme: {
                  type: 'string',
                  enum: themeEnumForRepair(req.templateCandidates),
                },
                fields: {
                  type: 'object',
                  additionalProperties: false,
                  required: [
                    'heroBadge',
                    'heroHeadline',
                    'heroSubheadline',
                    'heroPrimaryCta',
                    'heroSecondaryCta',
                    'socialProofTitle',
                    'logos',
                    'steps',
                    'mathTitle',
                    'mathFormula',
                    'mathFootnote',
                    'finalCtaHeadline',
                    'finalCtaLabel',
                  ],
                  properties: {
                    heroBadge: { type: 'string', maxLength: 24 },
                    heroHeadline: { type: 'string', maxLength: 120 },
                    heroSubheadline: { type: 'string', maxLength: 220 },
                    heroPrimaryCta: { type: 'string', maxLength: 32 },
                    heroSecondaryCta: { type: 'string', maxLength: 32 },
                    socialProofTitle: { type: 'string', maxLength: 96 },
                    logos: {
                      type: 'array',
                      minItems: 3,
                      maxItems: 8,
                      items: { type: 'string', maxLength: 24 },
                    },
                    steps: {
                      type: 'array',
                      minItems: 3,
                      maxItems: 4,
                      items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['title', 'description'],
                        properties: {
                          title: { type: 'string', maxLength: 48 },
                          description: { type: 'string', maxLength: 120 },
                        },
                      },
                    },
                    mathTitle: { type: 'string', maxLength: 64 },
                    mathFormula: { type: 'string', maxLength: 120 },
                    mathFootnote: { type: 'string', maxLength: 140 },
                    finalCtaHeadline: { type: 'string', maxLength: 120 },
                    finalCtaLabel: { type: 'string', maxLength: 32 },
                  },
                },
              },
            },
          },
        },
      },
      { signal },
    );

    const content = completion.choices[0]?.message?.content ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('Repair compose returned non-JSON content');
    }
    const validated = templateComposeModelResponseSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error('Repair compose returned invalid JSON shape');
    }
    return validated.data;
  }

  /**
   * Emit several small field_patch events with delays so HTTP/NDJSON reaches the client incrementally
   * (repair path and full-JSON fallback; true token streaming still comes from the model stream).
   */
  private async *emitProgressiveSanitizedPatches(
    baseId: string,
    seqRef: { n: number },
    policy: TemplatePackFieldPolicy,
    safe: ReturnType<typeof sanitizeFullFields>,
    accumulated?: Record<string, unknown>,
  ): AsyncGenerator<TemplateComposeEvent> {
    const chunks = policy.progressiveChunks(safe);
    for (let i = 0; i < chunks.length; i++) {
      if (i > 0) {
        await staggerProgressivePatch();
      }
      const fields = chunks[i];
      yield fieldPatchEventSchema.parse({
        type: 'field_patch',
        opId: `${baseId}:${seqRef.n++}`,
        fields,
      });
      if (accumulated) mergeIntoAccumulated(accumulated, fields);
    }
  }

  private async *emitGapPatchesFromSafe(
    baseId: string,
    seqRef: { n: number },
    policy: TemplatePackFieldPolicy,
    safe: ReturnType<typeof sanitizeFullFields>,
    gaps: FieldGroup[],
    accumulated: Record<string, unknown>,
  ): AsyncGenerator<TemplateComposeEvent> {
    let first = true;
    for (const g of policy.fieldGroupEmitOrder) {
      if (!gaps.includes(g)) continue;
      if (!first) {
        await staggerProgressivePatch();
      }
      first = false;
      const fields = policy.chunkForGroup(safe, g);
      yield fieldPatchEventSchema.parse({
        type: 'field_patch',
        opId: `${baseId}:${seqRef.n++}`,
        fields,
      });
      mergeIntoAccumulated(accumulated, fields);
    }
  }

  async *composeStream(
    req: TemplateComposeRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<TemplateComposeEvent> {
    const baseId = `ai-${Date.now()}`;
    let seq = 1;
    let completed = false;
    const accumulated: Record<string, unknown> = {};
    /** First accepted `templateId` (stream, JSON fallback, or repair-only selection). Drives Phase 3 pack policy. */
    let resolvedTemplateId: string | null = null;
    let selected = false;
    const pendingPatches: Array<Record<string, unknown>> = [];
    let fullText = '';

    const stream = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.5,
      stream: true,
      messages: [
        { role: 'system', content: buildTemplateComposeStreamingPrompt(req) },
        { role: 'user', content: req.prompt },
      ],
    }, { signal });

    let buffer = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (typeof delta !== 'string' || delta.length === 0) continue;
      buffer += delta;
      fullText += delta;

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          continue;
        }
        const eventLine = streamLineSchema.safeParse(parsed);
        if (!eventLine.success) continue;

        if (eventLine.data.type === 'template_selected') {
          if (selected) continue;
          const { templateId, theme } = resolveTemplateSelection(
            eventLine.data.templateId,
            eventLine.data.theme,
            req.templateCandidates,
          );
          yield templateSelectedEventSchema.parse({
            type: 'template_selected',
            opId: `${baseId}:${seq++}`,
            templateId,
            theme,
            status: 'streaming',
          });
          selected = true;
          resolvedTemplateId = templateId;

          if (pendingPatches.length > 0) {
            for (const pending of pendingPatches) {
              const safePending = sanitizePatchFields(pending);
              if (!safePending || Object.keys(safePending).length === 0) continue;
              yield fieldPatchEventSchema.parse({
                type: 'field_patch',
                opId: `${baseId}:${seq++}`,
                fields: safePending,
              });
              mergeIntoAccumulated(accumulated, safePending as Record<string, unknown>);
            }
            pendingPatches.length = 0;
          }
          continue;
        }

        if (eventLine.data.type === 'field_patch') {
          if (!selected) {
            pendingPatches.push(eventLine.data.fields);
          } else {
            const safeFields = sanitizePatchFields(eventLine.data.fields);
            if (!safeFields || Object.keys(safeFields).length === 0) continue;
            yield fieldPatchEventSchema.parse({
              type: 'field_patch',
              opId: `${baseId}:${seq++}`,
              fields: safeFields,
            });
            mergeIntoAccumulated(accumulated, safeFields as Record<string, unknown>);
          }
          continue;
        }

        if (!completed) {
          completed = true;
        }
      }
    }

    const trimmed = buffer.trim();
    if (trimmed.length > 0) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        const eventLine = streamLineSchema.safeParse(parsed);
        if (eventLine.success && eventLine.data.type === 'template_selected' && !selected) {
          const { templateId, theme } = resolveTemplateSelection(
            eventLine.data.templateId,
            eventLine.data.theme,
            req.templateCandidates,
          );
          yield templateSelectedEventSchema.parse({
            type: 'template_selected',
            opId: `${baseId}:${seq++}`,
            templateId,
            theme,
            status: 'streaming',
          });
          selected = true;
          resolvedTemplateId = templateId;
        }
        if (eventLine.success && eventLine.data.type === 'field_patch') {
          if (!selected) {
            pendingPatches.push(eventLine.data.fields);
          } else {
            const safeFields = sanitizePatchFields(eventLine.data.fields);
            if (safeFields && Object.keys(safeFields).length > 0) {
              yield fieldPatchEventSchema.parse({
                type: 'field_patch',
                opId: `${baseId}:${seq++}`,
                fields: safeFields,
              });
              mergeIntoAccumulated(accumulated, safeFields as Record<string, unknown>);
            }
          }
        }
      } catch {
        // ignore trailing partial line
      }
    }
    if (!selected) {
      const candidate = extractJsonCandidate(fullText);
      if (!candidate) {
        throw new Error('Model did not emit template_selected event');
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(candidate);
      } catch {
        throw new Error('Model output was not valid JSON');
      }
      const validated = templateComposeModelResponseSchema.safeParse(parsed);
      if (!validated.success) {
        throw new Error('Model did not emit template_selected event');
      }
      const { templateId, theme } = resolveTemplateSelection(
        validated.data.templateId,
        validated.data.theme,
        req.templateCandidates,
      );
      yield templateSelectedEventSchema.parse({
        type: 'template_selected',
        opId: `${baseId}:${seq++}`,
        templateId,
        theme,
        status: 'streaming',
      });
      selected = true;
      resolvedTemplateId = templateId;

      const safe = sanitizeFullFields(validated.data.fields);
      const jsonPolicy = getFieldPolicyForTemplateId(resolvedTemplateId);
      const seqRef = { n: seq };
      for await (const ev of this.emitProgressiveSanitizedPatches(
        baseId,
        seqRef,
        jsonPolicy,
        safe,
        accumulated,
      )) {
        yield ev;
      }
      seq = seqRef.n;
    }
    if (pendingPatches.length > 0) {
      for (const pending of pendingPatches) {
        const safePending = sanitizePatchFields(pending);
        if (!safePending || Object.keys(safePending).length === 0) continue;
        yield fieldPatchEventSchema.parse({
          type: 'field_patch',
          opId: `${baseId}:${seq++}`,
          fields: safePending,
        });
        mergeIntoAccumulated(accumulated, safePending as Record<string, unknown>);
      }
    }
    const packPolicy = getFieldPolicyForTemplateId(
      resolvedTemplateId ?? defaultTemplateIdForCandidates(req.templateCandidates),
    );
    let gaps = packPolicy.missingFieldGroups(accumulated);
    const maxRepairPasses = 2;
    for (let repairPass = 0; repairPass < maxRepairPasses && gaps.length > 0; repairPass++) {
      const repairHint =
        repairPass > 0
          ? `The server still needs non-empty content for these sections: ${gaps.join(', ')}. Return one full JSON object with templateId, theme, and fields where EVERY required string/array is filled (≥3 logos, ≥3 steps with title+description each, all hero/math/final strings non-empty).`
          : undefined;
      const repaired = await this.requestRepairCompose(req, signal, repairHint);
      const { templateId: repairTid, theme: repairTheme } = resolveTemplateSelection(
        repaired.templateId,
        repaired.theme,
        req.templateCandidates,
      );
      if (!selected) {
        yield templateSelectedEventSchema.parse({
          type: 'template_selected',
          opId: `${baseId}:${seq++}`,
          templateId: repairTid,
          theme: repairTheme,
          status: 'streaming',
        });
        selected = true;
        resolvedTemplateId = repairTid;
      }
      const repairPolicy = getFieldPolicyForTemplateId(
        resolvedTemplateId ?? repairTid,
      );
      const safe = sanitizeFullFields(repaired.fields);
      const seqRefRepair = { n: seq };
      for await (const ev of this.emitGapPatchesFromSafe(
        baseId,
        seqRefRepair,
        repairPolicy,
        safe,
        gaps,
        accumulated,
      )) {
        yield ev;
      }
      seq = seqRefRepair.n;
      gaps = repairPolicy.missingFieldGroups(accumulated);
    }
    if (gaps.length > 0) {
      throw new Error('Incomplete template fields after repair');
    }
    yield completeEventSchema.parse({
      type: 'complete',
      opId: `${baseId}:${seq++}`,
      status: 'complete',
    });
  }
}
