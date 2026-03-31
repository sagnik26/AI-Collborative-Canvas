import type { Request, Response } from 'express';
import { aiLayoutRequestSchema } from '../schemas/aiLayoutSchemas.js';
import { OpenAiLayoutService } from '../services/OpenAiLayoutService.js';
import { YjsCanvasApplyService } from '../services/YjsCanvasApplyService.js';

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

export async function aiLayoutController(req: Request, res: Response) {
  const parsed = aiLayoutRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parsed.error.flatten(),
    });
    return;
  }

  try {
    const svc = new OpenAiLayoutService({ apiKey: getOpenAiApiKey(req) });
    const result = await svc.layout(parsed.data);
    new YjsCanvasApplyService().applyLayout({
      docName: parsed.data.doc,
      mapName: parsed.data.mapName,
      moves: result.elements,
      creates: result.creates,
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({
      error: 'AI layout failed',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
}
