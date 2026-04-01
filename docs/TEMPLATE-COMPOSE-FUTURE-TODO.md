# Template compose — future implementation / enhancements

This doc tracks follow-ups for `/ai/compose-template`, streaming, and template editor UX. Current behavior is intentionally pragmatic; items below are for a cleaner long-term design.

## Architecture / protocol

- [ ] **Choose a primary contract** and document it in one place:
  - **Option A — Single structured response**: one `response_format: json_schema` completion, validate once, return JSON (or emit NDJSON/SSE events server-side from that single object for UI animation only).
  - **Option B — Server-owned multi-step streaming**: backend drives phases (e.g. hero → social → steps → math → final); each phase is a small schema-bound model call or a strict parser; never depend on the model printing raw NDJSON lines.
- [ ] **Deprecate or isolate “repair”**: today a second non-streaming call runs when the streamed NDJSON path yields no usable patches. Make this explicit (feature flag / metric) or remove once Option A or B is stable.
- [ ] **SSE vs NDJSON**: decide transport (`text/event-stream` vs `application/x-ndjson`) for *client* streaming; keep semantics identical (event types: `template_selected`, `field_patch`, `complete`, `error`). SSE does not fix model reliability by itself.
- [ ] **POST + streaming**: if using SSE, use `fetch` + `ReadableStream` (or a thin wrapper); `EventSource` is GET-only unless you add a separate GET stream endpoint.

## Model streaming (honest behavior)

- [ ] **Stop requiring NDJSON inside chat token deltas** as the main path; it is fragile (partial lines, markdown, prose).
- [ ] If token-level streaming is required: define how **server maps deltas → events** (e.g. only emit after validated segments), or use **multiple short completions** per section.
- [ ] **Remove or gate artificial stagger** (`TEMPLATE_COMPOSE_PATCH_STAGGER_MS`): replace with client-side progressive reveal if the goal is UX only, or with real incremental server events if the goal is true streaming.

## Product / template selection

- [ ] **Multiple `templateCandidates`**: extend `templateIdSchema` and frontend registry so the model’s `template_selected` is meaningful (today often only `landing.v1`).
- [ ] **Map `templateId` → template pack + fields schema** on the frontend (and validate on the server).

## Reliability & observability

- [ ] **Structured logging**: log stream outcome (`ndjson_ok`, `fallback_json`, `repair_used`, `error_reason`) without logging full prompts in production.
- [ ] **Metrics**: count repair invocations, time-to-first-patch, time-to-complete, validation failures.
- [ ] **Timeouts and cancellation**: ensure OpenAI stream and repair both respect `AbortSignal` and client disconnect consistently.

## Frontend

- [ ] **Align loading states** with chosen protocol: if switching to single JSON response, simplify `TemplateEditorShell` (one loading phase + optional local stagger animation).
- [ ] **Avoid double sources of truth**: Yjs `templateFields` vs preview; document when defaults are empty vs streaming vs complete.

## Testing

- [ ] **Contract tests**: golden fixtures for request/response and NDJSON/SSE event sequences.
- [ ] **Integration tests**: mock OpenAI (stream and non-stream) to assert controller emits expected events and does not corrupt state on invalid output.

---

*Last updated: created for deferred cleanup of compose streaming / repair / transport choices.*
