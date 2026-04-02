import type { TemplateSchema, TemplateSlot } from '../../types/template';
import type { SlotPatch } from '../../types/templatePack';
import {
  LANDING_BASE_SLOTS,
  TEMPLATE_PAGE,
} from '../../constants/templatePackV1';

export function applySlotPatches(patches: Record<string, SlotPatch>): TemplateSlot[] {
  return LANDING_BASE_SLOTS.map((slot) => {
    const p = patches[slot.id];
    return p ? { ...slot, ...p } : { ...slot };
  });
}

export function buildTemplatePack(
  templateId: TemplateSchema['templateId'],
  patches: Record<string, SlotPatch>,
): TemplateSchema {
  return {
    schemaVersion: '1',
    templateId,
    page: TEMPLATE_PAGE,
    slots: applySlotPatches(patches),
  };
}
