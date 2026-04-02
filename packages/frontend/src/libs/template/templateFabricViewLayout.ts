import type { TemplateSchema } from '../../types/template';
import { A4_BASE_HEIGHT, A4_BASE_WIDTH } from '../../constants/templateEditor.ts';

/**
 * Portrait A4 “page” in Fabric scene space (same aspect as {@link TemplateEditorShell}’s preview).
 *
 * `landing.v1` uses a **700×990** design page (no letterboxing). Pitch packs still use **1600×900**;
 * uniform scaling maps them into the A4 frame with letterboxing unless slot geometry is updated.
 */
export type TemplateFabricViewLayout = {
  viewW: number;
  viewH: number;
  s: number;
  padX: number;
  padY: number;
  designW: number;
  designH: number;
};

export function getTemplateFabricViewLayout(template: TemplateSchema): TemplateFabricViewLayout {
  const designW = template.page.width;
  const designH = template.page.height;
  const viewW = A4_BASE_WIDTH;
  const viewH = A4_BASE_HEIGHT;
  const s = Math.min(viewW / designW, viewH / designH);
  const contentW = designW * s;
  const contentH = designH * s;
  const padX = (viewW - contentW) / 2;
  const padY = (viewH - contentH) / 2;
  return { viewW, viewH, s, padX, padY, designW, designH };
}
