import OpenAI from 'openai';
import {
  buildTemplateComposeStreamingPrompt,
  buildTemplateComposeSystemPrompt,
} from '../prompts/templateComposePrompt.js';
import {
  completeEventSchema,
  fieldPatchEventSchema,
  templateComposeModelResponseSchema,
  templateSelectedEventSchema,
} from '../schemas/templateComposeSchemas.js';
import type {
  TemplateComposeEvent,
  TemplateComposeModelResponse,
  TemplateComposeRequest,
} from '../types/templateCompose.js';
import {
  defaultTemplateIdForCandidates,
  getFieldPolicyForTemplateId,
} from '../utils/templatePackPolicy.js';
import {
  extractJsonCandidate,
  mergeIntoAccumulated,
  resolveTemplateSelection,
  sanitizeFullFields,
  sanitizePatchFields,
  templateIdEnumForRepair,
  themeEnumForRepair,
} from '../utils/templateComposeUtils.js';
import {
  emitGapPatchesFromSafe,
  emitProgressiveSanitizedPatches,
} from '../utils/templateComposeEmitters.js';
import {
  parseTemplateComposeStreamLine,
} from '../schemas/templateComposeStreamSchemas.js';
import type { TemplatePackId, TemplatePackTheme } from '../types/templatePackRegistry.js';
import { nextRotatingThemeForCandidates } from '../utils/templateThemeRotation.js';

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
        temperature: 0.55,
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
  async *composeStream(
    req: TemplateComposeRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<TemplateComposeEvent> {
    const serverTheme: TemplatePackTheme =
      req.themeHint != null
        ? (req.themeHint as TemplatePackTheme)
        : nextRotatingThemeForCandidates(req.templateCandidates as TemplatePackId[]);
    const reqForModel: TemplateComposeRequest = { ...req, themeHint: serverTheme };
    const resolveThemeOpts = { serverTheme };

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
      temperature: 0.88,
      stream: true,
      messages: [
        { role: 'system', content: buildTemplateComposeStreamingPrompt(reqForModel) },
        { role: 'user', content: reqForModel.prompt },
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
        const eventLine = parseTemplateComposeStreamLine(line);
        if (!eventLine) continue;

        if (eventLine.type === 'template_selected') {
          if (selected) continue;
          const { templateId, theme } = resolveTemplateSelection(
            eventLine.templateId,
            eventLine.theme,
            reqForModel.templateCandidates,
            resolveThemeOpts,
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

        if (eventLine.type === 'field_patch') {
          if (!selected) {
            pendingPatches.push(eventLine.fields);
          } else {
            const safeFields = sanitizePatchFields(eventLine.fields);
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
        const eventLine = parseTemplateComposeStreamLine(trimmed);
        if (eventLine && eventLine.type === 'template_selected' && !selected) {
          const { templateId, theme } = resolveTemplateSelection(
            eventLine.templateId,
            eventLine.theme,
            reqForModel.templateCandidates,
            resolveThemeOpts,
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
        if (eventLine && eventLine.type === 'field_patch') {
          if (!selected) {
            pendingPatches.push(eventLine.fields);
          } else {
            const safeFields = sanitizePatchFields(eventLine.fields);
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
        reqForModel.templateCandidates,
        resolveThemeOpts,
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
      for await (const ev of emitProgressiveSanitizedPatches({
        baseId,
        seqRef,
        policy: jsonPolicy,
        safe,
        accumulated,
      })) {
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
      resolvedTemplateId ?? defaultTemplateIdForCandidates(reqForModel.templateCandidates),
    );
    let gaps = packPolicy.missingFieldGroups(accumulated);
    const maxRepairPasses = 2;
    for (let repairPass = 0; repairPass < maxRepairPasses && gaps.length > 0; repairPass++) {
      const repairHint =
        repairPass > 0
          ? `The server still needs non-empty content for these sections: ${gaps.join(', ')}. Return one full JSON object with templateId, theme, and fields where EVERY required string/array is filled (≥3 logos, ≥3 steps with title+description each, all hero/math/final strings non-empty).`
          : undefined;
      const repaired = await this.requestRepairCompose(reqForModel, signal, repairHint);
      const { templateId: repairTid, theme: repairTheme } = resolveTemplateSelection(
        repaired.templateId,
        repaired.theme,
        reqForModel.templateCandidates,
        resolveThemeOpts,
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
      for await (const ev of emitGapPatchesFromSafe({
        baseId,
        seqRef: seqRefRepair,
        policy: repairPolicy,
        safe,
        gaps,
        accumulated,
      })) {
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
