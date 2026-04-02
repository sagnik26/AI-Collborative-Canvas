import type { CanvasObjectRecord } from '../../types/canvas';
import type {
  TemplateFields,
  TemplateRenderDiagnostics,
  TemplateSchema,
  TemplateSlot,
} from '../../types/template';
import { TEMPLATE_RENDER_BASE_H, TEMPLATE_RENDER_BASE_W } from '../../constants/templateRender';

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

function textForSlot(slotId: string, fields: TemplateFields): string | null {
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

function colorForSlot(slot: TemplateSlot) {
  if (slot.type === 'connector') return 'rgba(148, 163, 184, 0.75)';
  if (slot.id.includes(':cta:') || slot.id === 'slot:final:cta') return '#7c3aed';
  if (slot.type === 'pill') return '#1d4ed8';
  if (slot.type === 'logo') return 'rgba(255,255,255,0.05)';
  if (slot.id === 'slot:hero:visual') return 'rgba(16, 185, 129, 0.18)';
  if (slot.id === 'slot:math:box') return 'rgba(59, 130, 246, 0.16)';
  if (slot.type === 'box') return 'rgba(255,255,255,0.04)';
  return '#f3f4f6';
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
    const scale = scaleForSlot(slot);
    const cx = slot.x + slot.w / 2;
    const cy = slot.y + slot.h / 2;
    const clampedCx = clamp(slot.w / 2, cx, template.page.width - slot.w / 2);
    const clampedCy = clamp(slot.h / 2, cy, template.page.height - slot.h / 2);
    const rawText = textForSlot(slot.id, fields);
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
      records.push({
        kind: 'text',
        left: clampedCx,
        top: clampedCy,
        scaleX: scale.scaleX,
        scaleY: scale.scaleY,
        angle: 0,
        text,
        fontSize: slot.id.includes('headline') ? 34 : 16,
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
