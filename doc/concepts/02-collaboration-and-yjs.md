# Collaboration and Yjs concepts

## CRDT (Conflict-free replicated data type)

- **What**: A data structure whose replicas can be updated independently and merged without a central “winner takes all” lock, converging to the same state.
- **Why**: Multiple browsers (and the server) can edit the same logical document; network reordering or simultaneous edits do not require custom merge code for basic map updates.

## Yjs

- **What**: A mature CRDT library for shared editing; provides `Y.Doc`, subdocuments, `Y.Map`, `Y.Array`, awareness, and binary update encoding.
- **In this repo**: Canvas objects sync through a `Y.Map` of records; the template editor uses separate `Y.Map` instances for metadata, field content, and stream bookkeeping.

## `Y.Doc`

- **What**: The root collaborative document; holds shared types and emits binary **updates** when changed.
- **Lifecycle**: Created on the client (`new Y.Doc()` in `bindYjsToFabricCanvas`) or implicitly per room on the server via `y-websocket` utilities.

## `Y.Map`

- **What**: A string-keyed map whose entries are themselves CRDT-backed (nested shared types or JSON-like values depending on what you store).
- **Canvas usage**: Keys are stable Fabric object ids; values are `CanvasObjectRecord` payloads (see `packages/frontend/src/types/canvas.ts`).
- **Template usage**: `meta`, `fields`, `stream` maps hold template composition state (see `TemplateEditorShell`).

## Document room / doc name

- **What**: A string identifier for “which Yjs document” clients join (like a room id).
- **Canvas**: The WebSocket provider and REST AI layout calls align on the same name (query param `doc` on `ws://host/yjs?doc=...`).
- **Server**: `YjsCollabService.getDocName` reads `doc` from the URL, defaulting to `default`.

## `y-websocket`

- **What**: Reference WebSocket provider and server utilities that sync Yjs updates between clients and a central server.
- **Client**: `WebsocketProvider` connects to `/yjs` and syncs a `Y.Doc`.
- **Server**: `setupWSConnection` (from `y-websocket/bin/utils`) handles the wire protocol; `setPersistence` registers load/save hooks.

## Server-side persistence adapter

- **What**: Hooks that load initial state into a `Y.Doc` when a room is first needed and persist encoded updates when the doc changes.
- **Implementation**: `YjsPersistenceRepository` implements `bindState` / `writeState` using `Y.applyUpdate` and `Y.encodeStateAsUpdate`.
- **Storage**: `InMemoryDocRepository` keeps one byte blob per doc name (non-durable; restart loses data unless extended).

## Transactions (`ydoc.transact`)

- **What**: Batches multiple map mutations into a single Yjs update for efficiency and atomic observer behavior.
- **Used for**: Applying AI layout results on the server, applying template patches on the client, resetting compose state.

## Idempotency and stream deduplication (template editor)

- **Concept**: Compose streams may retry or duplicate; the client records processed operation ids in a `stream` map (`op:<opId>`) so the same patch is not applied twice.

## Sync event (client)

- **Concept**: `WebsocketProvider` fires `sync` when initial state has been received; the Fabric binding calls `applyFromYjs` to reconcile the canvas once CRDT state is available.

## `getYDoc` (server internal)

- **Concept**: `y-websocket` keeps an in-memory registry of active documents by name. `YjsCanvasApplyService` uses this to mutate the same `Y.Doc` that connected clients use — critical for **server-side AI writes** appearing on all tabs.
