import { Group, Line, Textbox } from 'fabric';
import type { Canvas as FabricCanvasType, FabricObject } from 'fabric';
import type { CanvasObjectKind, CanvasObjectRecord } from '../../types/canvas';
import {
  createArrow,
  createLabeledCircle,
  createLabeledRect,
  createLine,
  createTable,
  createText,
} from './fabricFactories';

/** Fabric `type` getter returns lowercased class name (e.g. `group`, `textbox`). */
function fabricTypeLower(obj: FabricObject) {
  const t = (obj as unknown as { type?: unknown }).type;
  return typeof t === 'string' ? t.toLowerCase() : '';
}

function isGroupLike(obj: FabricObject) {
  return obj instanceof Group || fabricTypeLower(obj) === 'group';
}

function isLineLike(obj: FabricObject) {
  return obj instanceof Line || fabricTypeLower(obj) === 'line';
}

function isTextboxLike(obj: FabricObject) {
  return obj instanceof Textbox || fabricTypeLower(obj) === 'textbox';
}

export function getObjectId(obj: FabricObject) {
  const anyObj = obj as unknown as {
    id?: unknown;
    get?: (key: string) => unknown;
  };
  if (typeof anyObj.id === 'string') return anyObj.id;
  const fromGet = typeof anyObj.get === 'function' ? anyObj.get('id') : null;
  if (typeof fromGet === 'string') return fromGet;
  return null;
}

export function getKind(obj: FabricObject): CanvasObjectKind | null {
  if (isLineLike(obj)) return 'line';
  if (isTextboxLike(obj)) return 'text';
  if (isGroupLike(obj)) {
    const id = getObjectId(obj);
    if (id?.startsWith('table_')) return 'table';
    if (id?.startsWith('arrow_')) return 'arrow';
    if (id?.startsWith('rect_')) return 'rect';
    if (id?.startsWith('circle_')) return 'circle';
    return 'rect';
  }
  const id = getObjectId(obj);
  if (id?.startsWith('table_')) return 'table';
  if (id?.startsWith('arrow_')) return 'arrow';
  if (id?.startsWith('line_')) return 'line';
  if (id?.startsWith('text_')) return 'text';
  if (id?.startsWith('circle_')) return 'circle';
  if (id?.startsWith('rect_')) return 'rect';
  return null;
}

export function serializeObject(obj: FabricObject): CanvasObjectRecord | null {
  const kind = getKind(obj);
  if (!kind) return null;

  const left = typeof obj.left === 'number' ? obj.left : 0;
  const top = typeof obj.top === 'number' ? obj.top : 0;
  const scaleX = typeof obj.scaleX === 'number' ? obj.scaleX : 1;
  const scaleY = typeof obj.scaleY === 'number' ? obj.scaleY : 1;
  const angle = typeof obj.angle === 'number' ? obj.angle : 0;

  const rec: CanvasObjectRecord = { kind, left, top, scaleX, scaleY, angle };

  if (kind === 'text') {
    const t = obj as unknown as {
      text?: unknown;
      fontSize?: unknown;
      fill?: unknown;
    };
    if (typeof t.text === 'string') rec.text = t.text;
    if (typeof t.fontSize === 'number') rec.fontSize = t.fontSize;
    if (typeof t.fill === 'string') rec.fill = t.fill;
    return rec;
  }

  if (kind === 'line') {
    const l = obj as unknown as {
      x1?: unknown;
      y1?: unknown;
      x2?: unknown;
      y2?: unknown;
      stroke?: unknown;
    };
    if (
      typeof l.x1 === 'number' &&
      typeof l.y1 === 'number' &&
      typeof l.x2 === 'number' &&
      typeof l.y2 === 'number'
    ) {
      rec.line = { x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2 };
    }
    if (typeof l.stroke === 'string') rec.fill = l.stroke;
    return rec;
  }

  if (kind === 'table' && isGroupLike(obj)) {
    const g = obj as Group;
    const meta = (g as unknown as { get?: (k: string) => unknown }).get?.('table');
    const rows =
      typeof (meta as { rows?: unknown } | null)?.rows === 'number'
        ? (meta as { rows: number }).rows
        : 3;
    const cols =
      typeof (meta as { cols?: unknown } | null)?.cols === 'number'
        ? (meta as { cols: number }).cols
        : 3;

    // Prefer background rect fill for tables.
    const bg = g.getObjects()[0] as unknown as { fill?: unknown };
    if (typeof bg?.fill === 'string') rec.fill = bg.fill;

    const cells: string[] = Array.from({ length: rows * cols }, () => '');
    g.getObjects().forEach((o) => {
      if (!isTextboxLike(o as unknown as FabricObject)) return;
      const t = o as unknown as { text?: unknown; get?: (k: string) => unknown };
      const idx = t.get ? t.get('cellIndex') : null;
      if (typeof idx === 'number' && idx >= 0 && idx < cells.length) {
        cells[idx] = typeof t.text === 'string' ? t.text : '';
      }
    });
    rec.table = { rows, cols, cells };
    return rec;
  }

  if (kind === 'rect' || kind === 'circle' || kind === 'arrow') {
    const fillFromObj = (obj as unknown as { fill?: unknown }).fill;
    if (typeof fillFromObj === 'string') rec.fill = fillFromObj;
    if (isGroupLike(obj)) {
      const g = obj as Group;
      const shape = g.getObjects()[0] as unknown as {
        fill?: unknown;
        stroke?: unknown;
      };
      if (typeof shape?.fill === 'string') rec.fill = shape.fill;
      else if (typeof shape?.stroke === 'string') rec.fill = shape.stroke;

      const label = g.getObjects().find((o) => o instanceof Textbox) as
        | Textbox
        | undefined;
      if (label) {
        rec.text = label.text ?? '';
        rec.fontSize = label.fontSize ?? undefined;
      }
    }
    return rec;
  }

  return rec;
}

