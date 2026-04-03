export type LayoutMove = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutCreate = {
  kind: 'rect' | 'circle' | 'text' | 'line' | 'arrow';
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  fill: string;
};

