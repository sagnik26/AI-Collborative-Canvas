import { useEffect, useId, useRef } from 'react';
import { Canvas } from 'fabric';
import type { Canvas as FabricCanvasType } from 'fabric';

type FabricCanvasProps = {
  className?: string;
  width: number;
  height: number;
  onReady?: (canvas: FabricCanvasType) => void;
};

export function FabricCanvas({
  className,
  width,
  height,
  onReady,
}: FabricCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<FabricCanvasType | null>(null);

  const reactId = useId();
  const canvasId = `fabric-canvas-${reactId}`;

  useEffect(() => {
    const el = canvasElRef.current;
    if (!el) return;

    const c = new Canvas(el, {
      preserveObjectStacking: true,
      selection: true,
      subTargetCheck: true,
    });
    fabricCanvasRef.current = c;

    // Basic defaults for UX.
    c.backgroundColor = '#0b1020';
    // Make it easier to grab/drag groups and thin strokes (line/arrow).
    (c as unknown as { targetFindTolerance?: number }).targetFindTolerance = 12;
    c.renderOnAddRemove = true;
    c.requestRenderAll();

    onReady?.(c);

    return () => {
      fabricCanvasRef.current = null;
      c.dispose();
    };
  }, [onReady]);

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