export function applyRecordToObject(
  obj: FabricObject,
  rec: CanvasObjectRecord,
) {
  obj.set({
    left: rec.left,
    top: rec.top,
    scaleX: rec.scaleX,
    scaleY: rec.scaleY,
    angle: rec.angle,
  });

  if (rec.kind === 'text') {
    if ('text' in obj && typeof rec.text === 'string')
      obj.set('text', rec.text);
    if ('fontSize' in obj && typeof rec.fontSize === 'number')
      obj.set('fontSize', rec.fontSize);
    if ('fill' in obj && typeof rec.fill === 'string')
      obj.set('fill', rec.fill);
  } else if (rec.kind === 'line') {
    if (rec.line) {
      obj.set({
        x1: rec.line.x1,
        y1: rec.line.y1,
        x2: rec.line.x2,
        y2: rec.line.y2,
      });
    }
    if (typeof rec.fill === 'string') obj.set('stroke', rec.fill);
  } else if (rec.kind === 'table' && isGroupLike(obj)) {
    const g = obj as Group;
    const rows = rec.table?.rows ?? 3;
    const cols = rec.table?.cols ?? 3;
    const cells = rec.table?.cells ?? [];
    const max = rows * cols;

    // Update background fill if present.
    const bg = g.getObjects()[0] as unknown as { set?: (k: string, v: unknown) => void };
    if (bg?.set && typeof rec.fill === 'string') bg.set('fill', rec.fill);

    g.getObjects().forEach((o) => {
      if (!isTextboxLike(o as unknown as FabricObject)) return;
      const t = o as unknown as {
        set?: (k: string, v: unknown) => void;
        get?: (k: string) => unknown;
      };
      const idx = t.get ? t.get('cellIndex') : null;
      if (!t.set) return;
      if (typeof idx === 'number' && idx >= 0 && idx < max) {
        t.set('text', typeof cells[idx] === 'string' ? cells[idx] : '');
      }
    });
  } else if (isGroupLike(obj)) {
    const g = obj as Group;
    const shape = g.getObjects()[0] as unknown as {
      set?: (k: string, v: unknown) => void;
    };
    if (shape?.set && typeof rec.fill === 'string') shape.set('fill', rec.fill);
    const label = g.getObjects().find((o) => o instanceof Textbox) as
      | Textbox
      | undefined;
    if (label && typeof rec.text === 'string') label.set('text', rec.text);
    if (label && typeof rec.fontSize === 'number')
      label.set('fontSize', rec.fontSize);
  } else if (typeof rec.fill === 'string') {
    obj.set('fill', rec.fill);
  }

  obj.setCoords();
}

export function ensureObjectForRecord(
  c: FabricCanvasType,
  id: string,
  rec: CanvasObjectRecord,
) {
  const existing = c
    .getObjects()
    .find((o) => getObjectId(o as FabricObject) === id) as
    | FabricObject
    | undefined;
  if (existing) return existing;

  let obj: FabricObject;
  if (rec.kind === 'rect') obj = createLabeledRect(c);
  else if (rec.kind === 'circle') obj = createLabeledCircle(c);
  else if (rec.kind === 'arrow') obj = createArrow(c);
  else if (rec.kind === 'table')
    obj = createTable(c, {
      rows: rec.table?.rows,
      cols: rec.table?.cols,
      cells: rec.table?.cells,
    });
  else if (rec.kind === 'line') obj = createLine(c);
  else obj = createText(c);

  obj.set('id', id);
  c.add(obj);
  return obj;
}
