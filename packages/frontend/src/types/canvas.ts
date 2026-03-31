export type CanvasObjectKind = 'rect' | 'circle' | 'text' | 'line' | 'arrow';

export type CanvasObjectRecord = {
  kind: CanvasObjectKind;
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

export type ToolId = CanvasObjectKind | 'select';
