# Moda Canvas — proof-of-work context

## What this is

A collaborative AI canvas prototype built as proof-of-work for the **Founding Engineer** role at [Moda](https://moda.app). Moda is an AI design agent with brand memory (General Catalyst seed), building a collaborative canvas where agents produce brand-aligned, editable output.

This repository demonstrates three engineering themes:

1. **Real-time collaborative canvas** — Multiple users editing simultaneously with conflict-free convergence.
2. **CRDT-based state** — **Yjs** for distributed document state (not naive last-write-wins over raw WebSockets).
3. **AI manipulation of shared state** — Natural language drives layout (`/ai/layout`) or streaming template fills (`/ai/compose-template`), with server-side validation and writes into the **same** Yjs documents clients already sync.

## Repository layout (actual)

This monorepo uses **pnpm** workspaces, not the older `apps/` + `libs/` sketch:

```
packages/frontend   — Vite, React, Fabric.js, Yjs client, template editor UI
packages/backend    — Node, Express, ws, y-websocket, OpenAI, in-memory Yjs persistence
doc/                — Architecture (Mermaid) and concept guides (see root README)
```

Shared contracts are defined **per package** (`packages/frontend/src/types`, `packages/backend/src/types`, Zod schemas); align changes manually or introduce a shared package later.

## Design / template mode — principles

**Guiding rule:** In design mode, **geometry comes from templates**, not from the model. The model supplies **semantic content** (`TemplateFields`); layout is **deterministic** from `TemplateSchema` slots.

- **Template pack** — `templateId`, page size, and **slots** (bounds, type, `maxChars` / `maxLines`, overflow). Registered in frontend pack modules and validated on the backend.
- **Template fields** — Shared copy-shaped model (hero, logos, steps, math, final CTA, etc.), held in Yjs and patched by the compose stream.
- **Streaming** — `POST /ai/compose-template` emits **NDJSON**: `template_selected` → `field_patch` → `complete` / `error`. Invalid patches are rejected; `stream` map entries like `op:<opId>` enforce idempotency.

Phases from the original plan (**mock stream → real LLM**) are reflected in the codebase: same contracts for mock and live compose; backend validates and streams structured events.

## Template canvas (Fabric)

The design editor uses a **Fabric**-based template surface (`TemplateCanvasShell` and related layout/render code) so slots are canvas objects: compose updates **field** maps in Yjs; optional **object** records sync drags/resizes where wired. Reused building blocks include `bindYjsToFabric` patterns, `fabricRecords`, `slotToFabricObject`, template packs, and `composeTemplateClient` — **no duplicate backend** for compose.

For file-level entry points, see [doc/architecture.md](doc/architecture.md) and [README.md](README.md).

## Template packs — roadmap (condensed)

**Goal:** Many packs registered by `templateId`; each compose request sends an allowlist (`templateCandidates`); the LLM picks one id from that list and fills fields; layout stays code-defined.

**Suggested order of work**

1. **Registry (frontend)** — Extend `TemplateId`, add pack modules, `getTemplatePack(id)`, editor reads pack from meta (not a single hardcoded pack).
2. **API (backend)** — Expand Zod enums for ids/themes; keep candidates typed; repair JSON schema must not invent unknown ids.
3. **Pack policy** — Per-pack (or per-family) completeness / gap-fill (`templatePackPolicy`-style) instead of only landing-shaped assumptions.
4. **Prompts + client** — Candidate hints in prompts; UI and API share the same allowlist.
5. **Tests + docs** — Registry, meta parsing, stream fixtures; “adding a pack” checklist in repo docs.

**Field model:** Prefer a **single shared `TemplateFields`** (Option A) until a pack needs different keys; then consider per-pack discriminated unions (Option B). See `packages/backend/src/utils/templatePackPolicy.ts`.

**Risks:** Unknown `templateId` in old Yjs docs (default/fallback pack), drift between frontend ids and backend `z.enum` (document both sides or generate from one source).

Follow-up implementation ideas may also be listed in [docs/TEMPLATE-COMPOSE-FUTURE-TODO.md](docs/TEMPLATE-COMPOSE-FUTURE-TODO.md).

## Production-quality template rendering (direction)

Target: generated pages feel **production-ready** while the LLM only chooses template + fills fields.

- **Componentized Fabric** — Semantic paths in `slotToFabricObject` (e.g. KPI card, nav item, quote panel) driven by **design tokens** (type ramp, spacing, radius, color roles).
- **Schema evolution** — Optional section-aware layouts with slot fallback for migration.
- **Overflow** — Per-slot or per-component policies (ellipsis, clamp, compact variants).

Rules of thumb: change **tokens/components** before ad-hoc geometry; every new template documents hierarchy, tokens, overflow, and low-priority removable elements.

## End-to-end data flow (canvas AI layout)

```
User prompt → frontend builds element snapshot
  → POST /ai/layout
  → backend calls OpenAI, validates with Zod
  → backend writes moves/creates into the room’s Yjs map (via server Y.Doc)
  → y-websocket broadcasts CRDT updates
  → clients apply to Fabric (bulk updates may animate)
```

## Technology choices (why)

- **Yjs** — CRDT merges concurrent human and AI edits; single source of truth.
- **Fabric.js** — Rich object model and serialization paths suited to canvas tooling and AI snapshots.
- **Express + long-lived WebSocket server** — Same process holds REST and `/yjs`; avoids serverless limitations for persistent sync.
- **OpenAI on the server** — Protects API keys; validates output before touching Yjs.

## LLM layout prompt strategy (summary)

The layout service sends structured canvas JSON plus the user instruction; the model returns a constrained plan (moves/creates). **Zod** validates before application. Optional **conversation history** per room (`conversationStore`) supports multi-turn layout. Exact prompt text lives in backend services/prompts.

## Interview talking points

- Yjs vs raw WebSocket state — convergence and AI writes on the same CRDT.
- Fabric vs lighter canvas libs — object model and serialization for LLM pipelines.
- Server-side LLM — keys, validation, single sync path into Yjs.
- Mapping to Moda — render surface + collaborative doc + agentic edits.

## Outreach reference

**John Holliman** — Co-Founder & CTO at Moda. LinkedIn is a practical channel; short message with repo link and role reference.
