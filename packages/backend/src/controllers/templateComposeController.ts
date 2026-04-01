import type { Request, Response } from 'express';
import { OpenAiTemplateComposeService } from '../services/OpenAiTemplateComposeService.js';
import {
  errorEventSchema,
  templateComposeRequestSchema,
} from '../schemas/templateComposeSchemas.js';

function getBearerToken(req: Request) {
  const header = req.header('authorization');
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)\s*$/i);
  return m?.[1] ? m[1].trim() : null;
}

function getOpenAiApiKey(req: Request) {
  const fromHeader = getBearerToken(req);
  if (fromHeader) return fromHeader;

  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not configured');
  return key;
}

function writeNdjson(res: Response, payload: unknown) {
  res.write(`${JSON.stringify(payload)}\n`);
}

export async function templateComposeController(req: Request, res: Response) {
  const parsed = templateComposeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parsed.error.flatten(),
    });
    return;
  }

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  try {
    const service = new OpenAiTemplateComposeService({ apiKey: getOpenAiApiKey(req) });
    const events = await service.compose(parsed.data);
    for (const event of events) {
      writeNdjson(res, event);
    }
    res.end();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Template compose failed';
    writeNdjson(
      res,
      errorEventSchema.parse({
        type: 'error',
        opId: `err-${Date.now()}`,
        message,
      }),
    );
    res.end();
  }
}
