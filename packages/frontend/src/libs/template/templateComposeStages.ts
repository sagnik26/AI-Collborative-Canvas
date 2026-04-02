import * as Y from 'yjs';
import { STAGES } from '../../constants/templateComposeStages';
export { STAGES };

export function readStages(map: Y.Map<unknown>) {
  return STAGES.map((s) => ({
    id: s.id,
    label: s.label,
    done: map.get(`done:${s.id}`) === true,
  }));
}

