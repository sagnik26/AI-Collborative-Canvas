import { Circle, Group, Line, Rect, Shadow, Textbox } from 'fabric';
import type { FabricObject } from 'fabric';
import type { TemplateId, TemplateSlot, TemplateSlotComponentKind } from '../types/template';
import { fabricFillForSlot } from '../libs/template/renderTemplate.ts';
import {
  borderColorForTemplateSlot,
  TEMPLATE_DESIGN_TOKENS,
  textColorForTemplateSlot,
  typeTokenForSlot,
} from './templateDesignTokens.ts';
import type { TemplateFabricViewLayout } from '../libs/template/templateFabricViewLayout.ts';

const TOKENS = TEMPLATE_DESIGN_TOKENS;
const FONT = TOKENS.fontFamily;
const TEXT_PRIMARY = TOKENS.colors.textStrong;

function scaledFont(base: number, s: number) {
  return Math.max(10, Math.round(base * s));
}

function scaledSpace(base: number, s: number) {
  return Math.max(2, Math.round(base * s));
}

function scaledRadius(base: number, s: number) {
  return Math.max(4, Math.round(base * s));
}

function shadowFromToken(
  token: (typeof TOKENS.shadow)['none' | 'low' | 'medium'],
  s: number,
) {
  if (!token) return undefined;
  return new Shadow({
    color: token.color,
    blur: Math.max(1, Math.round(token.blur * s)),
    offsetX: Math.round(token.offsetX * s),
    offsetY: Math.round(token.offsetY * s),
  });
}

function textStyleForSlot(slot: TemplateSlot, s: number, templateId?: TemplateId) {
  const token = typeTokenForSlot(slot.id, templateId);
  const fontFamily =
    templateId === 'landing.v1' && slot.id === 'slot:hero:headline'
      ? '"Manrope", Inter, system-ui, sans-serif'
      : FONT;
  return {
    fontSize: scaledFont(token.size, s),
    fontWeight: token.weight,
    fill: textColorForTemplateSlot(slot.id, templateId),
    lineHeight: token.lineHeight,
    fontFamily,
  };
}

function markSlotObject(obj: FabricObject, slot: TemplateSlot) {
  obj.set('id', slot.id);
  obj.set('data', { slotId: slot.id, slotType: slot.type, componentKind: slot.componentKind });
}

function buildComponentText(
  value: string,
  opts: {
    width: number;
    height: number;
    left: number;
    top: number;
    fontSize: number;
    fontWeight: number;
    fill: string;
    lineHeight: number;
    textAlign?: 'left' | 'center' | 'right' | 'justify' | 'justify-left' | 'justify-center' | 'justify-right';
    editable?: boolean;
    role?: 'content' | 'static';
  },
) {
  const text = new Textbox(value, {
    width: opts.width,
    height: opts.height,
    left: opts.left,
    top: opts.top,
    fontSize: opts.fontSize,
    fontFamily: FONT,
    fill: opts.fill,
    fontWeight: opts.fontWeight,
    lineHeight: opts.lineHeight,
    textAlign: opts.textAlign ?? 'left',
    editable: opts.editable ?? false,
    originX: 'left',
    originY: 'top',
  });
  text.set('data', { textRole: opts.role ?? 'static' });
  return text;
}

function asGroup(
  slot: TemplateSlot,
  children: FabricObject[],
  absoluteX: number,
  absoluteY: number,
) {
  const group = new Group(children, {
    left: absoluteX,
    top: absoluteY,
    originX: 'center',
    originY: 'center',
    subTargetCheck: true,
    objectCaching: false,
  });
  group.setControlsVisibility({ mtr: true });
  markSlotObject(group, slot);
  return group;
}

