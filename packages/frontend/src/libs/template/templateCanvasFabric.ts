import { Group, Textbox } from 'fabric';
import type { Canvas as FabricCanvasType, FabricObject } from 'fabric';
import type { TemplateFields, TemplateSchema, TemplateSlot } from '../../types/template';
import { getObjectId } from '../canvas/fabricRecords.ts';
import type { TemplateArtboardColors } from './templateArtboard.ts';
import { setupTemplateArtboard } from './templateArtboard.ts';
import { slotToFabricObject } from '../../Design System/slotToFabricObject.ts';
import { fitSlotTextForCanvas, textForTemplateSlot } from './renderTemplate.ts';
import { getTemplateFabricViewLayout } from './templateFabricViewLayout.ts';

function intersects(a: FabricObject, b: FabricObject) {
  const ra = a.getBoundingRect();
  const rb = b.getBoundingRect();
  return !(
    ra.left + ra.width <= rb.left ||
    rb.left + rb.width <= ra.left ||
    ra.top + ra.height <= rb.top ||
    rb.top + rb.height <= ra.top
  );
}

function slotPriority(slotId: string) {
  if (slotId === 'slot:hero:headline') return 100;
  if (slotId === 'slot:hero:subheadline') return 98;
  if (slotId === 'slot:final:headline') return 97;
  if (slotId === 'slot:hero:cta:primary') return 95;
  if (slotId === 'slot:hero:cta:secondary') return 94;
  if (slotId === 'slot:math:formula') return 92;
  if (slotId === 'slot:math:title') return 90;
  if (slotId === 'slot:hero:visual' || slotId === 'slot:math:box') return 88;
  if (slotId === 'slot:hero:badge' || slotId === 'slot:social:title') return 85;
  if (slotId.startsWith('slot:steps:pill:')) return 70;
  if (slotId.startsWith('slot:steps:desc:')) return 50;
  if (slotId.startsWith('slot:logo:')) return 35;
  if (slotId.startsWith('slot:steps:connector:')) return 20;
  return 60;
}

/**
 * If slots collide due to long generated text or tight geometry, drop lower-priority items.
 * Keeps core narrative/CTA slots and sacrifices decorative/proof details first.
 */
function pruneOverlappingTemplateSlots(canvas: FabricCanvasType) {
  const objects = canvas.getObjects();
  const removed = new Set<string>();
  for (let i = 0; i < objects.length; i += 1) {
    const a = objects[i];
    const idA = getObjectId(a);
    if (!idA || removed.has(idA)) continue;
    for (let j = i + 1; j < objects.length; j += 1) {
      const b = objects[j];
      const idB = getObjectId(b);
      if (!idB || removed.has(idB)) continue;
      if (!intersects(a, b)) continue;

      const pA = slotPriority(idA);
      const pB = slotPriority(idB);
      const loser = pA >= pB ? b : a;
      const loserId = pA >= pB ? idB : idA;
      canvas.remove(loser);
      removed.add(loserId);
      if (loser === a) break;
    }
  }
}

function shouldHideWhenBlank(slot: TemplateSlot) {
  if (slot.type === 'logo') return true;
  if (slot.id === 'slot:social:title') return true;
  if (slot.id.startsWith('slot:steps:pill:')) return true;
  if (slot.id.startsWith('slot:steps:desc:')) return true;
  if (slot.id === 'slot:math:footnote') return true;
  return false;
}

export function removeTemplateSlotObjects(canvas: FabricCanvasType) {
  for (const obj of [...canvas.getObjects()]) {
    canvas.remove(obj);
  }
}

export function renderTemplateSlotsToCanvas(
  canvas: FabricCanvasType,
  template: TemplateSchema,
  fields: TemplateFields,
  pageX: number,
  pageY: number,
) {
  const layout = getTemplateFabricViewLayout(template);
  removeTemplateSlotObjects(canvas);
  for (const slot of template.slots) {
    const raw = textForTemplateSlot(template.templateId, slot.id, fields);
    if (raw === null) continue;
    if (shouldHideWhenBlank(slot) && (raw == null || raw.trim().length === 0)) continue;
    const fitted = typeof raw === 'string' ? fitSlotTextForCanvas(slot, raw) : raw;
    canvas.add(slotToFabricObject(slot, fitted, pageX, pageY, layout, template.templateId));
  }
  pruneOverlappingTemplateSlots(canvas);
  canvas.requestRenderAll();
}

/** Recenters the portrait A4 artboard for the current canvas pixel size and rebuilds slot objects. */
export function refitTemplateSceneAndRender(
  canvas: FabricCanvasType,
  template: TemplateSchema,
  fields: TemplateFields,
  options?: { artboardColors?: TemplateArtboardColors },
): { pageX: number; pageY: number } {
  const cw = typeof canvas.width === 'number' ? canvas.width : 0;
  const ch = typeof canvas.height === 'number' ? canvas.height : 0;
  const layout = getTemplateFabricViewLayout(template);
  const pageW = layout.viewW;
  const pageH = layout.viewH;
  const pageX = (cw - pageW) / 2;
  const pageY = (ch - pageH) / 2;

  setupTemplateArtboard(canvas, options?.artboardColors, { width: pageW, height: pageH });

  renderTemplateSlotsToCanvas(canvas, template, fields, pageX, pageY);
  return { pageX, pageY };
}

function setFabricTextForSlotObject(obj: FabricObject, newText: string) {
  if (obj instanceof Group) {
    const textChild = obj.getObjects().find((child): child is Textbox => {
      if (!(child instanceof Textbox)) return false;
      const role = (child.get('data') as { textRole?: string } | undefined)?.textRole;
      return role === 'content' || child.editable === true;
    });
    if (textChild) {
      textChild.set('text', newText);
    }
  } else if (obj instanceof Textbox) {
    obj.set('text', newText);
  }
}

/**
 * Updates slot text from fields. Skips slots with no mapped field ({@link textForSlot} returns null).
 */
export function applyTemplateFieldsToFabricObjects(
  canvas: FabricCanvasType,
  template: TemplateSchema,
  fields: TemplateFields,
) {
  const layout = getTemplateFabricViewLayout(template);
  const cw = typeof canvas.width === 'number' ? canvas.width : 0;
  const ch = typeof canvas.height === 'number' ? canvas.height : 0;
  const pageX = (cw - layout.viewW) / 2;
  const pageY = (ch - layout.viewH) / 2;

  for (const slot of template.slots) {
    const rawText = textForTemplateSlot(template.templateId, slot.id, fields);
    const newText = typeof rawText === 'string' ? fitSlotTextForCanvas(slot, rawText) : rawText;
    const obj = canvas.getObjects().find((o) => getObjectId(o) === slot.id);
    if (newText === null) {
      if (obj) canvas.remove(obj);
      continue;
    }
    if (shouldHideWhenBlank(slot) && typeof newText === 'string' && newText.trim().length === 0) {
      if (obj) canvas.remove(obj);
      continue;
    }
    if (!obj) {
      canvas.add(slotToFabricObject(slot, newText, pageX, pageY, layout, template.templateId));
      continue;
    }

    setFabricTextForSlotObject(obj, newText);
  }
  pruneOverlappingTemplateSlots(canvas);
  canvas.requestRenderAll();
}
