import type { Request } from 'express';

export function getBearerToken(req: Request) {
  const header = req.header('authorization');
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)\s*$/i);
  return m?.[1] ? m[1].trim() : null;
}

export function getOpenAiApiKey(req: Request) {
  const fromHeader = getBearerToken(req);
  if (fromHeader) return fromHeader;

  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not configured');
  return key;
}

