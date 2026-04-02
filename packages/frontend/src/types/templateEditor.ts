import type { TemplateId } from './template';

export type StreamStage = {
  id: string;
  label: string;
  done: boolean;
};

export type TemplateEditorShellProps = {
  initialPrompt?: string;
  docId?: string;
  /** Compose allowlist; defaults to `DEFAULT_TEMPLATE_CANDIDATES` (Phase 4). */
  templateCandidates?: TemplateId[];
};

