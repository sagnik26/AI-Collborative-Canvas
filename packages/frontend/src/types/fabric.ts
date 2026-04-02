import type { Canvas as FabricCanvasType } from 'fabric';

export type FabricCanvasProps = {
  className?: string;
  width: number;
  height: number;
  onReady?: (canvas: FabricCanvasType) => void;
};

