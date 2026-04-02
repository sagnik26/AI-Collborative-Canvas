import type { CanvasShapeKind } from '../types/canvasTheme.js';

function isDefaultBlack(fill: string) {
  const f = fill.trim().toLowerCase();
  return (
    f === '#000' ||
    f === '#000000' ||
    f === 'black' ||
    f === 'rgb(0,0,0)' ||
    f === 'rgb(0, 0, 0)' ||
    f === 'rgba(0,0,0,1)' ||
    f === 'rgba(0, 0, 0, 1)' ||
    f === 'rgba(0,0,0,1.0)' ||
    f === 'rgba(0, 0, 0, 1.0)'
  );
}

function isDefaultWhite(fill: string) {
  const f = fill.trim().toLowerCase();
  return (
    f === '#fff' ||
    f === '#ffffff' ||
    f === '#f3f4f6' ||
    f === 'white' ||
    f === 'rgb(255,255,255)' ||
    f === 'rgb(255, 255, 255)' ||
    f === 'rgba(255,255,255,1)' ||
    f === 'rgba(255, 255, 255, 1)' ||
    f === 'rgba(255,255,255,1.0)' ||
    f === 'rgba(255, 255, 255, 1.0)'
  );
}

function parseRgb(
  fill: string,
): { r: number; g: number; b: number; a: number } | null {
  const f = fill.trim().toLowerCase();
  const m =
    f.match(
      /^rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})(?:\s*,\s*([0-9]*\.?[0-9]+))?\s*\)$/,
    ) ?? null;
  if (!m) return null;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const a = m[4] === undefined ? 1 : Number(m[4]);
  if ([r, g, b, a].some((n) => Number.isNaN(n))) return null;
  if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) return null;
  if (a < 0 || a > 1) return null;
  return { r, g, b, a };
}

function parseHex(
  fill: string,
): { r: number; g: number; b: number; a: number } | null {
  const f = fill.trim().toLowerCase();
  const m = f.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!m) return null;
  const hex = m[1];
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return { r, g, b, a: 1 };
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return { r, g, b, a: 1 };
}

function isTransparent(fill: string) {
  const f = fill.trim().toLowerCase();
  if (f === 'transparent') return true;
  const rgb = parseRgb(f);
  return rgb ? rgb.a === 0 : false;
}

function relativeLuminance(rgb: { r: number; g: number; b: number }) {
  const srgb = [rgb.r, rgb.g, rgb.b].map((v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function isVeryLight(fill: string) {
  const rgb = parseHex(fill) ?? parseRgb(fill);
  if (!rgb) return false;
  // Consider even semi-transparent whites as "light" for defaulting.
  if (rgb.a < 0.25) return true;
  return relativeLuminance(rgb) >= 0.92;
}

function defaultFillForKind(kind: CanvasShapeKind) {
  // Keep defaults aligned with frontend `fabricFactories.ts`.
  switch (kind) {
    case 'rect':
      return '#6d28d9';
    case 'circle':
      return '#0ea5e9';
    case 'text':
      return '#f3f4f6';
    case 'line':
      return 'rgba(255,255,255,0.75)';
    case 'arrow':
      return 'rgba(255,255,255,0.8)';
    default:
      return '#6d28d9';
  }
}

export function normalizeCreateFill(
  kind: CanvasShapeKind,
  fill: string,
  opts?: { strictTheme?: boolean },
) {
  const strictTheme = opts?.strictTheme ?? true;

  // Strict mode: always match manual toolbar defaults for non-text shapes.
  // (Text fill default is already the intended theme color.)
  if (strictTheme && kind !== 'text') return defaultFillForKind(kind);

  const cleaned = typeof fill === 'string' ? fill.trim() : '';
  if (!cleaned) return defaultFillForKind(kind);
  if (isDefaultBlack(cleaned)) return defaultFillForKind(kind);
  // Models often default to "white" for shapes; keep parity with manual tools.
  // (Text default is already a light color, so leaving it is fine.)
  if (
    (kind === 'rect' || kind === 'circle' || kind === 'line' || kind === 'arrow') &&
    (isDefaultWhite(cleaned) || isVeryLight(cleaned) || isTransparent(cleaned))
  ) {
    return defaultFillForKind(kind);
  }
  return cleaned;
}