function renderKpiCard(
  slot: TemplateSlot,
  display: string,
  x0: number,
  y0: number,
  w: number,
  h: number,
  s: number,
  absoluteX: number,
  absoluteY: number,
) {
  const pad = scaledSpace(TOKENS.spacing.lg, s);
  const card = new Rect({
    width: w,
    height: h,
    fill: TOKENS.colors.surface,
    stroke: TOKENS.colors.border,
    strokeWidth: 1,
    rx: scaledRadius(TOKENS.radius.lg, s),
    ry: scaledRadius(TOKENS.radius.lg, s),
    originX: 'left',
    originY: 'top',
    left: x0,
    top: y0,
    shadow: shadowFromToken(TOKENS.shadow.low, s),
  });
  const content = buildComponentText(display, {
    width: Math.max(24, w - pad * 2),
    height: Math.max(18, h - pad * 2),
    left: x0 + pad,
    top: y0 + pad,
    fontSize: scaledFont(TOKENS.typeRamp.h2.size, s),
    fontWeight: TOKENS.typeRamp.h2.weight,
    fill: TOKENS.colors.textStrong,
    lineHeight: TOKENS.typeRamp.h2.lineHeight,
    editable: true,
    role: 'content',
  });
  return asGroup(slot, [card, content], absoluteX, absoluteY);
}

function renderNavItem(
  slot: TemplateSlot,
  display: string,
  x0: number,
  y0: number,
  w: number,
  h: number,
  s: number,
  absoluteX: number,
  absoluteY: number,
) {
  const lineY = y0 + h - scaledSpace(3, s);
  const item = buildComponentText(display, {
    width: w,
    height: h,
    left: x0,
    top: y0,
    fontSize: scaledFont(TOKENS.typeRamp.caption.size, s),
    fontWeight: TOKENS.typeRamp.caption.weight,
    fill: TOKENS.colors.textMuted,
    lineHeight: TOKENS.typeRamp.caption.lineHeight,
    editable: true,
    role: 'content',
  });
  const underline = new Line([x0, lineY, x0 + w, lineY], {
    stroke: TOKENS.colors.border,
    strokeWidth: Math.max(1, Math.round(s)),
    selectable: false,
  });
  return asGroup(slot, [underline, item], absoluteX, absoluteY);
}

function renderTopTab(
  slot: TemplateSlot,
  display: string,
  x0: number,
  y0: number,
  w: number,
  h: number,
  s: number,
  absoluteX: number,
  absoluteY: number,
) {
  const tab = new Rect({
    width: w,
    height: h,
    fill: TOKENS.colors.surfaceAlt,
    stroke: TOKENS.colors.border,
    strokeWidth: 1,
    rx: scaledRadius(TOKENS.radius.md, s),
    ry: scaledRadius(TOKENS.radius.md, s),
    originX: 'left',
    originY: 'top',
    left: x0,
    top: y0,
  });
  const label = buildComponentText(display, {
    width: Math.max(20, w - scaledSpace(TOKENS.spacing.lg, s)),
    height: h,
    left: x0 + scaledSpace(TOKENS.spacing.sm, s),
    top: y0 + scaledSpace(TOKENS.spacing.xs, s),
    fontSize: scaledFont(TOKENS.typeRamp.caption.size, s),
    fontWeight: 700,
    fill: TOKENS.colors.textStrong,
    lineHeight: TOKENS.typeRamp.caption.lineHeight,
    editable: true,
    role: 'content',
  });
  return asGroup(slot, [tab, label], absoluteX, absoluteY);
}

function renderStatChip(
  slot: TemplateSlot,
  display: string,
  x0: number,
  y0: number,
  w: number,
  h: number,
  s: number,
  absoluteX: number,
  absoluteY: number,
) {
  const chip = new Rect({
    width: w,
    height: h,
    fill: TOKENS.colors.primary,
    stroke: TOKENS.colorVariants.transparent,
    strokeWidth: 0,
    rx: h / 2,
    ry: h / 2,
    originX: 'left',
    originY: 'top',
    left: x0,
    top: y0,
    shadow: shadowFromToken(TOKENS.shadow.low, s),
  });
  const label = buildComponentText(display, {
    width: Math.max(20, w - scaledSpace(TOKENS.spacing.xl, s)),
    height: h,
    left: x0 + scaledSpace(TOKENS.spacing.sm, s),
    top: y0 + scaledSpace(TOKENS.spacing.xs, s),
    fontSize: scaledFont(TOKENS.typeRamp.caption.size, s),
    fontWeight: 700,
    fill: TOKENS.colorVariants.textOnStrong,
    lineHeight: TOKENS.typeRamp.caption.lineHeight,
    textAlign: 'center',
    editable: true,
    role: 'content',
  });
  return asGroup(slot, [chip, label], absoluteX, absoluteY);
}

