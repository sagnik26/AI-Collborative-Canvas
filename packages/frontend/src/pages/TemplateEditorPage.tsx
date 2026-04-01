import { useLocation } from 'react-router-dom';
import { TemplateEditorShell } from '../components/TemplateEditorShell';
import { parseTemplateCandidatesQueryParam } from '../libs/template/templatePacks.ts';

export function TemplateEditorPage() {
  const location = useLocation();
  const state = location.state as { prompt?: string; docId?: string } | null;
  const params = new URLSearchParams(location.search);
  const docIdFromQuery = params.get('doc') ?? undefined;
  const docId = docIdFromQuery ?? state?.docId;
  const templateCandidates = parseTemplateCandidatesQueryParam(params.get('candidates'));
  return (
    <TemplateEditorShell
      initialPrompt={state?.prompt}
      docId={docId}
      templateCandidates={templateCandidates}
    />
  );
}
