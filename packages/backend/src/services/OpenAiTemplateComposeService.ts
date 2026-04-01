import OpenAI from 'openai';
import { buildTemplateComposeSystemPrompt } from '../prompts/templateComposePrompt.js';
import {
  type TemplateComposeEvent,
  type TemplateComposeModelResponse,
  type TemplateComposeRequest,
  completeEventSchema,
  fieldPatchEventSchema,
  templateComposeModelResponseSchema,
  templateSelectedEventSchema,
} from '../schemas/templateComposeSchemas.js';

function sanitizeText(input: string, max: number) {
  const compact = input.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return compact.slice(0, max);
}

function sanitizeFields(result: TemplateComposeModelResponse): TemplateComposeModelResponse['fields'] {
  return {
    heroBadge: sanitizeText(result.fields.heroBadge, 24),
    heroHeadline: sanitizeText(result.fields.heroHeadline, 120),
    heroSubheadline: sanitizeText(result.fields.heroSubheadline, 220),
    heroPrimaryCta: sanitizeText(result.fields.heroPrimaryCta, 32),
    heroSecondaryCta: sanitizeText(result.fields.heroSecondaryCta, 32),
    socialProofTitle: sanitizeText(result.fields.socialProofTitle, 96),
    logos: result.fields.logos.map((logo) => sanitizeText(logo, 24)).slice(0, 8),
    steps: result.fields.steps.slice(0, 4).map((step) => ({
      title: sanitizeText(step.title, 48),
      description: sanitizeText(step.description, 120),
    })),
    mathTitle: sanitizeText(result.fields.mathTitle, 64),
    mathFormula: sanitizeText(result.fields.mathFormula, 120),
    mathFootnote: sanitizeText(result.fields.mathFootnote, 140),
    finalCtaHeadline: sanitizeText(result.fields.finalCtaHeadline, 120),
    finalCtaLabel: sanitizeText(result.fields.finalCtaLabel, 32),
  };
}

export class OpenAiTemplateComposeService {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(opts: { apiKey: string; model?: string }) {
    this.client = new OpenAI({ apiKey: opts.apiKey });
    this.model = opts.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  }

  async compose(req: TemplateComposeRequest): Promise<TemplateComposeEvent[]> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.5,
      messages: [
        { role: 'system', content: buildTemplateComposeSystemPrompt(req) },
        { role: 'user', content: req.prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'template_compose_response',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['templateId', 'theme', 'fields'],
            properties: {
              templateId: { type: 'string', enum: ['landing.v1'] },
              theme: { type: 'string', enum: ['landing-dark'] },
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
    });

    const content = completion.choices[0]?.message?.content ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('OpenAI returned non-JSON content');
    }

    const validated = templateComposeModelResponseSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error('OpenAI returned invalid template payload');
    }

    const safe = sanitizeFields(validated.data);
    const baseId = `ai-${Date.now()}`;
    const selected = templateSelectedEventSchema.parse({
      type: 'template_selected',
      opId: `${baseId}:1`,
      templateId: validated.data.templateId,
      theme: validated.data.theme,
      status: 'streaming',
    });
    const patchOne = fieldPatchEventSchema.parse({
      type: 'field_patch',
      opId: `${baseId}:2`,
      fields: {
        heroBadge: safe.heroBadge,
        heroHeadline: safe.heroHeadline,
        heroSubheadline: safe.heroSubheadline,
        heroPrimaryCta: safe.heroPrimaryCta,
        heroSecondaryCta: safe.heroSecondaryCta,
        socialProofTitle: safe.socialProofTitle,
      },
    });
    const patchTwo = fieldPatchEventSchema.parse({
      type: 'field_patch',
      opId: `${baseId}:3`,
      fields: {
        logos: safe.logos,
        steps: safe.steps,
        mathTitle: safe.mathTitle,
        mathFormula: safe.mathFormula,
        mathFootnote: safe.mathFootnote,
        finalCtaHeadline: safe.finalCtaHeadline,
        finalCtaLabel: safe.finalCtaLabel,
      },
    });
    const complete = completeEventSchema.parse({
      type: 'complete',
      opId: `${baseId}:4`,
      status: 'complete',
    });

    return [selected, patchOne, patchTwo, complete];
  }
}