function renderInfoListItem(
  slot: TemplateSlot,
  display: string,
  x0: number,
  y0: number,
  w: number,
  h: number,
  s: number,
  absoluteX: number,
  absoluteY: number,
) {
  const row = new Rect({
    width: w,
    height: h,
    fill: TOKENS.colors.surface,
    stroke: TOKENS.colors.border,
    strokeWidth: 1,
    rx: scaledRadius(TOKENS.radius.sm, s),
    ry: scaledRadius(TOKENS.radius.sm, s),
    originX: 'left',
    originY: 'top',
    left: x0,
    top: y0,
  });
  const bulletR = Math.max(2, Math.round(3 * s));
  const bullet = new Circle({
    radius: bulletR,
    fill: TOKENS.colors.accent,
    left: x0 + scaledSpace(TOKENS.spacing.md, s),
    top: y0 + h / 2,
    originX: 'center',
    originY: 'center',
    selectable: false,
  });
  const label = buildComponentText(display, {
    width: Math.max(24, w - scaledSpace(28, s)),
    height: h - scaledSpace(4, s),
    left: x0 + scaledSpace(TOKENS.spacing.xxl, s),
    top: y0 + scaledSpace(TOKENS.spacing.xs, s),
    fontSize: scaledFont(TOKENS.typeRamp.body.size, s),
    fontWeight: TOKENS.typeRamp.body.weight,
    fill: TOKENS.colors.textStrong,
    lineHeight: TOKENS.typeRamp.body.lineHeight,
    editable: true,
    role: 'content',
  });
  return asGroup(slot, [row, bullet, label], absoluteX, absoluteY);
}

function renderQuoteCard(
  slot: TemplateSlot,
  display: string,
  x0: number,
  y0: number,
  w: number,
  h: number,
  s: number,
  absoluteX: number,
  absoluteY: number,
) {
  const card = new Rect({
    width: w,
    height: h,
    fill: TOKENS.colors.surfaceAlt,
    stroke: TOKENS.colors.border,
    strokeWidth: 1,
    rx: scaledRadius(TOKENS.radius.lg, s),
    ry: scaledRadius(TOKENS.radius.lg, s),
    originX: 'left',
    originY: 'top',
    left: x0,
    top: y0,
  });
  const rail = new Rect({
    width: Math.max(3, Math.round(4 * s)),
    height: Math.max(16, h - scaledSpace(16, s)),
    fill: TOKENS.colors.accent,
    originX: 'left',
    originY: 'top',
    left: x0 + scaledSpace(TOKENS.spacing.sm, s),
    top: y0 + scaledSpace(TOKENS.spacing.sm, s),
    rx: 2,
    ry: 2,
    selectable: false,
  });
  const quote = buildComponentText(display, {
    width: Math.max(20, w - scaledSpace(40, s)),
    height: Math.max(16, h - scaledSpace(16, s)),
    left: x0 + scaledSpace(TOKENS.spacing.xxl, s),
    top: y0 + scaledSpace(TOKENS.spacing.sm, s),
    fontSize: scaledFont(TOKENS.typeRamp.body.size, s),
    fontWeight: 600,
    fill: TOKENS.colors.textStrong,
    lineHeight: TOKENS.typeRamp.body.lineHeight,
    editable: true,
    role: 'content',
  });
  return asGroup(slot, [card, rail, quote], absoluteX, absoluteY);
}

function renderFooterMeta(
  slot: TemplateSlot,
  display: string,
  x0: number,
  y0: number,
  w: number,
  h: number,
  s: number,
  absoluteX: number,
  absoluteY: number,
) {
  const marker = new Circle({
    radius: Math.max(2, Math.round(2.5 * s)),
    fill: TOKENS.colors.muted,
    left: x0 + scaledSpace(TOKENS.spacing.sm, s),
    top: y0 + h / 2,
    originX: 'center',
    originY: 'center',
    selectable: false,
  });
  const text = buildComponentText(display, {
    width: Math.max(20, w - scaledSpace(20, s)),
    height: h,
    left: x0 + scaledSpace(TOKENS.spacing.lg, s),
    top: y0,
    fontSize: scaledFont(TOKENS.typeRamp.meta.size, s),
    fontWeight: TOKENS.typeRamp.meta.weight,
    fill: TOKENS.colors.textMuted,
    lineHeight: TOKENS.typeRamp.meta.lineHeight,
    editable: true,
    role: 'content',
  });
  return asGroup(slot, [marker, text], absoluteX, absoluteY);
}

