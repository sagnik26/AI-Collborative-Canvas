import { Canvas as FabricCanvas } from 'fabric';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fixtureForTemplate, VISUAL_TEMPLATE_IDS } from '../Design System/templateFixtures.ts';
import { getObjectId } from '../libs/canvas/fabricRecords.ts';
import { refitTemplateSceneAndRender } from '../libs/template/templateCanvasFabric.ts';
import { getTemplatePack } from '../libs/template/templatePacks.ts';
import type { TemplateId } from '../types/template';

type SlotRect = {
  slotId: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

declare global {
  interface Window {
    __templateHarness?: {
      getSlotRects: (templateId: string) => SlotRect[];
    };
  }
}

const DEFAULT_SNAPSHOT_SIZE = { width: 1280, height: 1024 } as const;
const SNAPSHOT_SIZE_BY_TEMPLATE: Partial<Record<TemplateId, { width: number; height: number }>> = {
  'landing.v1': { width: 706, height: 1600 },
};

function snapshotSizeForTemplate(templateId: TemplateId) {
  return SNAPSHOT_SIZE_BY_TEMPLATE[templateId] ?? DEFAULT_SNAPSHOT_SIZE;
}

export function TemplateVisualRegressionPage() {
  const refs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const [ready, setReady] = useState(false);
  const [images, setImages] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const templates = useMemo(() => VISUAL_TEMPLATE_IDS, []);

  useEffect(() => {
    const canvases: FabricCanvas[] = [];
    const rectsByTemplate = new Map<string, SlotRect[]>();
    const dataUrls: Record<string, string> = {};
    setReady(false);
    setError(null);

    try {
      for (const templateId of templates) {
        const element = refs.current[templateId];
        if (!element) continue;
        const size = snapshotSizeForTemplate(templateId);
        const fabric = new FabricCanvas(element, {
          width: size.width,
          height: size.height,
          selection: false,
          preserveObjectStacking: true,
        });
        const template = getTemplatePack(templateId);
        refitTemplateSceneAndRender(fabric, template, fixtureForTemplate(templateId), {
          artboardColors: {
            pasteboard: '#f9f9ff',
            page: '#f9f9ff',
          },
        });
        fabric.renderAll();
        dataUrls[templateId] = fabric.lowerCanvasEl.toDataURL('image/png');
        const slotRects = fabric.getObjects().map((obj) => {
          const r = obj.getBoundingRect();
          return {
            slotId: getObjectId(obj) ?? '',
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
          };
        });
        rectsByTemplate.set(templateId, slotRects);
        canvases.push(fabric);
      }

      window.__templateHarness = {
        getSlotRects: (templateId: string) => rectsByTemplate.get(templateId) ?? [],
      };
      setImages(dataUrls);
      setReady(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to render regression harness.';
      setError(message);
    }

    return () => {
      canvases.forEach((canvas) => canvas.dispose());
      if (window.__templateHarness) {
        delete window.__templateHarness;
      }
    };
  }, [templates]);

  return (
    <div style={{ padding: 16, display: 'grid', gap: 20, background: '#0f172a', minHeight: '100vh' }}>
      <h1 style={{ color: '#e2e8f0', margin: 0 }}>Template Visual Regression Harness</h1>
      <div data-testid="harness-status" style={{ color: ready ? '#10b981' : '#f59e0b' }}>
        {error ? `error:${error}` : ready ? 'ready' : 'loading'}
      </div>
      {templates.map((templateId: TemplateId) => (
        <section
          key={templateId}
          data-testid={`template-${templateId}`}
          style={{ background: '#111827', borderRadius: 12, padding: 12, border: '1px solid #334155' }}
        >
          <h2 style={{ color: '#cbd5e1', margin: '0 0 8px 0', fontSize: 14 }}>{templateId}</h2>
          <canvas
            ref={(node) => {
              refs.current[templateId] = node;
            }}
            width={snapshotSizeForTemplate(templateId).width}
            height={snapshotSizeForTemplate(templateId).height}
            style={{
              width: snapshotSizeForTemplate(templateId).width,
              height: snapshotSizeForTemplate(templateId).height,
              background: '#111827',
              position: 'absolute',
              left: -99999,
            }}
          />
          {images[templateId] ? (
            <img
              data-testid={`snapshot-${templateId}`}
              src={images[templateId]}
              alt={`${templateId} snapshot`}
              style={{
                width: snapshotSizeForTemplate(templateId).width,
                height: snapshotSizeForTemplate(templateId).height,
                background: '#111827',
                display: 'block',
              }}
            />
          ) : null}
        </section>
      ))}
    </div>
  );
}
