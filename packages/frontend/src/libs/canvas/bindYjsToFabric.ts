import type { Canvas as FabricCanvasType, FabricObject } from 'fabric';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { CanvasObjectRecord } from '../../types/canvas';
import type { YjsFabricBinding } from '../../types/yjs';
import {
  applyRecordToObject,
  ensureObjectForRecord,
  getObjectId,
  serializeObject,
} from './fabricRecords.ts';

export function bindYjsToFabricCanvas(opts: {
  canvas: FabricCanvasType;
  wsBaseUrl: string;
  room: string;
  mapName?: string;
}) {
  const { canvas, wsBaseUrl, room, mapName = 'objects' } = opts;

  const ydoc = new Y.Doc();
  const provider = new WebsocketProvider(wsBaseUrl, room, ydoc, {
    connect: true,
  });
  const ymap = ydoc.getMap<CanvasObjectRecord>(mapName);

  let applyingRemote = false;
  let synced = false;

  const applyFromYjs = (opts?: { animatePositions?: boolean }) => {
    applyingRemote = true;
    try {
      const liveIds = new Set<string>();
      ymap.forEach((_v, k) => liveIds.add(k));

      canvas.getObjects().forEach((o) => {
        const obj = o as FabricObject;
        const id = getObjectId(obj);
        if (id && !liveIds.has(id)) canvas.remove(obj);
      });

      ymap.forEach((rec, id) => {
        const obj = ensureObjectForRecord(canvas, id, rec);
        if (opts?.animatePositions) {
          const fromLeft = typeof obj.left === 'number' ? obj.left : 0;
          const fromTop = typeof obj.top === 'number' ? obj.top : 0;
          applyRecordToObject(obj, rec);
          const toLeft = typeof rec.left === 'number' ? rec.left : fromLeft;
          const toTop = typeof rec.top === 'number' ? rec.top : fromTop;

          const anyObj = obj as unknown as {
            animate?: (
              props: Record<string, number>,
              options: { duration: number; onChange: () => void },
            ) => void;
          };
          if (typeof anyObj.animate === 'function') {
            anyObj.animate(
              { left: toLeft, top: toTop },
              {
                duration: 300,
                onChange: () => canvas.requestRenderAll(),
              },
            );
          } else {
            obj.set({ left: toLeft, top: toTop });
          }
          // Keep zIndex stable after reposition.
          canvas.requestRenderAll();
        } else {
          applyRecordToObject(obj, rec);
        }
      });

      canvas.requestRenderAll();
    } finally {
      applyingRemote = false;
    }
  };

  const onYjsChange = (
    evt: {
      changes?: { keys?: Map<string, unknown> };
    } | null,
  ) => {
    const keyCount =
      evt?.changes?.keys && typeof evt.changes.keys.size === 'number'
        ? evt.changes.keys.size
        : 0;
    // Heuristic: bulk updates (2+ keys) are likely AI layout → animate.
    applyFromYjs({ animatePositions: keyCount >= 2 });
  };
  ymap.observe(onYjsChange as unknown as (evt: unknown) => void);
  provider.on('sync', (isSynced: boolean) => {
    synced = isSynced;
    if (isSynced) applyFromYjs({ animatePositions: false });
  });

  const upsertToYjs = (obj: FabricObject) => {
    if (applyingRemote) return;
    const id = getObjectId(obj);
    if (!id) return;
    const rec = serializeObject(obj);
    if (!rec) return;
    ymap.set(id, rec);
  };

  const removeFromYjs = (obj: FabricObject) => {
    if (applyingRemote) return;
    const id = getObjectId(obj);
    if (!id) return;
    ymap.delete(id);
  };

  const onObjectAdded = (e: unknown) => {
    const obj = (e as { target?: FabricObject }).target;
    if (obj) upsertToYjs(obj);
  };
  const onObjectRemoved = (e: unknown) => {
    const obj = (e as { target?: FabricObject }).target;
    if (obj) removeFromYjs(obj);
  };
  const onObjectModified = (e: unknown) => {
    const obj = (e as { target?: FabricObject }).target;
    if (obj) upsertToYjs(obj);
  };
  const onObjectMoving = (e: unknown) => {
    const obj = (e as { target?: FabricObject }).target;
    if (obj) upsertToYjs(obj);
  };
  const onObjectScaling = (e: unknown) => {
    const obj = (e as { target?: FabricObject }).target;
    if (obj) upsertToYjs(obj);
  };
  const onTextChanged = (e: unknown) => {
    const obj = (e as { target?: FabricObject }).target;
    if (obj) upsertToYjs(obj);
  };

  canvas.on('object:added', onObjectAdded);
  canvas.on('object:removed', onObjectRemoved);
  canvas.on('object:modified', onObjectModified);
  canvas.on('object:moving', onObjectMoving);
  canvas.on('object:scaling', onObjectScaling);
  canvas.on('text:changed', onTextChanged);

  const binding: YjsFabricBinding = {
    destroy: () => {
      canvas.off('object:added', onObjectAdded);
      canvas.off('object:removed', onObjectRemoved);
      canvas.off('object:modified', onObjectModified);
      canvas.off('object:moving', onObjectMoving);
      canvas.off('object:scaling', onObjectScaling);
      canvas.off('text:changed', onTextChanged);

      ymap.unobserve(onYjsChange);
      provider.destroy();
      ydoc.destroy();
    },
    getRecordsById: () => {
      const m = new Map<string, CanvasObjectRecord>();
      ymap.forEach((rec, id) => m.set(id, rec));
      return m;
    },
    isSynced: () => synced,
    getRoomId: () => room,
    getDoc: () => ydoc,
  };

  return binding;
}
