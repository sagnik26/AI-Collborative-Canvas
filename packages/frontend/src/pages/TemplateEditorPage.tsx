import { useLocation } from 'react-router-dom';
import { TemplateEditorShell } from '../components/TemplateEditorShell';

export function TemplateEditorPage() {
  const location = useLocation();
  const state = location.state as { prompt?: string; docId?: string } | null;
  const params = new URLSearchParams(location.search);
  const docIdFromQuery = params.get('doc') ?? undefined;
  const docId = docIdFromQuery ?? state?.docId;
  return <TemplateEditorShell initialPrompt={state?.prompt} docId={docId} />;
}
