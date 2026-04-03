import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { Canvas } from 'fabric';
import type { Canvas as FabricCanvasType } from 'fabric';
import type { FabricCanvasProps } from '../types/fabric';

export function FabricCanvas({
  className,
  backgroundColor = '#0b1020',
  skipOffscreen = true,
  width,
  height,
  onReady,
  onBeforeDispose,
}: FabricCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<FabricCanvasType | null>(null);

  const reactId = useId();
  const canvasId = `fabric-canvas-${reactId}`;

  useLayoutEffect(() => {
    const el = canvasElRef.current;
    if (!el) return;

    const c = new Canvas(el, {
      preserveObjectStacking: true,
      selection: true,
      subTargetCheck: true,
    });
    fabricCanvasRef.current = c;

    // Must run before onReady: otherwise canvas.width/height can be stale vs props and layout math breaks.
    c.setDimensions({ width, height });
    c.calcOffset();

    // Basic defaults for UX.
    c.backgroundColor = backgroundColor;
    // Make it easier to grab/drag groups and thin strokes (line/arrow).
    (c as unknown as { targetFindTolerance?: number }).targetFindTolerance = 12;
    c.renderOnAddRemove = true;
    c.skipOffscreen = skipOffscreen;
    c.requestRenderAll();

    onReady?.(c);

    return () => {
      onBeforeDispose?.(c);
      fabricCanvasRef.current = null;
      c.dispose();
    };
    // Intentionally use width/height only from mount: resize is handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial dimensions before onReady
  }, [onReady, onBeforeDispose, skipOffscreen]);

  useEffect(() => {
    const c = fabricCanvasRef.current;
    if (!c) return;
    c.setDimensions({ width, height });
    c.calcOffset();
    c.requestRenderAll();
  }, [width, height]);

  return (
    <canvas
      id={canvasId}
      ref={canvasElRef}
      className={className}
      width={width}
      height={height}
    />
  );
}
