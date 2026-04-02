import type * as Y from 'yjs';
import type { CanvasObjectRecord } from './canvas';

export type YjsFabricBinding = {
  destroy: () => void;
  getRecordsById: () => Map<string, CanvasObjectRecord>;
  isSynced: () => boolean;
  getRoomId: () => string;
  getDoc: () => Y.Doc;
};

