import type { Canvas as FabricCanvasType } from 'fabric';

export type FabricCanvasProps = {
  className?: string;
  /** Initial canvas bitmap background before host code runs (e.g. template artboard). */
  backgroundColor?: string;
  /**
   * When true (Fabric default), objects that fail `isOnScreen()` are not drawn.
   * Large artboard rects can be skipped incorrectly; template editor sets this to false.
   */
  skipOffscreen?: boolean;
  width: number;
  height: number;
  onReady?: (canvas: FabricCanvasType) => void;
  /** Runs before the canvas is disposed (tear down bindings that use this canvas). */
  onBeforeDispose?: (canvas: FabricCanvasType) => void;
};

