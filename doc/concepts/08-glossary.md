# Glossary (A–Z)

Short definitions; full context lives in the numbered concept files and [architecture.md](../architecture.md).


| Term                                                   | Meaning                                                                      |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| **AbortController**                                    | Cancels fetch/stream when navigation or connection ends.                     |
| **AI layout**                                          | POST `/ai/layout` flow: model returns moves/creates; server writes into Yjs. |
| `**applyFromYjs`**                                     | Binding function that reconciles `Y.Map` records onto Fabric objects.        |
| `**bindFabricCanvasToYMap**`                           | Low-level two-way sync between one Fabric canvas and one `Y.Map`.            |
| `**bindYjsToFabricCanvas**`                            | Creates `Y.Doc` + `WebsocketProvider` + canvas binding for `/canvas`.        |
| `**CanvasObjectRecord**`                               | Serializable description of a canvas object for CRDT storage.                |
| `**CanvasShell**`                                      | Main UI for the collaborative Fabric editor and prompt bar.                  |
| **Compose stream**                                     | NDJSON events filling template fields incrementally.                         |
| **Controller**                                         | Express handler: validate input, call service, respond.                      |
| **Conversation store**                                 | In-memory per-room history for multi-turn layout prompts.                    |
| **CRDT**                                               | Data structure merging concurrent edits without manual conflict rules.       |
| `**createApp`**                                        | Express app factory (CORS, JSON, routes).                                    |
| `**DesignShell**`                                      | Landing UX before the template editor; sets candidates + navigates.          |
| `**doc` / doc name**                                   | Yjs room identifier (query param on WebSocket URL).                          |
| `**docId`**                                            | Client-generated id for a new template session.                              |
| **ESM**                                                | ECMAScript modules (`import`/`export`).                                      |
| **Express**                                            | HTTP framework for REST endpoints.                                           |
| **Fabric.js**                                          | Canvas rendering library; `FabricObject` instances.                          |
| `**field_patch`**                                      | Stream event carrying partial `TemplateFields`.                              |
| `**fitSlotTextForCanvas**`                             | Slot text fitting for Fabric without diagnostics.                            |
| `**getYDoc**`                                          | y-websocket accessor for the live server `Y.Doc` by room name.               |
| **Idempotency (`op:<opId>`)**                          | Stream map flag preventing duplicate patch application.                      |
| `**InMemoryDocRepository`**                            | Non-durable persistence of Yjs state bytes per doc.                          |
| **NDJSON**                                             | Newline-delimited JSON for HTTP streaming.                                   |
| **Nx**                                                 | Monorepo task tooling (root devDependency).                                  |
| **OpenAI integration**                                 | Backend-only calls for layout and template compose.                          |
| `**OpenAiLayoutService`**                              | Service wrapping layout prompting and parsing.                               |
| `**OpenAiTemplateComposeService**`                     | Service yielding compose stream events.                                      |
| `**pnpm workspace**`                                   | Multi-package repo layout under `packages/*`.                                |
| **PromptBar**                                          | Canvas AI chat-style UI for layout instructions.                             |
| **Repository**                                         | Persistence port; implemented in-memory today.                               |
| **Room**                                               | See **doc name**.                                                            |
| `**renderTemplate` / `renderTemplateWithDiagnostics`** | Schema + fields → canvas records + warnings.                                 |
| **Service**                                            | Backend behavior unit (OpenAI, Yjs apply, collab).                           |
| `**setupWSConnection`**                                | y-websocket handler for a single WebSocket connection.                       |
| `**slotToFabricObject**`                               | Slot + tokens → Fabric-level representation.                                 |
| `**TemplateComposeEvent**`                             | Discriminated union of stream event types.                                   |
| `**TemplateEditorShell**`                              | Yjs + compose + preview for `/design/editor`.                                |
| `**TemplateFields**`                                   | Canonical copy model for template packs.                                     |
| `**TemplateMeta**`                                     | Id, theme, status, version for the active template.                          |
| `**TemplatePatch**`                                    | Validated incremental update from compose stream.                            |
| `**TemplateSchema**`                                   | Page geometry + slot list for a template pack.                               |
| `**TemplateSlot**`                                     | Positioned region with type and text constraints.                            |
| `**template_selected**`                                | Stream event locking template id + theme.                                    |
| **Transport**                                          | `transport/http` and `transport/ws` wiring layers.                           |
| `**upsertToYjs`**                                      | Serialize Fabric object → set key in `Y.Map`.                                |
| `**validateTemplatePatch**`                            | Client-side guardrails before writing fields to Yjs.                         |
| **Vite**                                               | Frontend bundler and dev server.                                             |
| `**WebsocketProvider`**                                | Client Yjs connector to `/yjs`.                                              |
| `**writeState` / `bindState**`                         | y-websocket persistence hooks.                                               |
| `**Y.Doc` / `Y.Map**`                                  | Yjs document and map CRDT types.                                             |
| `**ydoc.transact**`                                    | Batch Yjs mutations.                                                         |
| `**YjsCanvasApplyService**`                            | Server writes layout results into shared `Y.Map`.                            |
| `**YjsCollabService**`                                 | Resolves doc name; calls `setupWSConnection`.                                |
| `**YjsPersistenceRepository**`                         | Bridges `DocRepository` to y-websocket persistence.                          |
| `**encodeStateAsUpdate` / `applyUpdate**`              | Binary serialization primitives for Yjs.                                     |