function renderBarChartPanel(
  slot: TemplateSlot,
  display: string,
  x0: number,
  y0: number,
  w: number,
  h: number,
  s: number,
  absoluteX: number,
  absoluteY: number,
) {
  const pad = scaledSpace(TOKENS.spacing.lg, s);
  const panel = new Rect({
    width: w,
    height: h,
    fill: TOKENS.colors.surface,
    stroke: TOKENS.colors.border,
    strokeWidth: 1,
    rx: scaledRadius(TOKENS.radius.xl, s),
    ry: scaledRadius(TOKENS.radius.xl, s),
    originX: 'left',
    originY: 'top',
    left: x0,
    top: y0,
    shadow: shadowFromToken(TOKENS.shadow.low, s),
  });
  const label = buildComponentText(display, {
    width: Math.max(20, w - pad * 2),
    height: Math.max(16, scaledSpace(24, s)),
    left: x0 + pad,
    top: y0 + pad,
    fontSize: scaledFont(TOKENS.typeRamp.caption.size, s),
    fontWeight: TOKENS.typeRamp.caption.weight,
    fill: TOKENS.colors.textMuted,
    lineHeight: TOKENS.typeRamp.caption.lineHeight,
    editable: true,
    role: 'content',
  });

  const barsLeft = x0 + pad;
  const barsBottom = y0 + h - pad;
  const barGap = scaledSpace(TOKENS.spacing.sm, s);
  const chartAreaHeight = Math.max(24, h - pad * 3 - scaledSpace(18, s));
  const barWidth = Math.max(4, Math.floor((w - pad * 2 - barGap * 3) / 4));
  const barRatios = [0.38, 0.56, 0.72, 0.9];
  const bars = barRatios.map(
    (ratio, index) =>
      new Rect({
        width: barWidth,
        height: Math.max(4, Math.round(chartAreaHeight * ratio)),
        fill: index === barRatios.length - 1 ? TOKENS.colors.accent : TOKENS.colors.primary,
        originX: 'left',
        originY: 'bottom',
        left: barsLeft + index * (barWidth + barGap),
        top: barsBottom,
        rx: 2,
        ry: 2,
        selectable: false,
      }),
  );

  return asGroup(slot, [panel, label, ...bars], absoluteX, absoluteY);
}

function renderSparkline(
  slot: TemplateSlot,
  x0: number,
  y0: number,
  w: number,
  h: number,
  absoluteX: number,
  absoluteY: number,
) {
  const points = [0.08, 0.42, 0.36, 0.74, 0.58, 0.9];
  const step = w / (points.length - 1);
  const lines: FabricObject[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const x1 = x0 + step * i;
    const y1 = y0 + h - points[i] * h;
    const x2 = x0 + step * (i + 1);
    const y2 = y0 + h - points[i + 1] * h;
    lines.push(
      new Line([x1, y1, x2, y2], {
        stroke: TOKENS.colors.accent,
        strokeWidth: 2,
        strokeLineCap: 'round',
        selectable: false,
      }),
    );
  }
  return asGroup(slot, lines, absoluteX, absoluteY);
}

function renderSemanticComponent(
  slot: TemplateSlot,
  display: string,
  x0: number,
  y0: number,
  w: number,
  h: number,
  s: number,
  absoluteX: number,
  absoluteY: number,
) {
  const kind = slot.componentKind as TemplateSlotComponentKind;
  if (kind === 'kpiCard') return renderKpiCard(slot, display, x0, y0, w, h, s, absoluteX, absoluteY);
  if (kind === 'navItem') return renderNavItem(slot, display, x0, y0, w, h, s, absoluteX, absoluteY);
  if (kind === 'topTab') return renderTopTab(slot, display, x0, y0, w, h, s, absoluteX, absoluteY);
  if (kind === 'statChip') return renderStatChip(slot, display, x0, y0, w, h, s, absoluteX, absoluteY);
  if (kind === 'infoListItem') {
    return renderInfoListItem(slot, display, x0, y0, w, h, s, absoluteX, absoluteY);
  }
  if (kind === 'quoteCard') return renderQuoteCard(slot, display, x0, y0, w, h, s, absoluteX, absoluteY);
  if (kind === 'footerMeta') return renderFooterMeta(slot, display, x0, y0, w, h, s, absoluteX, absoluteY);
  if (kind === 'barChartPanel') {
    return renderBarChartPanel(slot, display, x0, y0, w, h, s, absoluteX, absoluteY);
  }
  if (kind === 'sparkline') return renderSparkline(slot, x0, y0, w, h, absoluteX, absoluteY);
  return null;
}

