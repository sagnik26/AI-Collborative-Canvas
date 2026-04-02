import type { TemplateId } from './template';

export type PromptChip = {
  label: string;
  prompt: string;
  /** Passed to the template editor as compose allowlist when set. */
  templateCandidates?: TemplateId[];
};

