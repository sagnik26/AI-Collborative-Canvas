# AI Collaborative Canvas

## What is the project?

AI Collaborative Canvas is a local-first collaborative drawing + document composition playground:

- **Canvas**: a Figma/Excalidraw-like editor powered by **Fabric.js**, synchronized in real-time via **Yjs** over **WebSocket**.
- **AI layout**: send the current canvas state + an instruction to the backend; the backend asks **OpenAI** for a layout plan and applies changes back into the shared Yjs document.
- **Template composition**: a “template editor” that streams incremental field patches from OpenAI (NDJSON) and applies them into a shared Yjs doc so multiple clients see the same evolving document.

This is a **pnpm workspace monorepo** with separate `frontend` (React/Vite) and `backend` (Express + WS) packages.

## Codebase Structure and patterns

### Top-level

- **`package.json`**: workspace scripts (run frontend+backend together, build, typecheck, formatting).
- **`pnpm-workspace.yaml`**: declares `packages/*`.
- **`packages/`**: product code (frontend + backend).
- **`scripts/`**: repo-level scripts (e.g. shared dependency checks).

### Frontend (`packages/frontend`)

- **Entry**: `src/main.tsx` → `src/App.tsx`
- **Routes/pages**: `src/pages/*`
- **UI components**: `src/components/*`
- **Reusable logic (non-React)**: `src/libs/*`
  - `src/libs/canvas/*`: Fabric ↔ Yjs binding, factories, viewport utilities
  - `src/libs/ai/*`: client that calls backend AI endpoints
  - `src/libs/template/*`: template contracts, streaming client, rendering helpers
- **Types**: `src/types/*`
- **Constants**: `src/constants/*`

Pattern-wise:

- **React components stay “thin”**: orchestration + UI in `components/`, pure logic in `libs/`.
- **Shared state is Yjs**: bindings write local edits into Yjs; remote updates rehydrate the Fabric canvas / template state.
- **Backend URLs are currently hard-coded** to `http://localhost:4000` and `ws://localhost:4000` in shells (easy to env-ify later).

### Backend (`packages/backend`)

- **Entry**: `src/index.ts`
- **HTTP transport**: `src/transport/http/*` (Express app + route registration)
- **WS transport**: `src/transport/ws/*` (attaches `/yjs` WebSocket server)
- **Controllers**: `src/controllers/*` (request handlers)
- **Services**: `src/services/*` (OpenAI calls, Yjs apply logic, collab wiring)
- **Repositories**: `src/repositories/*` (persistence abstractions/impl; currently in-memory)
- **Schemas/types**: `src/schemas/*`, `src/types/*` (Zod validation + contracts)

Pattern-wise:

- **Controllers validate and translate**: Zod schema parse → call service → map to response.
- **Services hold the behavior**: OpenAI prompting + result parsing, “apply to Yjs doc”, etc.
- **Transport is thin**: Express/WS wiring lives under `transport/`.

## Project Architecture

### Moving parts

- **Web app (frontend)**: React + Vite UI that hosts:
  - a **Fabric.js** canvas editor (`/canvas`)
  - a **template editor** that renders a one-page layout and keeps it in sync (`/design/editor`)
- **API + realtime server (backend)**: Node/Express for HTTP APIs plus a WebSocket endpoint for Yjs.
- **Realtime sync (Yjs + y-websocket)**: shared documents (“rooms”) synchronized over WebSocket at `ws://localhost:4000/yjs`.
- **AI provider (OpenAI)**: backend-only calls that produce either a layout plan or streaming template patches.

### Network endpoints (local)

- **HTTP**
  - `GET /health`
  - `POST /ai/layout` (JSON request/response)
  - `POST /ai/compose-template` (NDJSON streaming response)
- **WebSocket**
  - `ws://localhost:4000/yjs` (Yjs rooms, e.g. `yjs?doc=default`)

### Collaboration model

- **Source of truth**: a Yjs document per “room/doc”.
- **Clients**: each browser connects to the same room and updates the Yjs maps.
- **Conflict handling**: Yjs CRDT merges concurrent edits automatically; all clients converge.

### Data flow: canvas collaboration

- Local Fabric edits are serialized into a Yjs `Y.Map` of object records (stable ids → record).
- Remote Yjs updates are observed and applied back onto the Fabric canvas (bulk updates are animated for UX).

### Data flow: AI layout (canvas)

- Frontend sends a compact snapshot of the canvas (elements + dimensions) to `POST /ai/layout`.
- Backend calls OpenAI and receives a JSON plan:
  - **moves**: updates for existing element positions/sizes
  - **creates**: new elements to add
- Backend applies the plan into the shared Yjs doc; all connected clients receive it via realtime sync.

### Data flow: template composition (streaming)

- Frontend starts a “compose” run and calls `POST /ai/compose-template`.
- Backend streams **NDJSON** events (e.g. `template_selected`, `field_patch`, `complete`).
- Frontend validates and applies each patch into Yjs maps so collaborators see the same incremental updates.

## Quick Start in local

### Prereqs

- **Node.js** (recent LTS recommended)
- **pnpm**

### Install

```bash
pnpm install
```

### Configure environment

Create `packages/backend/.env`:

```bash
OPENAI_API_KEY=your_key_here
# optional
# PORT=4000
# OPENAI_MODEL=gpt-4o-mini
```

Notes:

- Backend accepts an API key either from **`OPENAI_API_KEY`** or from an HTTP `Authorization: Bearer <key>` header.

### Run (frontend + backend)

```bash
pnpm dev
```

- **Backend**: `http://localhost:4000` (WebSocket: `ws://localhost:4000/yjs`)
- **Frontend**: Vite dev server (prints the URL in the terminal; usually `http://localhost:5173`)

### Useful scripts

```bash
pnpm dev:frontend
pnpm dev:backend
pnpm build
pnpm typecheck
pnpm format:check
pnpm format:fix
```
