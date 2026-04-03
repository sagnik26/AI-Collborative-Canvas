import * as Y from 'yjs';
import type { CanvasObjectRecord } from '../../types/canvas';
import type { TemplateFields } from '../../types/template';
import { hasAnyTemplateContent } from './templateFieldsContent.ts';

export function hasText(value: string) {
  return value.trim().length > 0;
}

/** Drop persisted Fabric records for template slots when there is no field data (avoids rehydrating empty chrome). */
export function clearTemplateSlotRecordsIfFieldsEmpty(
  ydoc: Y.Doc,
  objectsMap: Y.Map<CanvasObjectRecord>,
  fields: TemplateFields,
): void {
  if (hasAnyTemplateContent(fields)) return;
  const keys: string[] = [];
  objectsMap.forEach((_v, k) => {
    if (typeof k === 'string' && k.startsWith('slot:')) keys.push(k);
  });
  if (keys.length === 0) return;
  ydoc.transact(() => {
    for (const k of keys) objectsMap.delete(k);
  });
}

export function cloneYMap<T>(ymap: Y.Map<T>) {
  const out = new Map<string, T>();
  ymap.forEach((v, k) => out.set(k, v));
  return out;
}

