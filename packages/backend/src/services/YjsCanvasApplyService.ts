import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { normalizeCreateFill } from '../utils/canvasTheme.js';

export type LayoutMove = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutCreate = {
  kind: 'rect' | 'circle' | 'text' | 'line' | 'arrow';
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  fill: string;
};

/** Matches frontend `CanvasObjectRecord` (plain JSON in Y.Map). */
type CanvasRecord = {
  kind: LayoutCreate['kind'];
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  fill?: string;
  text?: string;
  fontSize?: number;
  line?: { x1: number; y1: number; x2: number; y2: number };
};

const require = createRequire(import.meta.url);
const ywsUtils = require('y-websocket/bin/utils') as {
  getYDoc?: (docName: string) => { transact: (fn: () => void) => void };
};

function newShapeId(kind: string) {
  return `${kind}_${randomBytes(6).toString('base64url')}`;
}

function buildRecordFromCreate(c: LayoutCreate): CanvasRecord {
  const { kind, x, y, width, height, label } = c;
  const fill = normalizeCreateFill(kind, c.fill, { strictTheme: true });

  if (kind === 'circle') {
    const base = 160;
    return {
      kind: 'circle',
      left: x,
      top: y,
      scaleX: width / base,
      scaleY: height / base,
      angle: 0,
      fill,
      text: label || 'Label',
    };
  }

  if (kind === 'rect') {
    const bw = 240;
    const bh = 150;
    return {
      kind: 'rect',
      left: x,
      top: y,
      scaleX: width / bw,
      scaleY: height / bh,
      angle: 0,
      fill,
      text: label || 'Label',
    };
  }

  if (kind === 'text') {
    const bw = 320;
    const bh = 50;
    return {
      kind: 'text',
      left: x,
      top: y,
      scaleX: width / bw,
      scaleY: height / bh,
      angle: 0,
      fill,
      text: label || 'Double-click to edit',
      fontSize: 22,
    };
  }

  if (kind === 'line') {
    const half = width / 2;
    return {
      kind: 'line',
      left: x,
      top: y,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      line: { x1: x - half, y1: y, x2: x + half, y2: y },
      fill,
    };
  }

  // arrow — approximate factory footprint ~280×40
  const bw = 280;
  const bh = 40;
  return {
    kind: 'arrow',
    left: x,
    top: y,
    scaleX: width / bw,
    scaleY: height / bh,
    angle: 0,
    fill,
    text: label || '',
  };
}

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
