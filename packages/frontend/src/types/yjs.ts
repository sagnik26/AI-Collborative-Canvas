import type * as Y from 'yjs';
import type { CanvasObjectRecord } from './canvas';

/** Sync a Fabric canvas with an existing Y.Map (shared doc / room). */
export type YjsFabricMapBinding = {
  destroy: () => void;
  getRecordsById: () => Map<string, CanvasObjectRecord>;
  applyFromYjs: (opts?: { animatePositions?: boolean }) => void;
};

export type YjsFabricBinding = {
  destroy: () => void;
  getRecordsById: () => Map<string, CanvasObjectRecord>;
  isSynced: () => boolean;
  getRoomId: () => string;
  getDoc: () => Y.Doc;
};

