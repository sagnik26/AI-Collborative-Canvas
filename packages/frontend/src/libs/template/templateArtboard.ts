import { Rect, Shadow } from 'fabric';
import type { Canvas as FabricCanvasType, FabricObject } from 'fabric';
import { A4_BASE_HEIGHT, A4_BASE_WIDTH } from '../../constants/templateEditor.ts';
import { getObjectId } from '../canvas/fabricRecords.ts';

export const TEMPLATE_ARTBOARD_ID = '__artboard__';

export type TemplateArtboardColors = {
  pasteboard: string;
  page: string;
};

/** Pasteboard vs page must contrast clearly — otherwise the portrait “paper” reads as missing. */
export const DEFAULT_TEMPLATE_ARTBOARD_COLORS: TemplateArtboardColors = {
  pasteboard: '#09090b',
  /** Light “paper” so the A4 frame is obvious against the dark chrome. */
  page: '#f4f4f5',
};

export function isTemplateArtboardObject(obj: FabricObject): boolean {
  if (getObjectId(obj) === TEMPLATE_ARTBOARD_ID) return true;
  const data = (obj as unknown as { get?: (k: string) => unknown }).get?.('data') as
    | { type?: unknown }
    | undefined;
  return data?.type === 'artboard';
}

export function isTemplateSlotFabricObject(obj: FabricObject): boolean {
  const data = (obj as unknown as { get?: (k: string) => unknown }).get?.('data') as
    | { slotId?: unknown }
    | undefined;
  return typeof data?.slotId === 'string';
}

/**
 * Dark pasteboard + light “paper” rect at index 0. Returns the top-left of the page in canvas coordinates.
 */
export function setupTemplateArtboard(
  canvas: FabricCanvasType,
  colors: TemplateArtboardColors = DEFAULT_TEMPLATE_ARTBOARD_COLORS,
  pageSize: { width: number; height: number } = {
    width: A4_BASE_WIDTH,
    height: A4_BASE_HEIGHT,
  },
): { pageX: number; pageY: number } {
  canvas.backgroundColor = colors.pasteboard;

  const PAGE_W = pageSize.width;
  const PAGE_H = pageSize.height;
  const cw = typeof canvas.width === 'number' ? canvas.width : 0;
  const ch = typeof canvas.height === 'number' ? canvas.height : 0;
  const pageX = (cw - PAGE_W) / 2;
  const pageY = (ch - PAGE_H) / 2;

  const existing = canvas.backgroundImage;
  const existingData = (
    existing as unknown as { get?: (k: string) => unknown } | undefined
  )?.get?.('data') as { type?: unknown } | undefined;
  if (existing && existingData?.type === 'artboard') {
    existing.set({
      left: pageX,
      top: pageY,
      width: PAGE_W,
      height: PAGE_H,
      originX: 'left',
      originY: 'top',
      fill: colors.page,
    });
    existing.setCoords();
  } else {
    const artboard = new Rect({
      left: pageX,
      top: pageY,
      width: PAGE_W,
      height: PAGE_H,
      /** FabricObject defaults to center origin; page math + slots use top-left of the sheet. */
      originX: 'left',
      originY: 'top',
      fill: colors.page,
      stroke: 'rgba(0,0,0,0.1)',
      strokeWidth: 1,
      objectCaching: false,
      selectable: false,
      evented: false,
      hoverCursor: 'default',
      shadow: new Shadow({
        color: 'rgba(0,0,0,0.18)',
        blur: 24,
        offsetX: 0,
        offsetY: 8,
      }),
    });
    artboard.set('id', TEMPLATE_ARTBOARD_ID);
    artboard.set('data', { type: 'artboard', locked: true });
    canvas.backgroundImage = artboard;
  }

  return { pageX, pageY };
}

/** Keep the page rect at the bottom of the stack so slot content paints on top. */
export function sendTemplateArtboardToBack(canvas: FabricCanvasType) {
  const artboard = canvas.backgroundImage;
  if (!artboard) return;
  artboard.setCoords();
}

/**
 * Uniform zoom + pan so the portrait A4 page rect fits inside the canvas bitmap.
 * Uses scene coordinates; call after {@link setupTemplateArtboard} and slot render.
 */
export function fitTemplatePageInViewport(
  canvas: FabricCanvasType,
  pageRect: { pageX: number; pageY: number; width: number; height: number },
  padding = 28,
) {
  const cw = typeof canvas.width === 'number' ? canvas.width : 0;
  const ch = typeof canvas.height === 'number' ? canvas.height : 0;
  if (cw < 32 || ch < 32) return;

  const { pageX, pageY, width: pageW, height: pageH } = pageRect;
  const innerW = Math.max(1, cw - padding * 2);
  const innerH = Math.max(1, ch - padding * 2);
  const z = Math.min(innerW / pageW, innerH / pageH, 1);

  const cx = pageX + pageW / 2;
  const cy = pageY + pageH / 2;
  const tx = cw / 2 - z * cx;
  const ty = ch / 2 - z * cy;

  canvas.setViewportTransform([z, 0, 0, z, tx, ty]);
  canvas.forEachObject((o) => {
    o.setCoords();
  });
  canvas.requestRenderAll();
}
