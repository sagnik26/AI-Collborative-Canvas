import type {
  TemplateComposeEvent,
  TemplateFields,
  TemplateComposeRequest,
} from '../../types/template';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function parseEvent(input: unknown): TemplateComposeEvent {
  if (!isRecord(input) || typeof input.type !== 'string' || typeof input.opId !== 'string') {
    throw new Error('Invalid compose stream event');
  }

  if (input.type === 'template_selected') {
    if (
      input.templateId !== 'landing.v1' ||
      input.theme !== 'landing-dark' ||
      input.status !== 'streaming'
    ) {
      throw new Error('Invalid template_selected event');
    }
    return {
      type: 'template_selected',
      opId: input.opId,
      templateId: 'landing.v1',
      theme: 'landing-dark',
      status: 'streaming',
    };
  }

  if (input.type === 'field_patch') {
    if (!isRecord(input.fields)) {
      throw new Error('Invalid field_patch event');
    }
    return {
      type: 'field_patch',
      opId: input.opId,
      fields: input.fields as Partial<TemplateFields>,
    };
  }

  if (input.type === 'complete') {
    if (input.status !== 'complete') throw new Error('Invalid complete event');
    return { type: 'complete', opId: input.opId, status: 'complete' };
  }

  if (input.type === 'error') {
    if (typeof input.message !== 'string') throw new Error('Invalid error event');
    return { type: 'error', opId: input.opId, message: input.message };
  }

  throw new Error(`Unsupported event type: ${input.type}`);
}

export async function streamTemplateCompose(opts: {
  apiBaseUrl: string;
  req: TemplateComposeRequest;
  signal?: AbortSignal;
  onEvent: (event: TemplateComposeEvent) => void;
}) {
  const response = await fetch(`${opts.apiBaseUrl}/ai/compose-template`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(opts.req),
    signal: opts.signal,
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as unknown;
      if (isRecord(body) && typeof body.message === 'string') {
        message = body.message;
      }
    } catch {
      // ignore parse failures
    }
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error('Compose stream body is unavailable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });
    const lines = buffered.split('\n');
    buffered = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parsed = parseEvent(JSON.parse(trimmed) as unknown);
      opts.onEvent(parsed);
    }
  }

  const finalChunk = buffered.trim();
  if (finalChunk.length > 0) {
    const parsed = parseEvent(JSON.parse(finalChunk) as unknown);
    opts.onEvent(parsed);
  }
}
