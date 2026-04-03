import type { LayoutCreate } from './layout.js';

/** Matches frontend `CanvasObjectRecord` (plain JSON in Y.Map). */
export type CanvasRecord = {
  kind: LayoutCreate['kind'];
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  fill?: string;
  text?: string;
  fontSize?: number;
  line?: { x1: number; y1: number; x2: number; y2: number };
};

