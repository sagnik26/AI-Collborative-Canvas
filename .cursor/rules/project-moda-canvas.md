---
description: "Moda Canvas: collaborative AI canvas proof-of-work project context and constraints"
alwaysApply: true
---
# Moda Canvas — Project Rules

## What This Is

A proof-of-work prototype for the Founding Engineer role at Moda (moda.app). It demonstrates three capabilities: real-time collaborative canvas, CRDT-based state sync, and AI-driven layout intelligence.

## Architecture

Nx monorepo with two apps and three shared libs:

| Project | Type | Stack |
|---------|------|-------|
| canvas-fe | App | Vite + React + TypeScript + Fabric.js + Yjs + Tailwind |
| canvas-be | App | Node.js + Express + y-websocket + Anthropic SDK |
| shared-types | Lib | TypeScript interfaces (CanvasElement, AILayoutRequest, AILayoutResponse) |
| shared-prompts | Lib | LLM prompt templates for layout reasoning |
| shared-utils | Lib | Zod schemas, serialization helpers |

## Critical Constraints

- **Yjs is the single source of truth.** All state changes (human edits AND AI layout results) go through the Yjs document. Never bypass CRDT with direct WebSocket messages.
- **Server calls the LLM, not the client.** API key stays server-side. AI results are written into the Yjs doc on the server and broadcast via y-websocket.
- **Fabric.js for the canvas.** Use its native JSON serialization (canvas.toJSON / canvas.loadFromJSON) for CRDT integration.
- **No database.** All state is in-memory Yjs documents. This is a prototype.
- **TypeScript strict mode everywhere.** No `any` types. Use shared-types for all cross-boundary contracts.

## Code Organization

- Feature-based folders, not type-based (components/, hooks/, services/ within each feature)
- Max 400 lines per file, extract when approaching 300
- All canvas element types defined in shared-types
- All Zod validation schemas in shared-utils
- All LLM prompts in shared-prompts (never inline prompt strings in server code)

## Naming Conventions

- React components: PascalCase (Canvas.tsx, PromptBar.tsx)
- Hooks: camelCase with use prefix (useYjs.ts, useFabric.ts, useAiLayout.ts)
- Server routes: kebab-case (ai-layout.ts)
- Types/interfaces: PascalCase with no I prefix (CanvasElement, not ICanvasElement)
- Zod schemas: camelCase with Schema suffix (canvasElementSchema, aiLayoutRequestSchema)

## Key Technical Decisions

- y-websocket attaches to the same HTTP server as Express (single port)
- Presence cursors use Yjs awareness protocol, not a custom WebSocket channel
- AI layout responses animate via Fabric.js animate() with 300ms easing
- Undo uses Yjs UndoManager (per-user undo stacks)

## When Building Features

1. Define types in shared-types FIRST
2. Add Zod schemas in shared-utils
3. Implement backend route/service
4. Implement frontend hook
5. Wire into UI component
6. Test with two browser tabs open

## Do NOT

- Use Next.js, SSR, or any server-side rendering
- Add a database (Postgres, Redis, SQLite, etc.)
- Use Socket.io (use raw ws via y-websocket)
- Put LLM prompt strings inline in route handlers
- Use class components in React
- Skip TypeScript strict checks
