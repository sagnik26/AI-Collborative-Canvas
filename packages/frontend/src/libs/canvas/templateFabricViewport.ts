import type { Canvas as FabricCanvasType, FabricObject } from 'fabric';
import { Group, Textbox } from 'fabric';

/**
 * Wheel zoom (toward pointer) and Alt+drag pan on empty canvas. Click on a grouped sub-target
 * selects the group; double-click enters inner Textbox edit mode (same idea as {@link CanvasShell}).
 */
export function attachTemplateFabricViewport(canvas: FabricCanvasType) {
  const onWheel = (opt: unknown) => {
    const o = opt as { e?: WheelEvent };
    const e = o.e;
    if (!e) return;
    e.preventDefault();
    e.stopPropagation();
    let zoom = canvas.getZoom();
    zoom *= 0.999 ** e.deltaY;
    zoom = Math.min(Math.max(zoom, 0.2), 4);
    const point = canvas.getScenePoint(e);
    canvas.zoomToPoint(point, zoom);
    canvas.requestRenderAll();
  };

  let isPanning = false;
  let lastX = 0;
  let lastY = 0;

  const onMouseDown = (opt: unknown) => {
    const o = opt as {
      e?: MouseEvent;
      target?: FabricObject;
      subTargets?: FabricObject[];
    };
    if (o.e?.altKey && !o.target) {
      isPanning = true;
      lastX = o.e.clientX;
      lastY = o.e.clientY;
      return;
    }
    const sub = o.subTargets?.[0];
    const parent = sub?.group as unknown as FabricObject | undefined;
    if (!parent) return;
    canvas.setActiveObject(parent);
    canvas.requestRenderAll();
  };

  const onMouseMove = (opt: unknown) => {
    if (!isPanning) return;
    const o = opt as { e?: MouseEvent };
    if (!o.e) return;
    const dx = o.e.clientX - lastX;
    const dy = o.e.clientY - lastY;
    lastX = o.e.clientX;
    lastY = o.e.clientY;
    const vpt = canvas.viewportTransform;
    if (!vpt) return;
    vpt[4] += dx;
    vpt[5] += dy;
    canvas.setViewportTransform(vpt);
    canvas.requestRenderAll();
  };

  const onMouseUp = () => {
    isPanning = false;
  };

  const onMouseDblClick = (opt: unknown) => {
    const anyOpt = opt as {
      subTargets?: FabricObject[];
      target?: FabricObject;
    };
    const sub = anyOpt.subTargets?.[0];
    const target = anyOpt.target;

    const candidate =
      (sub instanceof Textbox && sub) ||
      (target instanceof Textbox && target) ||
      (target instanceof Group
        ? (target.getObjects().find((child) => child instanceof Textbox) as
            | Textbox
            | undefined)
        : undefined);

    if (candidate) {
      canvas.setActiveObject(candidate);
      const editable = candidate as unknown as {
        enterEditing?: () => void;
        selectAll?: () => void;
      };
      editable.enterEditing?.();
      editable.selectAll?.();
      canvas.requestRenderAll();
    }
  };

  canvas.on('mouse:wheel', onWheel);
  canvas.on('mouse:down', onMouseDown);
  canvas.on('mouse:move', onMouseMove);
  canvas.on('mouse:up', onMouseUp);
  canvas.on('mouse:dblclick', onMouseDblClick);

  return () => {
    canvas.off('mouse:wheel', onWheel);
    canvas.off('mouse:down', onMouseDown);
    canvas.off('mouse:move', onMouseMove);
    canvas.off('mouse:up', onMouseUp);
    canvas.off('mouse:dblclick', onMouseDblClick);
  };
}
