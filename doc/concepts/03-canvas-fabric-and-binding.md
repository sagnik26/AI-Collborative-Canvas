# Canvas, Fabric.js, and Fabric↔Yjs binding

## Fabric.js

- **What**: A canvas library built on HTML5 Canvas; represents shapes as `FabricObject` instances with transforms, hit testing, and serialization hooks.
- **Why here**: Rich object model suitable for a mini design tool; events (`object:moving`, `object:scaling`, `text:changed`, etc.) map cleanly to CRDT updates.

## Stable object identity (`data.id` / helpers)

- **Concept**: Each synced object carries a stable string id used as the `Y.Map` key. Helpers in `fabricRecords.ts` read/write this id so grouping and selection still resolve to the correct record.

## `CanvasObjectRecord`

- **What**: A plain, JSON-friendly description of a canvas object: `kind`, geometry (`left`, `top`, `scaleX`, `scaleY`, `angle`), optional `fill`, `text`, vector/table payloads.
- **Where**: `packages/frontend/src/types/canvas.ts`.
- **Coord space**: Optional `coordSpace: 'page'` ties geometry to a template page origin when rendering templates on Fabric.

## Serialization vs live Fabric state

- **Concept**: The **source of truth** for collaboration is the Yjs map of records; Fabric is the **view**. On change, Fabric objects are serialized to records; on remote update, records are applied to Fabric objects (creating or updating as needed).

## `bindFabricCanvasToYMap`

- **What**: Low-level **bidirectional** binding between one Fabric canvas and one `Y.Map<CanvasObjectRecord>`.
- **Behaviors**:
  - **Remote apply**: Walks the map and ensures Fabric objects exist; optional **position animation** when many keys change at once (AI layout UX).
  - **Local upsert**: Listens to Fabric events and writes records into the map.
  - **Deletion**: Removes Fabric objects whose ids disappeared from the map unless `shouldPreserveObject` says otherwise (template slots case).
- **Where**: `packages/frontend/src/libs/canvas/bindYjsToFabric.ts`.

## `bindYjsToFabricCanvas`

- **What**: Convenience wrapper that creates a `Y.Doc`, `WebsocketProvider`, obtains the `objects` map (configurable name), and installs `bindFabricCanvasToYMap`.
- **Returns**: `destroy()` for teardown, `getRecordsById()`, sync status, room id.

## Fabric factories

- **What**: Functions that construct labeled rects, circles, text, lines, arrows, tables with consistent defaults and ids.
- **Where**: `packages/frontend/src/libs/canvas/fabricFactories.ts`.

## Viewport utilities

- **What**: Helpers to keep content visible when the canvas resizes or the AI moves elements off-screen (`viewport.ts`, used from `CanvasShell`).

## Template-specific Fabric integration

- **Concept**: Templates render slots into Fabric via `renderTemplate` / `templateCanvasFabric` / `slotToFabricObject` — bridging **schema slots + field strings** into **Fabric objects**, sometimes with selective Yjs sync (only certain ids sync; decorative slots may be preserved locally).

## Visual regression page

- **Concept**: A dedicated route exercises template rendering for pixel/visual checks (`TemplateVisualRegressionPage`) — useful when changing token or slot layout code.

