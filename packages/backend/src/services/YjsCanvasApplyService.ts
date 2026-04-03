import { createRequire } from 'node:module';
import type { LayoutCreate, LayoutMove } from '../types/layout.js';
import { buildRecordFromCreate, newShapeId } from '../utils/yjsCanvasRecords.js';

const require = createRequire(import.meta.url);
const ywsUtils = require('y-websocket/bin/utils') as {
  getYDoc?: (docName: string) => { transact: (fn: () => void) => void };
};

export class YjsCanvasApplyService {
  applyLayout(opts: {
    docName: string;
    mapName: string;
    moves: LayoutMove[];
    creates: LayoutCreate[];
  }) {
    const getYDoc = ywsUtils.getYDoc;
    if (!getYDoc) {
      throw new Error(
        "y-websocket utils missing getYDoc(); can't apply AI layout to Yjs doc",
      );
    }

    const ydoc = getYDoc(opts.docName) as unknown as {
      transact: (fn: () => void) => void;
      getMap: <T = unknown>(name: string) => {
        get: (key: string) => T | undefined;
        set: (key: string, value: T) => void;
      };
    };

    const ymap = ydoc.getMap<Record<string, unknown>>(opts.mapName);

    ydoc.transact(() => {
      for (const c of opts.creates) {
        const id = newShapeId(c.kind);
        ymap.set(id, buildRecordFromCreate(c) as unknown as Record<string, unknown>);
      }

      for (const u of opts.moves) {
        const existing = ymap.get(u.id);
        if (!existing || typeof existing !== 'object') continue;
        const next = {
          ...(existing as Record<string, unknown>),
          left: u.x,
          top: u.y,
        };
        ymap.set(u.id, next);
      }
    });
  }
}
