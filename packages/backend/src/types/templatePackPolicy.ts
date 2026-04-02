import type { TemplateComposeModelResponse } from './templateCompose.js';

/** Semantic groups that must be satisfied before emitting `complete` (per-pack policy). */
export type FieldGroup = 'hero' | 'social' | 'steps' | 'math' | 'final';

export type SanitizedFullFields = TemplateComposeModelResponse['fields'];

export interface TemplatePackFieldPolicy {
  readonly fieldGroupEmitOrder: readonly FieldGroup[];
  missingFieldGroups(acc: Record<string, unknown>): FieldGroup[];
  chunkForGroup(safe: SanitizedFullFields, g: FieldGroup): Record<string, unknown>;
  /** Ordered patch chunks for JSON fallback / progressive synthetic streaming. */
  progressiveChunks(safe: SanitizedFullFields): Record<string, unknown>[];
}

