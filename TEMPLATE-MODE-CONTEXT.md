# Template Mode Context

This document defines the execution context for moving `/design` to a template-first architecture with deterministic rendering and Yjs-compatible collaboration.

## Goal

Replace free-form coordinate generation for design mode with:

1. Template definition (layout skeleton)
2. Data binding (semantic fields only)
3. Deterministic render projection to canvas objects
4. Yjs-shared template state for multi-user collaboration

The architecture is delivered in two phases.

---

## Phase A: Template + Mock Stream (No LLM)

### Outcome

On `/design/editor`, users can see a template rendered in canvas from mock streamed data that simulates LLM output. Layout is deterministic and stable.

### A1. Contracts (freeze first)

Define and version:

- `TemplateSchema`: slot layout skeleton and constraints
- `TemplateFieldsSchema`: semantic content fields only
- `TemplatePatchSchema`: partial field updates for streaming
- `schemaVersion`: explicit version key for migration safety

### A2. Template Pack v1

Create one initial template as a landing-page style layout (inspired by modern landing patterns such as Landbook), while preserving deterministic structure:

- Hero section (headline, subheadline, primary/secondary CTA)
- Social proof strip (logo placeholders)
- Horizontal step pills with connectors
- Bottom math callout box
- Final CTA strip

Template v1 should be expressed as deterministic sections and semantic fields, for example:

- `hero`: headline, subheadline, CTA labels, optional hero visual placeholder
- `socialProof`: title + logo slots
- `steps`: pill titles + optional one-line descriptions
- `mathCallout`: title, formula/value line, footnote
- `finalCta`: closing headline + CTA label

Each slot must include:

- Bounds (`x`, `y`, `w`, `h`) in artboard-local coordinates
- Type (`text`, `pill`, `box`, `connector`, etc.)
- Content constraints (`maxChars`, `maxLines`)
- Overflow behavior (`wrap`, `ellipsis`, `clip`)

### A3. Deterministic Renderer

Implement a pure renderer:

`renderTemplate(template, fields, theme, page) -> CanvasObjectRecord[]`

Rules:

- No randomness
- No dependence on viewport transform
- Stable object IDs per slot (e.g. `slot:title`, `slot:pill:1`)
- All objects clamped inside artboard bounds

### A4. Yjs-First State Model

Use Yjs as source of truth for semantic state:

- `templateMeta` map: `templateId`, `theme`, `status`, `version`
- `templateFields` map: slot field values

Canvas objects are projection output, not the collaborative source of truth.

### A5. Reconciliation Loop

On Yjs state changes:

1. Render deterministic object set
2. Diff by stable slot IDs
3. Create/update/remove objects accordingly

### A6. Mock Streaming Adapter

Simulate LLM chunking via timed patches:

1. template metadata + header
2. steps/pills
3. math box details
4. complete

Each patch is schema-validated before applying to Yjs.

### A7. `/design` Integration

Add template mode path in `/design` and `/design/editor`:

- Start template mode with Template v1 + empty/default fields
- Trigger mock stream/replay
- Render updates incrementally in canvas

### A8. Observability & Guardrails

Add developer diagnostics:

- Patch count
- Missing fields
- Slot overflow/truncation warnings
- Current template ID and status

### A9. Phase A Exit Criteria

- Deterministic output on replay/reset
- No scattered/out-of-bounds objects
- Stable rendering across collaborators via Yjs
- Visual consistency across page reloads

---

## Phase B: LLM Integration

### Outcome

Swap mock stream source with real LLM while keeping the same contracts and renderer.

### B1. Backend Compose Endpoint

Add endpoint:

- `POST /ai/compose-template`

Input:

- Prompt
- Template candidates/options
- Optional brand/theme hints

Output:

- Structured template payload or stream patches
- No raw coordinates

### B2. Prompt & Schema Discipline

Model instructed to:

- Fill semantic fields only
- Respect field constraints
- Never emit geometry/coordinates

Server validates all output against strict schemas.

### B3. Streaming Protocol

Use patch event types:

- `template_selected`
- `field_patch`
- `complete`
- `error`

Frontend consumes the same patch interface used in Phase A mock mode.

### B4. Reliability

- Reject invalid patches
- Keep last-known-good state
- Retry or repair malformed chunks server-side
- Deduplicate patches by operation IDs when needed

### B5. Collaborative Correctness

AI writes patches through the same Yjs maps as human edits, so collaboration behavior remains consistent.

### B6. Safety Constraints

Enforce server-side limits:

- Max lengths
- Sanitization of text payloads
- Enum and schema constraints

### B7. Evaluation

- Prompt fixtures with schema assertions
- Visual regression snapshots
- Stream success/error metrics

### B8. Phase B Exit Criteria

- Real LLM generation produces stable template compositions
- Invalid model output never corrupts shared canvas state
- Collaboration remains consistent during generation

---

## Non-Goals (Current Scope)

- Multi-template marketplace
- Freeform AI geometry synthesis in design mode
- Advanced animation/tween rendering

---

## Guiding Principle

In design mode, coordinates come from templates, not the model.
The model provides content, not layout geometry.
