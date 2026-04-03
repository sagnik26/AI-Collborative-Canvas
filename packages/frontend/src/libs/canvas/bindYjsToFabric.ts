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

function resolveSyncTargetObject(
  canvas: FabricCanvasType,
  obj: FabricObject,
): FabricObject | null {
  const ownId = getObjectId(obj);
  if (ownId) return obj;
  const parent = (obj as unknown as { group?: FabricObject | null }).group;
  if (parent && getObjectId(parent)) return parent;

  const active = canvas.getActiveObject() as FabricObject | undefined;
  if (active && getObjectId(active)) return active;

  const activeObjects = canvas.getActiveObjects() as FabricObject[];
  const activeWithId = activeObjects.find((candidate) => Boolean(getObjectId(candidate)));
  if (activeWithId) return activeWithId;

  return null;
}

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
  /** Gate which local objects should be written to Yjs (default: all). */
  shouldSyncObject?: (obj: FabricObject) => boolean;
  /** Gate which Yjs ids should be applied back to Fabric (default: all). */
  shouldSyncId?: (id: string) => boolean;
  /** Optional record transform before writing to Yjs. */
  mapRecordForUpsert?: (ctx: {
    obj: FabricObject;
    id: string;
    rec: CanvasObjectRecord;
  }) => CanvasObjectRecord;
  /** Optional record transform before applying from Yjs. */
  mapRecordForApply?: (ctx: { id: string; rec: CanvasObjectRecord }) => CanvasObjectRecord;
}): YjsFabricMapBinding {
  const {
    canvas,
    ymap,
    shouldPreserveObject,
    shouldSyncObject,
    shouldSyncId,
    mapRecordForUpsert,
    mapRecordForApply,
  } = opts;

  let applyingRemote = false;

  const applyFromYjs = (applyOpts?: { animatePositions?: boolean }) => {
    applyingRemote = true;
    try {
      const liveIds = new Set<string>();
      ymap.forEach((_v, k) => {
        if (shouldSyncId && !shouldSyncId(k)) return;
        liveIds.add(k);
      });

      canvas.getObjects().forEach((o) => {
        const obj = o as FabricObject;
        const id = getObjectId(obj);
        if (shouldSyncObject && !shouldSyncObject(obj)) {
          // Still drop orphans when the map no longer tracks this id (e.g. hidden template slots
          // that must not upsert back into Yjs).
          if (id && !liveIds.has(id) && !shouldPreserveObject?.(obj)) {
            canvas.remove(obj);
          }
          return;
        }
        if (id && !liveIds.has(id)) {
          if (shouldPreserveObject?.(obj)) return;
          canvas.remove(obj);
        }
      });

      ymap.forEach((rec, id) => {
        if (shouldSyncId && !shouldSyncId(id)) return;
        const mappedRec = mapRecordForApply ? mapRecordForApply({ id, rec }) : rec;
        const obj = ensureObjectForRecord(canvas, id, mappedRec);
        if (applyOpts?.animatePositions) {
          const fromLeft = typeof obj.left === 'number' ? obj.left : 0;
          const fromTop = typeof obj.top === 'number' ? obj.top : 0;
          applyRecordToObject(obj, mappedRec);
          const toLeft = typeof mappedRec.left === 'number' ? mappedRec.left : fromLeft;
          const toTop = typeof mappedRec.top === 'number' ? mappedRec.top : fromTop;

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
          applyRecordToObject(obj, mappedRec);
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
    const target = resolveSyncTargetObject(canvas, obj);
    if (!target) return;
    if (shouldSyncObject && !shouldSyncObject(target)) return;
    const id = getObjectId(target);
    if (!id) return;
    const baseRec = serializeObject(target);
    const rec = baseRec
      ? mapRecordForUpsert
        ? mapRecordForUpsert({ obj: target, id, rec: baseRec })
        : baseRec
      : null;
    if (!rec) return;
    ymap.set(id, rec);
  };

  const removeFromYjs = (obj: FabricObject) => {
    if (applyingRemote) return;
    const target = resolveSyncTargetObject(canvas, obj);
    if (!target) return;
    if (shouldSyncObject && !shouldSyncObject(target)) return;
    const id = getObjectId(target);
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
  const onMouseUp = () => {
    if (applyingRemote) return;
    const activeObjects = canvas.getActiveObjects() as FabricObject[];
    activeObjects.forEach((obj) => upsertToYjs(obj));
    const active = canvas.getActiveObject() as FabricObject | undefined;
    if (active) upsertToYjs(active);
  };

  canvas.on('object:added', onObjectAdded);
  canvas.on('object:removed', onObjectRemoved);
  canvas.on('object:modified', onObjectModified);
  canvas.on('object:moving', onObjectMoving);
  canvas.on('object:scaling', onObjectScaling);
  canvas.on('text:changed', onTextChanged);
  canvas.on('mouse:up', onMouseUp);

  return {
    destroy: () => {
      canvas.off('object:added', onObjectAdded);
      canvas.off('object:removed', onObjectRemoved);
      canvas.off('object:modified', onObjectModified);
      canvas.off('object:moving', onObjectMoving);
      canvas.off('object:scaling', onObjectScaling);
      canvas.off('text:changed', onTextChanged);
      canvas.off('mouse:up', onMouseUp);

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
