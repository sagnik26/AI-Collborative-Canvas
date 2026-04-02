import { randomBytes } from 'node:crypto';
import { normalizeCreateFill } from './canvasTheme.js';
import type { LayoutCreate } from '../types/layout.js';
import type { CanvasRecord } from '../types/yjsCanvas.js';

export function newShapeId(kind: string) {
  return `${kind}_${randomBytes(6).toString('base64url')}`;
}

export function buildRecordFromCreate(c: LayoutCreate): CanvasRecord {
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

