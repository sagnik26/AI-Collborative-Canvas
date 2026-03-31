import type { Canvas as FabricCanvasType, FabricObject } from 'fabric';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { CanvasObjectRecord } from '../../types/canvas';
import {
  applyRecordToObject,
  ensureObjectForRecord,
  getObjectId,
  serializeObject,
} from './fabricRecords.ts';

export type YjsFabricBinding = {
  destroy: () => void;
};

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

  const applyFromYjs = () => {
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
        applyRecordToObject(obj, rec);
      });

      canvas.requestRenderAll();
    } finally {
      applyingRemote = false;
    }
  };

  const onYjsChange = () => applyFromYjs();
  ymap.observe(onYjsChange);
  provider.on('sync', (isSynced: boolean) => {
    if (isSynced) applyFromYjs();
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
  };

  return binding;
}
