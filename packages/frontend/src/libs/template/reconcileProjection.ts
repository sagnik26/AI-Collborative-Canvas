import * as Y from 'yjs';
import type { CanvasObjectRecord } from '../../types/canvas';

function isSameRecord(a: CanvasObjectRecord, b: CanvasObjectRecord) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function reconcileProjectionToYjs(opts: {
  objectsMap: Y.Map<CanvasObjectRecord>;
  recordsById: Map<string, CanvasObjectRecord>;
}) {
  const { objectsMap, recordsById } = opts;
  const liveIds = new Set<string>();
  objectsMap.forEach((_v, k) => {
    if (k.startsWith('slot:')) liveIds.add(k);
  });

  let created = 0;
  let updated = 0;
  let removed = 0;

  recordsById.forEach((rec, id) => {
    const prev = objectsMap.get(id);
    if (!prev) {
      objectsMap.set(id, rec);
      created++;
      return;
    }
    if (!isSameRecord(prev, rec)) {
      objectsMap.set(id, rec);
      updated++;
    }
  });

  liveIds.forEach((id) => {
    if (!recordsById.has(id)) {
      objectsMap.delete(id);
      removed++;
    }
  });

  return { created, updated, removed };
}
