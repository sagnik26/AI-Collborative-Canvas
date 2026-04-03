import type { CanvasObjectRecord } from '../../types/canvas';
import type {
  TemplateFields,
  TemplateRenderDiagnostics,
  TemplateSchema,
  TemplateSlot,
  TemplateTheme,
} from '../../types/template';
import { TEMPLATE_RENDER_BASE_H, TEMPLATE_RENDER_BASE_W } from '../../constants/templateRender.ts';
import {
  canvasColorForTemplateSlot,
  fabricColorForTemplateSlot,
  typeTokenForSlot,
} from '../../Design System/templateDesignTokens.ts';

function clamp(min: number, v: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function scaleForSlot(slot: TemplateSlot) {
  if (slot.type === 'text') {
    return {
      scaleX: slot.w / TEMPLATE_RENDER_BASE_W.text,
      scaleY: slot.h / TEMPLATE_RENDER_BASE_H.text,
    };
  }
  if (slot.type === 'connector') {
    return {
      scaleX: slot.w / TEMPLATE_RENDER_BASE_W.line,
      scaleY: slot.h / TEMPLATE_RENDER_BASE_H.line,
    };
  }
  return {
    scaleX: slot.w / TEMPLATE_RENDER_BASE_W.rect,
    scaleY: slot.h / TEMPLATE_RENDER_BASE_H.rect,
  };
}

function fitText(slot: TemplateSlot, raw: string, diagnostics: TemplateRenderDiagnostics) {
  let out = raw;
  if (typeof slot.maxChars === 'number' && out.length > slot.maxChars) {
    diagnostics.overflowWarnings.push(`${slot.id}:maxChars`);
    if (slot.overflow === 'ellipsis' && slot.maxChars >= 1) {
      out = `${out.slice(0, Math.max(0, slot.maxChars - 1))}…`;
    } else {
      out = out.slice(0, slot.maxChars);
    }
  }

  if (typeof slot.maxLines === 'number') {
    const lines = out.split('\n');
    if (lines.length > slot.maxLines) {
      diagnostics.overflowWarnings.push(`${slot.id}:maxLines`);
      out = lines.slice(0, slot.maxLines).join('\n');
    }
  }
  return out;
}

function approxCharsPerLine(slot: TemplateSlot) {
  const baseFont = slot.type === 'logo' ? 14 : typeTokenForSlot(slot.id).size;
  const avgCharWidth = baseFont * 0.54;
  const usableWidth = Math.max(24, slot.w - 12);
  return Math.max(8, Math.floor(usableWidth / Math.max(6, avgCharWidth)));
}

/**
 * Fits slot text for Fabric rendering (no diagnostics), including wrapped-line estimation.
 */
export function fitSlotTextForCanvas(slot: TemplateSlot, raw: string): string {
  let out = raw;
  if (typeof slot.maxChars === 'number' && out.length > slot.maxChars) {
    if (slot.overflow === 'ellipsis' && slot.maxChars >= 1) {
      out = `${out.slice(0, Math.max(0, slot.maxChars - 1))}…`;
    } else {
      out = out.slice(0, slot.maxChars);
    }
  }

  if (typeof slot.maxLines === 'number' && slot.maxLines > 0) {
    const lines = out.split('\n');
    const maxByWrap = slot.maxLines * approxCharsPerLine(slot);
    if (out.length > maxByWrap) {
      const clipped = out.slice(0, Math.max(0, maxByWrap - 1));
      out = slot.overflow === 'wrap' ? clipped : `${clipped}…`;
    }
    if (lines.length > slot.maxLines) {
      out = lines.slice(0, slot.maxLines).join('\n');
    }
  }
  return out;
}

export function textForSlot(slotId: string, fields: TemplateFields): string | null {
  if (slotId === 'slot:hero:badge') return fields.heroBadge;
  if (slotId === 'slot:hero:headline') return fields.heroHeadline;
  if (slotId === 'slot:hero:subheadline') return fields.heroSubheadline;
  if (slotId === 'slot:hero:cta:primary') return fields.heroPrimaryCta;
  if (slotId === 'slot:hero:cta:secondary') return fields.heroSecondaryCta;
  if (slotId === 'slot:social:title') return fields.socialProofTitle;
  if (slotId.startsWith('slot:logo:')) {
    const index = Number(slotId.split(':')[2]) - 1;
    return fields.logos[index] ?? '';
  }
  if (slotId.startsWith('slot:steps:pill:')) {
    const index = Number(slotId.split(':')[3]) - 1;
    return fields.steps[index]?.title ?? '';
  }
  if (slotId.startsWith('slot:steps:desc:')) {
    const index = Number(slotId.split(':')[3]) - 1;
    return fields.steps[index]?.description ?? '';
  }
  if (slotId === 'slot:math:title') return fields.mathTitle;
  if (slotId === 'slot:math:formula') return fields.mathFormula;
  if (slotId === 'slot:math:footnote') return fields.mathFootnote;
  if (slotId === 'slot:final:headline') return fields.finalCtaHeadline;
  if (slotId === 'slot:final:cta') return fields.finalCtaLabel;
  return null;
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return '';
}

export function textForTemplateSlot(
  templateId: TemplateSchema['templateId'],
  slotId: string,
  fields: TemplateFields,
): string | null {
  if (templateId === 'landing.v1' && slotId === 'slot:math:title') return null;
  if (slotId === 'slot:hero:visual') {
    return firstNonEmpty(fields.mathTitle, fields.socialProofTitle, fields.heroHeadline);
  }
  if (slotId === 'slot:math:box') {
    return firstNonEmpty(fields.finalCtaHeadline, fields.heroSubheadline);
  }
  return textForSlot(slotId, fields);
}

export function colorForSlot(slot: TemplateSlot) {
  return canvasColorForTemplateSlot(slot);
}

/**
 * Fills/strokes for Fabric slots drawn on the light artboard (see {@link DEFAULT_TEMPLATE_ARTBOARD_COLORS.page}).
 */
export function fabricFillForSlot(
  slot: TemplateSlot,
  templateId?: TemplateSchema['templateId'],
  theme?: TemplateTheme,
) {
  return fabricColorForTemplateSlot(slot, templateId, theme);
}

export function renderTemplateWithDiagnostics(
  template: TemplateSchema,
  fields: TemplateFields,
): {
  records: CanvasObjectRecord[];
  diagnostics: TemplateRenderDiagnostics;
} {
  const diagnostics: TemplateRenderDiagnostics = {
    missingFields: [],
    overflowWarnings: [],
  };

  const records: CanvasObjectRecord[] = [];

  for (const slot of template.slots) {
    if (slot.w <= 0 || slot.h <= 0) continue;
    const scale = scaleForSlot(slot);
    const cx = slot.x + slot.w / 2;
    const cy = slot.y + slot.h / 2;
    const clampedCx = clamp(slot.w / 2, cx, template.page.width - slot.w / 2);
    const clampedCy = clamp(slot.h / 2, cy, template.page.height - slot.h / 2);
    const rawText = textForTemplateSlot(template.templateId, slot.id, fields);
    const text =
      typeof rawText === 'string' ? fitText(slot, rawText, diagnostics) : undefined;

    if (rawText === null) {
      // static slot
    } else if (rawText.trim().length === 0) {
      diagnostics.missingFields.push(slot.id);
    }

    if (slot.type === 'connector') {
      records.push({
        kind: 'line',
        left: clampedCx,
        top: clampedCy,
        scaleX: scale.scaleX,
        scaleY: scale.scaleY,
        angle: 0,
        fill: colorForSlot(slot),
      });
      continue;
    }

    if (slot.type === 'text') {
      const token = typeTokenForSlot(slot.id);
      records.push({
        kind: 'text',
        left: clampedCx,
        top: clampedCy,
        scaleX: scale.scaleX,
        scaleY: scale.scaleY,
        angle: 0,
        text,
        fontSize: token.size,
        fill: '#f3f4f6',
      });
      continue;
    }

    records.push({
      kind: 'rect',
      left: clampedCx,
      top: clampedCy,
      scaleX: scale.scaleX,
      scaleY: scale.scaleY,
      angle: 0,
      fill: colorForSlot(slot),
      text: text ?? '',
      fontSize: slot.type === 'logo' ? 14 : 16,
    });
  }

  return { records, diagnostics };
}

export function renderTemplate(
  template: TemplateSchema,
  fields: TemplateFields,
) {
  return renderTemplateWithDiagnostics(template, fields).records;
}
