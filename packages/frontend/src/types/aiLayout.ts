export type AiLayoutElement = {
  id: string;
  type: 'rect' | 'text' | 'circle' | 'image' | 'line' | 'arrow';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  rotation: number;
  zIndex: number;
};

export type AiLayoutRequest = {
  roomId: string;
  elements: AiLayoutElement[];
  instruction: string;
  canvasWidth: number;
  canvasHeight: number;
  doc?: string;
  mapName?: string;
};

export type AiLayoutResponse = {
  elements: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  creates: Array<{
    kind: 'rect' | 'circle' | 'text' | 'line' | 'arrow';
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    fill: string;
  }>;
  reasoning: string;
};

