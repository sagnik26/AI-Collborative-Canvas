import { Circle, Group, Line, Rect, Textbox, Triangle } from 'fabric';
import type { Canvas as FabricCanvasType, FabricObject } from 'fabric';

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function getCanvasCenter(c: FabricCanvasType) {
  const p = c.getCenterPoint();
  return { x: p.x, y: p.y };
}

function setObjectCenter(c: FabricCanvasType, obj: FabricObject) {
  const { x, y } = getCanvasCenter(c);
  obj.set({ left: x, top: y, originX: 'center', originY: 'center' });
  obj.setCoords();
}

export function createLabeledRect(c: FabricCanvasType) {
  const rect = new Rect({
    width: 240,
    height: 150,
    fill: '#6d28d9',
    rx: 12,
    ry: 12,
    stroke: 'rgba(255,255,255,0.22)',
    strokeWidth: 1,
    originX: 'center',
    originY: 'center',
  });

  const label = new Textbox('Label', {
    width: 200,
    fontSize: 20,
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    fill: '#f3f4f6',
    textAlign: 'center',
    editable: true,
    originX: 'center',
    originY: 'center',
  });

  const group = new Group([rect, label], {
    subTargetCheck: true,
    objectCaching: false,
  });
  group.set('id', randomId('rect'));
  group.setControlsVisibility({ mtr: true });
  setObjectCenter(c, group);
  return group;
}

export function createLabeledCircle(c: FabricCanvasType) {
  const circle = new Circle({
    radius: 80,
    fill: '#0ea5e9',
    stroke: 'rgba(255,255,255,0.22)',
    strokeWidth: 1,
    originX: 'center',
    originY: 'center',
  });

  const label = new Textbox('Label', {
    width: 170,
    fontSize: 18,
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    fill: '#f3f4f6',
    textAlign: 'center',
    editable: true,
    originX: 'center',
    originY: 'center',
  });

  const group = new Group([circle, label], {
    subTargetCheck: true,
    objectCaching: false,
  });
  group.set('id', randomId('circle'));
  group.setControlsVisibility({ mtr: true });
  setObjectCenter(c, group);
  return group;
}

export function createText(c: FabricCanvasType) {
  const text = new Textbox('Double-click to edit', {
    width: 320,
    fontSize: 22,
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    fill: '#f3f4f6',
    editable: true,
    originX: 'center',
    originY: 'center',
  });
  text.set('id', randomId('text'));
  setObjectCenter(c, text);
  return text;
}

export function createLine(c: FabricCanvasType) {
  const { x, y } = getCanvasCenter(c);
  const line = new Line([x - 140, y, x + 140, y], {
    stroke: 'rgba(255,255,255,0.75)',
    strokeWidth: 3,
    strokeLineCap: 'round',
    selectable: true,
  });
  line.set('id', randomId('line'));
  line.setControlsVisibility({ mtr: true });
  line.setCoords();
  return line;
}

export function createArrow(c: FabricCanvasType) {
  const { x, y } = getCanvasCenter(c);
  const x1 = x - 140;
  const y1 = y;
  const x2 = x + 140;
  const y2 = y;

  const shaft = new Line([x1, y1, x2, y2], {
    stroke: 'rgba(255,255,255,0.8)',
    strokeWidth: 3,
    strokeLineCap: 'round',
    originX: 'center',
    originY: 'center',
  });

  const head = new Triangle({
    width: 16,
    height: 16,
    fill: 'rgba(255,255,255,0.9)',
    left: x2,
    top: y2,
    originX: 'center',
    originY: 'center',
    angle: 90,
  });

  const group = new Group([shaft, head], {
    subTargetCheck: true,
    objectCaching: false,
  });
  group.set('id', randomId('arrow'));
  group.setControlsVisibility({ mtr: true });
  setObjectCenter(c, group);
  return group;
}

export function createTable(
  c: FabricCanvasType,
  opts?: { rows?: number; cols?: number; cells?: string[] },
) {
  const rows = Math.max(1, Math.min(20, opts?.rows ?? 3));
  const cols = Math.max(1, Math.min(20, opts?.cols ?? 3));
  const cells = opts?.cells ?? [];

  const cellW = 140;
  const cellH = 44;
  const tableW = cols * cellW;
  const tableH = rows * cellH;

  const bg = new Rect({
    width: tableW,
    height: tableH,
    fill: 'rgba(255,255,255,0.02)',
    rx: 10,
    ry: 10,
    stroke: 'rgba(255,255,255,0.22)',
    strokeWidth: 1,
    originX: 'center',
    originY: 'center',
  });

  const children: FabricObject[] = [bg];

  // Grid lines (within the background rect).
  const x0 = -tableW / 2;
  const y0 = -tableH / 2;
  for (let cIdx = 1; cIdx < cols; cIdx++) {
    const x = x0 + cIdx * cellW;
    const v = new Line([x, y0, x, y0 + tableH], {
      stroke: 'rgba(255,255,255,0.14)',
      strokeWidth: 1,
      selectable: false,
      evented: false,
      originX: 'center',
      originY: 'center',
    });
    children.push(v);
  }
  for (let rIdx = 1; rIdx < rows; rIdx++) {
    const y = y0 + rIdx * cellH;
    const h = new Line([x0, y, x0 + tableW, y], {
      stroke: 'rgba(255,255,255,0.14)',
      strokeWidth: 1,
      selectable: false,
      evented: false,
      originX: 'center',
      originY: 'center',
    });
    children.push(h);
  }

  // Cell text (editable). We store `cellIndex` so serialization can be stable.
  for (let rIdx = 0; rIdx < rows; rIdx++) {
    for (let cIdx = 0; cIdx < cols; cIdx++) {
      const idx = rIdx * cols + cIdx;
      const tx = x0 + cIdx * cellW + cellW / 2;
      const ty = y0 + rIdx * cellH + cellH / 2;

      const t = new Textbox(cells[idx] ?? '', {
        width: cellW - 14,
        fontSize: 14,
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        fill: '#f3f4f6',
        textAlign: 'center',
        editable: true,
        originX: 'center',
        originY: 'center',
        left: tx,
        top: ty,
      });
      t.set('cellIndex', idx);
      children.push(t);
    }
  }

  const group = new Group(children, {
    subTargetCheck: true,
    objectCaching: false,
  });
  group.set('id', randomId('table'));
  group.set('table', { rows, cols });
  group.setControlsVisibility({ mtr: true });
  setObjectCenter(c, group);
  return group;
}
