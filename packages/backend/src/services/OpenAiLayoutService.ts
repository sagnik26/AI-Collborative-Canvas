import OpenAI from 'openai';
import { buildAiLayoutSystemPrompt } from '../prompts/aiLayoutPrompt.js';
import { aiLayoutResponseSchema } from '../schemas/aiLayoutSchemas.js';
import type { AiLayoutRequest, AiLayoutResponse } from '../types/aiLayout.js';
import type { ConversationMessage } from '../types/conversation.js';

export class OpenAiLayoutService {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(opts: { apiKey: string; model?: string }) {
    this.client = new OpenAI({ apiKey: opts.apiKey });
    this.model = opts.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  }

  async layout(opts: {
    req: AiLayoutRequest;
    messages: ConversationMessage[];
  }): Promise<{ result: AiLayoutResponse; assistantText: string }> {
    const { req, messages } = opts;
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: buildAiLayoutSystemPrompt({
            canvasWidth: req.canvasWidth,
            canvasHeight: req.canvasHeight,
          }),
        },
        ...messages,
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ai_layout_response',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              elements: {
                type: 'array',
                maxItems: 100,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['id', 'x', 'y', 'width', 'height'],
                  properties: {
                    id: { type: 'string' },
                    x: { type: 'number' },
                    y: { type: 'number' },
                    width: { type: 'number' },
                    height: { type: 'number' },
                  },
                },
              },
              creates: {
                type: 'array',
                maxItems: 20,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: [
                    'kind',
                    'x',
                    'y',
                    'width',
                    'height',
                    'label',
                    'fill',
                  ],
                  properties: {
                    kind: {
                      type: 'string',
                      enum: ['rect', 'circle', 'text', 'line', 'arrow'],
                    },
                    x: { type: 'number' },
                    y: { type: 'number' },
                    width: { type: 'number' },
                    height: { type: 'number' },
                    label: { type: 'string' },
                    fill: { type: 'string' },
                  },
                },
              },
              reasoning: { type: 'string' },
            },
            required: ['elements', 'creates', 'reasoning'],
          },
          strict: true,
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

    const validated = aiLayoutResponseSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error('OpenAI returned invalid JSON shape');
    }

    return { result: validated.data, assistantText: content };
  }
}
