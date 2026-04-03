# Frontend structure concepts

## Entry and routing

- **`main.tsx`**: React root mount.
- **`App.tsx`**: `Routes` under `AppLayout` — `/design`, `/design/editor`, `/design/visual-regression`, `/canvas`.

## Layout component

- **`AppLayout`**: Shared chrome (navigation, wrappers) for routed pages.

## Pages (`pages/`)

- **Thin route targets** that render a shell: `DesignPage`, `TemplateEditorPage`, `CanvasPage`, `TemplateVisualRegressionPage`.

## Shells (`components/`)

- **`DesignShell`**: Pre-editor prompt UX; generates `docId`, navigates to editor with query params.
- **`TemplateEditorShell`**: Yjs-backed template composition + rendered page preview + timeline.
- **`TemplateCanvasShell`**: Fabric-oriented template editing surface when that mode is active.
- **`CanvasShell`**: Full collaborative Fabric editor + AI layout prompt bar + tools.
- **`FabricCanvas`**: Reusable canvas host (sizing, ref to Fabric instance).

## Libraries (`libs/`)

- **`libs/canvas/`**: Fabric factories, Yjs binding, viewport, template viewport/layout helpers, Fabric records.
- **`libs/ai/`**: `aiLayoutClient` — builds request payloads and POSTs to `/ai/layout`.
- **`libs/template/`**: Contracts, compose client, rendering, Yjs map helpers, doc ids, packs, schemas, stages, field fallbacks.

## Types (`types/`)

- Cross-cutting TS types: canvas records, Yjs binding interfaces, AI DTOs, template domain, editor props, prompts.

## Constants (`constants/`)

- Central numbers and registries: canvas mins, template schema version, design prompt chips, template packs, render base sizes.

## Design System folder

- **`Design System/`** (historical naming with space): palette tokens, fixtures, slot rendering, large `slotToFabricObject` implementation.

## Styling

- **CSS modules** beside shells (`*.module.css`) for scoped layout and theme.

## State management philosophy

- **Collaborative state**: Prefer **Yjs** as source of truth for multi-user features.
- **Local UI state**: React `useState` / refs for tooling, selection, loading flags, and derived layout (e.g. page scale).

## Networking defaults

- **Hard-coded localhost URLs** for API and WS in shells/clients (documented in root README as future env improvement).

## Prompt UX (`PromptBar`, `prompt` types)

- **Concept**: Chat-style transcript and submission for canvas AI layout; separate from template compose (which streams from `/ai/compose-template`).
