# Template Canvas Production Context

## Goal

Make generated template pages look production-ready (like polished dashboard/editorial docs), while keeping:

- LLM responsible for content fill and template choice.
- Fabric renderer responsible for deterministic structure, spacing, hierarchy, and visual consistency.

## What exists today

- `TemplateCanvasShell` streams compose events and renders into Fabric.
- `slotToFabricObject` currently builds generic primitives:
  - text, pill, box, connector, logo, cta
- Template packs (`templatePackV1` + `templateSchemas`) define slot geometry.
- Overflow protections exist but are still mostly generic.

## Why quality still feels non-production

- Primitive-only rendering cannot reproduce UI systems from reference templates.
- Layout uses absolute slots without semantic section structure.
- No component-specific visual grammar (KPI cards, info list rows, quote panel, footer meta).
- Typography and spacing are not tokenized enough for repeatable consistency.

## Target architecture

### 1) Componentized Fabric library

Add semantic render paths in `slotToFabricObject`:

- `kpiCard`
- `navItem`
- `topTab`
- `statChip`
- `infoListItem`
- `quoteCard`
- `footerMeta`
- `barChartPanel` (plus optional `sparkline`)

Each component should be deterministic and theme-token driven.

### 2) Design tokens (single source of visual truth)

Create template design tokens:

- Type ramp: `display`, `h1`, `h2`, `body`, `caption`, `meta`
- Spacing scale: `2, 4, 8, 12, 16, 20, 24...`
- Radius tiers: `sm, md, lg, xl, pill`
- Elevation/shadows: `none, low, medium`
- Color roles: `surface`, `surfaceAlt`, `primary`, `accent`, `muted`, `border`, `textStrong`, `textMuted`

### 3) Schema evolution (v2)

Introduce section-aware schema on top of slots:

- `header`
- `kpiRow`
- `mainSplit`
- `footer`

Keep slot fallback for backward compatibility while migrating templates incrementally.

### 4) Overflow policy per slot/component

Per component strategy:

- clamp lines
- ellipsis
- compact variant switch
- hide low-priority child items when collision remains

## Implementation plan

### Phase A - Foundation

1. Add `templateDesignTokens.ts`.
2. Extend slot/component typing for semantic component kinds.
3. Refactor `slotToFabricObject` to dispatch by semantic type.

### Phase B - Landing parity

1. Apply same component system to `landing.v1`.
2. Remove one-off geometry hacks once component slots stabilize.

## Rules for future template additions

- Never add raw coordinates without a section intent note.
- Every new template must define:
  - section hierarchy
  - token set used
  - overflow behavior
  - low-priority removable elements
- Visual changes should happen in token/component layer before geometry tweaks.

## Definition of done

- Generated output matches reference structure within +/- 5% relative proportions.
- No text collisions at default generated lengths.
- Empty optional items do not render as blank placeholders.
- Templates remain editable/draggable in Fabric and collaborative via Yjs.

