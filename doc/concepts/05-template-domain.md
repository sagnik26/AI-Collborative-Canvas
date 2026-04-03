# Template domain concepts

## Template pack

- **What**: A versioned bundle describing one commercializable layout: **schema** (page size + slots), optional **fixtures**, and integration with the **template registry** (valid ids and themes).
- **Where**: `packages/frontend/src/libs/template/templatePacks.ts`, `templatePackV1.ts`, constants under `constants/`.

## `TemplateId` and `TemplateTheme`

- **What**: Stringly-typed ids (e.g. `landing.v1`) and allowed **theme** names per id, derived from `TEMPLATE_THEMES_BY_PACK` in `templateRegistry`.
- **Why**: Central allowlist for UI, compose streaming validation, and AI policy on the backend.

## `TemplateSchema`

- **What**: Declares `schemaVersion`, `templateId`, page dimensions, and an array of **slots**.
- **Where**: `packages/frontend/src/types/template.ts`.

## Slot

- **What**: A rectangular region with a `type` (`text`, `pill`, `box`, `connector`, `logo`, `cta`), geometry (`x`, `y`, `w`, `h`), optional typography constraints (`maxChars`, `maxLines`, `overflow`), and optional `componentKind` for specialized components.
- **Role**: The bridge between **data** (`TemplateFields`) and **rendering** (Fabric objects).

## `TemplateFields`

- **What**: A single shared field model across packs (headline, CTAs, logos array, steps array, math block, final CTA, etc.).
- **Why**: AI can stream patches against one shape; packs differ by **which slots bind** to which keys, not by divergent TS types.

## `TemplateMeta`

- **What**: `templateId`, `theme`, `status` (`idle` | `streaming` | `complete` | `error`), and schema version — stored in Yjs for multi-user consistency.

## `TemplatePatch` and compose stages

- **What**: Validated partial updates with `opId`, `stage` (`meta_header`, `steps`, `math`, `complete`), optional `meta` and `fields`.
- **Stages**: Drive the timeline UI (`templateComposeStages`, `ComposeStreamTimeline`) and idempotent `done:<stage>` keys in the `stream` map.

## Rendering pipeline

- `**renderTemplate` / `renderTemplateWithDiagnostics`**: Given schema + fields + theme, produces `CanvasObjectRecord[]` plus overflow warnings.
- **Design tokens**: `templateDesignTokens.ts`, `templateLandingPalettes.ts` map slot ids / themes to colors and typography.
- `**slotToFabricObject`**: Converts slot geometry + tokens into Fabric-ready structures (large, central file under `Design System/`).

## Design landing page (`DesignShell`)

- **What**: Marketing-style entry with **prompt chips** that prefill a prompt and optionally narrow **template candidates** passed into the editor via query string + navigation state.

## Template editor shell (`TemplateEditorShell`)

- **What**: Connects Yjs (`meta`, `fields`, `stream` maps), kicks off compose streaming, observes maps into React state, renders the scaled “page” UI, and shows stream progress.

## Template canvas shell (`TemplateCanvasShell`)

- **What**: Fabric-first template surface (when used) — pairs template layout with Fabric viewport helpers (`templateFabricViewport`, `templateFabricViewLayout`).

## Document id (`docId`)

- **What**: Client-generated id for a collaborative template session, passed as `?doc=` so multiple users can share one Yjs room.

## Contracts module

- **What**: Default factories (`createDefaultTemplateMeta`, `createDefaultTemplateFields`), patch validation (`validateTemplatePatch`), and map readers (`readTemplateMetaFromMap`, `readTemplateFieldsFromMap`).
- **Where**: `packages/frontend/src/libs/template/contracts.ts`.

## Fallbacks

- **What**: `templateFieldFallbacks` ensures empty or invalid field strings degrade gracefully for display.

## Mock stream

- **What**: `mockStream.ts` supports offline/dev demonstration of NDJSON stages without calling the backend.