/**
 * Maps a template slot (+ optional field text) to an editable Fabric object in page space.
 * `pageX` / `pageY` are the artboard top-left; `layout` maps design coordinates into the A4 view.
 */
export function slotToFabricObject(
  slot: TemplateSlot,
  text: string | null,
  pageX: number,
  pageY: number,
  layout: TemplateFabricViewLayout,
  templateId?: TemplateId,
): FabricObject {
  const { s, padX, padY } = layout;
  const x0 = pageX + padX + slot.x * s;
  const y0 = pageY + padY + slot.y * s;
  const w = slot.w * s;
  const h = slot.h * s;
  const absoluteX = x0 + w / 2;
  const absoluteY = y0 + h / 2;
  const display = text ?? '';

  if (slot.componentKind) {
    const semantic = renderSemanticComponent(slot, display, x0, y0, w, h, s, absoluteX, absoluteY);
    if (semantic) return semantic;
  }

  if (slot.type === 'connector') {
    const line = new Line(
      [x0, y0 + h / 2, x0 + w, y0 + h / 2],
      {
        stroke: fabricFillForSlot(slot, templateId),
        strokeWidth: Math.max(2, h),
        strokeLineCap: 'round',
        selectable: true,
      },
    );
    markSlotObject(line, slot);
    return line;
  }

  if (slot.type === 'text') {
    const style = textStyleForSlot(slot, s, templateId);
    const textbox = new Textbox(display, {
      left: x0,
      top: y0,
      width: w,
      height: h,
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      fill: style.fill,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      editable: true,
      originX: 'left',
      originY: 'top',
    });
    markSlotObject(textbox, slot);
    return textbox;
  }

  const bgColor = fabricFillForSlot(slot, templateId);
  const isPill = slot.type === 'pill';
  const isLogo = slot.type === 'logo';
  const isCta = slot.type === 'cta' || slot.id === 'slot:final:cta';

  const rectStroke = borderColorForTemplateSlot(slot, templateId);

  const rect = new Rect({
    width: w,
    height: h,
    fill: bgColor,
    rx: isPill ? h / 2 : scaledRadius(TOKENS.radius.md, s),
    ry: isPill ? h / 2 : scaledRadius(TOKENS.radius.md, s),
    stroke: rectStroke,
    strokeWidth: 1,
    originX: 'center',
    originY: 'center',
    shadow:
      isCta || isPill || isLogo
        ? shadowFromToken(isCta ? TOKENS.shadow.medium : TOKENS.shadow.low, s)
        : undefined,
  });

  const labelFill =
    templateId === 'landing.v1' && slot.id === 'slot:final:cta'
      ? '#003178'
      : isCta || isPill
      ? TOKENS.colorVariants.textOnStrong
      : isLogo
        ? TOKENS.colors.textMuted
        : TEXT_PRIMARY;

  const label = new Textbox(display, {
    width: Math.max(40, w - 16 * s),
    height: Math.max(16, h - 10 * s),
    fontSize: scaledFont(isLogo ? 13 : isCta ? 14 : 15, s),
    fontFamily: FONT,
    fill: labelFill,
    fontWeight: isLogo ? 600 : 700,
    textAlign: 'center',
    lineHeight: 1.15,
    editable: true,
    originX: 'center',
    originY: 'center',
  });

  const group = new Group([rect, label], {
    left: absoluteX,
    top: absoluteY,
    originX: 'center',
    originY: 'center',
    subTargetCheck: true,
    objectCaching: false,
  });
  markSlotObject(group, slot);
  group.setControlsVisibility({ mtr: true });
  return group;
}
