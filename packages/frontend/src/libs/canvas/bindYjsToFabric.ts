import type { Canvas as FabricCanvasType, FabricObject } from 'fabric';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { CanvasObjectRecord } from '../../types/canvas';
import type { YjsFabricBinding, YjsFabricMapBinding } from '../../types/yjs';
import {
  applyRecordToObject,
  ensureObjectForRecord,
  getObjectId,
  serializeObject,
} from './fabricRecords.ts';

/**
 * Bidirectional sync between a Fabric canvas and a Y.Map of {@link CanvasObjectRecord}s.
 * Does not create a Y.Doc or websocket — use with your own collaborative document.
 */
export function bindFabricCanvasToYMap(opts: {
  canvas: FabricCanvasType;
  ymap: Y.Map<CanvasObjectRecord>;
  /**
   * When the map has no entry for an object id, skip removal (e.g. template artboard + slot
   * objects that are not yet stored in the map).
   */
  shouldPreserveObject?: (obj: FabricObject) => boolean;
}): YjsFabricMapBinding {
  const { canvas, ymap, shouldPreserveObject } = opts;

  let applyingRemote = false;

  const applyFromYjs = (applyOpts?: { animatePositions?: boolean }) => {
    applyingRemote = true;
    try {
      const liveIds = new Set<string>();
      ymap.forEach((_v, k) => liveIds.add(k));

      canvas.getObjects().forEach((o) => {
        const obj = o as FabricObject;
        const id = getObjectId(obj);
        if (id && !liveIds.has(id)) {
          if (shouldPreserveObject?.(obj)) return;
          canvas.remove(obj);
        }
      });

      ymap.forEach((rec, id) => {
        const obj = ensureObjectForRecord(canvas, id, rec);
        if (applyOpts?.animatePositions) {
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
    applyFromYjs({ animatePositions: keyCount >= 2 });
  };
  ymap.observe(onYjsChange as unknown as (evt: unknown) => void);

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

  return {
    destroy: () => {
      canvas.off('object:added', onObjectAdded);
      canvas.off('object:removed', onObjectRemoved);
      canvas.off('object:modified', onObjectModified);
      canvas.off('object:moving', onObjectMoving);
      canvas.off('object:scaling', onObjectScaling);
      canvas.off('text:changed', onTextChanged);

      ymap.unobserve(onYjsChange as unknown as (evt: unknown) => void);
    },
    getRecordsById: () => {
      const m = new Map<string, CanvasObjectRecord>();
      ymap.forEach((rec, id) => m.set(id, rec));
      return m;
    },
    applyFromYjs,
  };
}

export function bindYjsToFabricCanvas(opts: {
  canvas: FabricCanvasType;
  wsBaseUrl: string;
  room: string;
  mapName?: string;
}): YjsFabricBinding {
  const { canvas, wsBaseUrl, room, mapName = 'objects' } = opts;

  const ydoc = new Y.Doc();
  const provider = new WebsocketProvider(wsBaseUrl, room, ydoc, {
    connect: true,
  });
  const ymap = ydoc.getMap<CanvasObjectRecord>(mapName);

  let synced = false;

  const mapBinding = bindFabricCanvasToYMap({ canvas, ymap });

  provider.on('sync', (isSynced: boolean) => {
    synced = isSynced;
    if (isSynced) mapBinding.applyFromYjs({ animatePositions: false });
  });

  return {
    destroy: () => {
      mapBinding.destroy();
      provider.destroy();
      ydoc.destroy();
    },
    getRecordsById: mapBinding.getRecordsById,
    isSynced: () => synced,
    getRoomId: () => room,
    getDoc: () => ydoc,
  };
}
