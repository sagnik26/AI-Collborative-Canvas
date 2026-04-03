import type { TemplateSchema, TemplateSlot } from '../../types/template';
import type { SlotPatch } from '../../types/templatePack';
import {
  LANDING_BASE_SLOTS,
  TEMPLATE_PAGE,
} from '../../constants/templatePackV1';

export function applySlotPatches(
  patches: Record<string, SlotPatch>,
  baseSlots: TemplateSlot[] = LANDING_BASE_SLOTS,
): TemplateSlot[] {
  return baseSlots.map((slot) => {
    const p = patches[slot.id];
    return p ? { ...slot, ...p } : { ...slot };
  });
}

export type BuildTemplatePackOptions = {
  page?: { width: number; height: number };
  baseSlots?: TemplateSlot[];
};

export function buildTemplatePack(
  templateId: TemplateSchema['templateId'],
  patches: Record<string, SlotPatch>,
  options?: BuildTemplatePackOptions,
): TemplateSchema {
  const page = options?.page ?? TEMPLATE_PAGE;
  const baseSlots = options?.baseSlots ?? LANDING_BASE_SLOTS;
  return {
    schemaVersion: '1',
    templateId,
    page,
    slots: applySlotPatches(patches, baseSlots),
  };
}
