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

/** Clears stage done flags and the `done:error` latch when starting a new compose run or initializing the doc. */
export function clearStreamStageDones(streamMap: Y.Map<unknown>) {
  STAGES.forEach((stage) => streamMap.set(`done:${stage.id}`, false));
  streamMap.set('done:error', false);
}

