import type { Canvas as FabricCanvasType, FabricObject } from 'fabric';

export function nudgeViewportToKeepObjectsVisible(opts: {
  canvas: FabricCanvasType;
  viewportWidth: number;
  viewportHeight: number;
  margin?: number;
}) {
  const { canvas: c, viewportWidth: w, viewportHeight: h, margin = 18 } = opts;
  const objs = c.getObjects() as FabricObject[];
  if (objs.length === 0) return;

  const bounds = objs.reduce(
    (acc, o) => {
      const r = o.getBoundingRect();
      const left = r.left;
      const top = r.top;
      const right = r.left + r.width;
      const bottom = r.top + r.height;
      return {
        minX: Math.min(acc.minX, left),
        minY: Math.min(acc.minY, top),
        maxX: Math.max(acc.maxX, right),
        maxY: Math.max(acc.maxY, bottom),
      };
    },
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );

  // Only pan (no zoom) to keep content within the viewport.
  const vt = (c.viewportTransform ?? [1, 0, 0, 1, 0, 0]).slice() as number[];
  const zoom = typeof c.getZoom === 'function' ? c.getZoom() : 1;
  const viewMinX = -vt[4] / zoom;
  const viewMinY = -vt[5] / zoom;
  const viewMaxX = viewMinX + w / zoom;
  const viewMaxY = viewMinY + h / zoom;

  let dx = 0;
  let dy = 0;

  if (bounds.maxX > viewMaxX - margin) dx = bounds.maxX - (viewMaxX - margin);
  if (bounds.minX < viewMinX + margin) dx = bounds.minX - (viewMinX + margin);
  if (bounds.maxY > viewMaxY - margin) dy = bounds.maxY - (viewMaxY - margin);
  if (bounds.minY < viewMinY + margin) dy = bounds.minY - (viewMinY + margin);

  if (dx !== 0 || dy !== 0) {
    vt[4] -= dx * zoom;
    vt[5] -= dy * zoom;
    c.setViewportTransform(vt as [number, number, number, number, number, number]);
    c.requestRenderAll();
  }
}

