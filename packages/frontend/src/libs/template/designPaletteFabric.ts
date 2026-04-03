import type { Canvas as FabricCanvasType, FabricObject } from 'fabric';
import type { CanvasObjectKind } from '../../types/canvas';
import {
  createLabeledCircle,
  createLabeledRect,
  createTable,
  createText,
} from '../canvas/fabricFactories.ts';

export { isDesignPaletteFabricObject } from '../canvas/fabricRecords.ts';

function randomDesignId() {
  return `design-${Math.random().toString(36).slice(2, 12)}`;
}

export function positionObjectAtScene(obj: FabricObject, x: number, y: number) {
  obj.set({ left: x, top: y, originX: 'center', originY: 'center' });
  obj.setCoords();
}

export function createDesignPaletteObject(
  canvas: FabricCanvasType,
  kind: CanvasObjectKind,
  sceneX: number,
  sceneY: number,
): FabricObject {
  let obj: FabricObject;
  switch (kind) {
    case 'rect':
      obj = createLabeledRect(canvas);
      break;
    case 'circle':
      obj = createLabeledCircle(canvas);
      break;
    case 'text':
      obj = createText(canvas);
      break;
    case 'table':
      obj = createTable(canvas);
      break;
    default:
      obj = createText(canvas);
  }
  obj.set('id', randomDesignId());
  obj.set('data', { source: 'designPalette', canvasKind: kind });
  positionObjectAtScene(obj, sceneX, sceneY);
  return obj;
}

export const DESIGN_PALETTE_ITEMS: ReadonlyArray<{
  kind: CanvasObjectKind;
  label: string;
  hint: string;
}> = [
  { kind: 'rect', label: 'Rectangle', hint: 'Labeled card' },
  { kind: 'circle', label: 'Circle', hint: 'Labeled circle' },
  { kind: 'text', label: 'Text', hint: 'Editable text' },
  { kind: 'table', label: 'Table', hint: '3×3 grid' },
];

export const DESIGN_DRAG_MIME = 'application/x-template-design-kind';
