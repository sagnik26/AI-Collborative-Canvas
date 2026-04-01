# Template packs & compose — engineering context

This file supplements the root `**CONTEXT.md**` (Moda Canvas proof-of-work narrative). It describes **this repo’s** pnpm layout, the template compose pipeline, and the **phased roadmap** for multiple template packs with LLM selection.

---

## Repository layout (pnpm workspace)

- **Root:** `package.json`, `pnpm-workspace.yaml`, orchestration scripts.
- `**packages/frontend`** — Vite + React; template editor, Yjs client, canvas integration under `src/`.
- `**packages/backend**` — Node + Express; HTTP routes including template compose; Yjs websocket attachment under `src/transport/`.

Run locally: `pnpm dev` (frontend + backend). Shared types live **inside each package**; keep contracts aligned manually or via a future shared package.

---

## Template system (current state)

### Concepts

- **Template pack** — A fixed `TemplateSchema`: `templateId`, `page` size, and `slots` (geometry, `maxChars`, types). Layout is **deterministic code**, not LLM output.
- **Template fields** — Copy-shaped data (`TemplateFields`: hero strings, `logos`, `steps`, math, final CTA). Persisted in Yjs (`templateFields` map).
- **Template compose** — `POST /ai/compose-template` streams **NDJSON** lines: `template_selected` → `field_patch` (partial) → server-emitted `complete`. The model must not emit coordinates.

### Key files


| Area                              | Path                                                            |
| --------------------------------- | --------------------------------------------------------------- |
| Slot layout (landing)             | `packages/frontend/src/libs/template/templatePackV1.ts`         |
| TS types                          | `packages/frontend/src/types/template.ts`                       |
| Yjs read/write helpers            | `packages/frontend/src/libs/template/contracts.ts`              |
| Compose HTTP client               | `packages/frontend/src/libs/template/composeTemplateClient.ts`  |
| Editor + Yjs + stream             | `packages/frontend/src/components/TemplateEditorShell.tsx`      |
| Zod / API events                  | `packages/backend/src/schemas/templateComposeSchemas.ts`        |
| OpenAI stream + repair + gap fill | `packages/backend/src/services/OpenAiTemplateComposeService.ts` |
| Prompts                           | `packages/backend/src/prompts/templateComposePrompt.ts`         |
| Route handler                     | `packages/backend/src/controllers/templateComposeController.ts` |


### Request gate for LLM choice

- `templateComposeRequestSchema` includes `templateCandidates: templateId[]` (min 1, max 4).
- The model’s `template_selected.templateId` must be in that list or the server rejects it.
- **Gap:** the editor still hardcodes one pack for rendering and often one candidate in the client; multi-pack work closes that.

### Streaming / architecture notes

See `**TEMPLATE-COMPOSE-FUTURE-TODO.md`** for follow-ups (SSE, repair deprecation, single JSON vs NDJSON, etc.).

---

## Roadmap: multiple template packs + LLM selection

**Goal:** Register many packs (`templateId` → `TemplateSchema` + rules). Each compose request passes an allowlist (`templateCandidates`). The LLM picks one id from that list and fills fields; layout stays deterministic.

**Principles**

1. Geometry and slot definitions live only in frontend pack modules (and any future shared registry).
2. Backend validates `templateId` / `theme` against Zod enums and `req.templateCandidates`.
3. Field completeness and gap-fill (`missingFieldGroups`, `chunkForGroup`, repair JSON schema) must eventually be **per-pack** or per family of packs—not only `landing.v1`.

---

### Phase 0 — Decisions


| Decision    | Options                                                                                                                                                                   | Note                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Field model | **A:** Single shared `TemplateFields` for all packs (fastest; new packs reuse keys, different slots). **B:** Per-pack field shapes + Zod discriminated unions (scalable). | Prefer **A** until a pack needs different keys; then introduce **B**.                         |
| Themes      | One theme per pack vs shared theme for multiple layouts.                                                                                                                  | Whatever you choose must extend `templateThemeSchema` and repair/stream prompts consistently. |


**Exit:** Chosen field strategy and theme rules documented in PR or ticket.

---

### Phase 1 — IDs and registry (frontend)

