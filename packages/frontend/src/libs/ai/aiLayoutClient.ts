import type { Canvas as FabricCanvasType, FabricObject } from 'fabric';
import type { CanvasObjectKind, CanvasObjectRecord } from '../../types/canvas';
import { getKind, getObjectId } from '../canvas/fabricRecords.ts';

export type AiLayoutElement = {
  id: string;
  type: 'rect' | 'text' | 'circle' | 'image' | 'line' | 'arrow';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  rotation: number;
  zIndex: number;
};

export type AiLayoutRequest = {
  elements: AiLayoutElement[];
  instruction: string;
  canvasWidth: number;
  canvasHeight: number;
  doc?: string;
  mapName?: string;
};

export type AiLayoutResponse = {
  elements: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  creates: Array<{
    kind: 'rect' | 'circle' | 'text' | 'line' | 'arrow';
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    fill: string;
  }>;
  reasoning: string;
};

function getFill(obj: FabricObject, rec: CanvasObjectRecord | null) {
  if (rec?.fill) return rec.fill;
  const fill = (obj as unknown as { fill?: unknown }).fill;
  return typeof fill === 'string' ? fill : '#000000';
}

function getLabel(obj: FabricObject, rec: CanvasObjectRecord | null) {
  if (typeof rec?.text === 'string') return rec.text;
  const text = (obj as unknown as { text?: unknown }).text;
  return typeof text === 'string' ? text : '';
}

function defaultWidthHeight(kind: CanvasObjectKind): { w: number; h: number } {
  switch (kind) {
    case 'rect':
      return { w: 240, h: 150 };
    case 'circle':
      return { w: 160, h: 160 };
    case 'text':
      return { w: 320, h: 40 };
    case 'line':
      return { w: 280, h: 4 };
    case 'arrow':
      return { w: 280, h: 24 };
    default:
      return { w: 120, h: 120 };
  }
}

function findObjectById(canvas: FabricCanvasType, id: string) {
  const objs = canvas.getObjects() as FabricObject[];
  return objs.find((o) => getObjectId(o) === id);
}

export function buildAiLayoutElementsFromCanvas(
  canvas: FabricCanvasType,
  yRecordsById: Map<string, CanvasObjectRecord>,
) {
  const elements: AiLayoutElement[] = [];
  const seen = new Set<string>();

  // Primary: Yjs map keys are the stable ids (works even if Fabric `instanceof` / id reads glitch).
  let z = 0;
  yRecordsById.forEach((rec, id) => {
    seen.add(id);
    const obj = findObjectById(canvas, id);
    const kind = rec.kind;
    const left =
      obj && typeof obj.left === 'number' ? obj.left : rec.left;
    const top = obj && typeof obj.top === 'number' ? obj.top : rec.top;
    const def = defaultWidthHeight(kind);
    const width =
      obj &&
      typeof (obj as unknown as { getScaledWidth?: () => number }).getScaledWidth ===
        'function'
        ? (obj as unknown as { getScaledWidth: () => number }).getScaledWidth()
        : def.w;
    const height =
      obj &&
      typeof (obj as unknown as { getScaledHeight?: () => number }).getScaledHeight ===
        'function'
        ? (obj as unknown as { getScaledHeight: () => number }).getScaledHeight()
        : def.h;
    const angle =
      obj && typeof obj.angle === 'number' ? obj.angle : rec.angle;

    elements.push({
      id,
      type: kind,
      label: obj ? getLabel(obj, rec) : typeof rec.text === 'string' ? rec.text : '',
      x: left,
      y: top,
      width,
      height,
      fill: obj ? getFill(obj, rec) : rec.fill ?? '#000000',
      rotation: angle,
      zIndex: z,
    });
    z++;
  });

  // Fallback: objects on canvas not yet in Yjs (rare race).
  const objs = canvas.getObjects() as FabricObject[];
  for (let i = 0; i < objs.length; i++) {
    const obj = objs[i];
    const id = getObjectId(obj);
    if (!id || seen.has(id)) continue;

    const kind = getKind(obj);
    if (!kind) continue;

    const left = typeof obj.left === 'number' ? obj.left : 0;
    const top = typeof obj.top === 'number' ? obj.top : 0;
    const width =
      typeof (obj as unknown as { getScaledWidth?: () => number }).getScaledWidth ===
      'function'
        ? (obj as unknown as { getScaledWidth: () => number }).getScaledWidth()
        : 0;
    const height =
      typeof (obj as unknown as { getScaledHeight?: () => number }).getScaledHeight ===
      'function'
        ? (obj as unknown as { getScaledHeight: () => number }).getScaledHeight()
        : 0;
    const angle = typeof obj.angle === 'number' ? obj.angle : 0;

    const rec = yRecordsById.get(id) ?? null;

    elements.push({
      id,
      type: kind,
      label: getLabel(obj, rec),
      x: left,
      y: top,
      width,
      height,
      fill: getFill(obj, rec),
      rotation: angle,
      zIndex: z,
    });
    z++;
  }

  return elements;
}

export async function requestAiLayout(opts: {
  apiBaseUrl: string;
  req: AiLayoutRequest;
}) {
  const r = await fetch(`${opts.apiBaseUrl}/ai/layout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(opts.req),
  });

  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`;
    try {
      const body = (await r.json()) as unknown;
      msg =
        typeof body === 'object' && body && 'message' in body
          ? String((body as { message: unknown }).message)
          : msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  return (await r.json()) as AiLayoutResponse;
}

