import { fieldPatchEventSchema } from '../schemas/templateComposeSchemas.js';
import type { TemplateComposeEvent } from '../types/templateCompose.js';
import { staggerProgressivePatch, mergeIntoAccumulated } from './templateComposeUtils.js';
import type { FieldGroup, TemplatePackFieldPolicy } from '../types/templatePackPolicy.js';

export async function* emitProgressiveSanitizedPatches(opts: {
  baseId: string;
  seqRef: { n: number };
  policy: TemplatePackFieldPolicy;
  safe: Parameters<TemplatePackFieldPolicy['progressiveChunks']>[0];
  accumulated?: Record<string, unknown>;
}): AsyncGenerator<TemplateComposeEvent> {
  const { baseId, seqRef, policy, safe, accumulated } = opts;
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

export async function* emitGapPatchesFromSafe(opts: {
  baseId: string;
  seqRef: { n: number };
  policy: TemplatePackFieldPolicy;
  safe: Parameters<TemplatePackFieldPolicy['progressiveChunks']>[0];
  gaps: FieldGroup[];
  accumulated: Record<string, unknown>;
}): AsyncGenerator<TemplateComposeEvent> {
  const { baseId, seqRef, policy, safe, gaps, accumulated } = opts;
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