1. Extend `TemplateSchema['templateId']` in `packages/frontend/src/types/template.ts` to a union of all pack ids.
2. Add new pack module(s), e.g. `templatePackPitchV1.ts`, same structural pattern as `templatePackV1.ts`.
3. Add `templatePacks.ts` (or similar): `TEMPLATE_PACKS: Record<TemplateId, TemplateSchema>` and `getTemplatePack(id)` with explicit fallback or error for unknown ids.
4. `**TemplateEditorShell.tsx`** — Replace hardcoded `LANDING_TEMPLATE_V1` in `renderTemplateWithDiagnostics` with `getTemplatePack(normalizedMeta.templateId)`.
5. `**readTemplateMetaFromMap**` in `contracts.ts` — Allowlist every known `templateId` (today only `landing.v1` is accepted as non-default).

**Exit:** Changing `templateId` in Yjs meta switches rendered layout without code changes at the call site.

---

### Phase 2 — API contracts (backend)

1. Expand `templateIdSchema` in `templateComposeSchemas.ts` (`z.enum([...])`).
2. Expand `templateThemeSchema` if new themes are introduced.
3. Keep `templateCandidates` typed from `templateIdSchema`; adjust max length if product requires.
4. `**OpenAiTemplateComposeService.requestRepairCompose`** — Update OpenAI `json_schema` enums for `templateId` and `theme` to match new values (strict repair must not emit unknown ids).

**Exit:** Invalid ids fail at parse time; repair cannot invent ids outside the schema.

---

### Phase 3 — Field completeness per pack (backend)

Today `missingFieldGroups`, `chunkForGroup`, `sanitizeFullFields`, and progressive chunking assume **landing-shaped** fields.

1. Extract a **pack policy** module (e.g. `templatePackPolicy.ts` or equivalent under `services/`): per `templateId`, define required groups, chunk builders, and sanitization (or one policy shared by a “landing family”).
2. `**composeStream`** — After merging patches into `accumulated`, compute gaps using **selected** `templateId` (from `template_selected` or validated JSON fallback).
3. `**emitGapPatchesFromSafe`** — Emit chunks according to that pack’s policy.
4. **JSON fallback / `templateComposeModelResponseSchema`** — If using Option B, split or union schemas per pack; if Option A, keep one schema.

**Exit:** Each registered pack has correct completeness checks and gap-fill after repair.

---

### Phase 4 — Prompts and client

1. `**templateComposePrompt.ts`** — For each candidate id, add a short line of intent (e.g. when to prefer `landing.v1` vs `pitch.v1`) so selection is grounded.
2. `**composeTemplateClient.ts**` — Remove assumptions of a single hardcoded `templateId`; send the same `templateCandidates` the UI uses.
3. `**TemplateEditorShell.tsx**` — Pass `templateCandidates` from config, props, or route (start with a shared constant listing allowed packs for the session).

**Exit:** UI and API always share the same allowlist for a given compose.

---

### Phase 5 — Tests and hardening

1. **Unit:** `getTemplatePack`, `readTemplateMetaFromMap` for new ids, Zod parsing of `templateCandidates` on the backend.
2. **Integration (optional):** Mock NDJSON stream with `template_selected` for pack B and minimal patches; assert `complete` and no post-repair incompleteness when policy is satisfied.
3. **Collaboration:** Two clients: after sync, same `templateId` and layout.

**Exit:** Regressions on id allowlist and registry resolution are caught in CI.

---

### Phase 6 — Documentation touch-up

1. Add a short “Adding a pack” checklist to `**TEMPLATE-COMPOSE-FUTURE-TODO.md`** or keep this file as source of truth: new id → schema file → registry → Zod enums → pack policy → prompt blurb → client candidates.

**Exit:** Next contributor can add a pack without reverse-engineering the stream.

---

## Suggested implementation order

1. Phase 1 (registry + editor + `readTemplateMetaFromMap`) — visible, lower risk.
2. Phase 2 (backend enums + repair schema) + second pack file using shared fields (Option A).
3. Phase 3 (refactor compose service into per-pack or per-family policy).
4. Phase 4 (prompts + client + shell candidates).
5. Phase 5 (tests).
6. Phase 6 (doc cross-links).

---

## Risks and mitigations


| Risk                                                      | Mitigation                                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Old Yjs documents with unknown `templateId`               | Default pack in `getTemplatePack` or one-time migration writing `landing.v1`.                                |
| Shared `TemplateFields` stretched across dissimilar packs | Move to Phase 0 Option B (per-pack schemas) before layouts diverge too far.                                  |
| Drift between frontend pack ids and backend `z.enum`      | Single source of truth: generate or manually sync lists; add a comment in both places pointing to the other. |


