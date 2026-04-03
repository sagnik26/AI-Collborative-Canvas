export type CanvasObjectKind =
  | 'rect'
  | 'circle'
  | 'text'
  | 'line'
  | 'arrow'
  | 'table';

export type CanvasObjectRecord = {
  kind: CanvasObjectKind;
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  /** When set, `left`/`top` are relative to the template page origin (not scene / pasteboard). */
  coordSpace?: 'page';
  fill?: string;
  text?: string;
  fontSize?: number;
  line?: { x1: number; y1: number; x2: number; y2: number };
  table?: { rows: number; cols: number; cells: string[] };
};

export type ToolId = CanvasObjectKind | 'select';
