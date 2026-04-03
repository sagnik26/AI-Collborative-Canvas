# HTTP APIs, AI, and streaming

## Express application

- **What**: `createApp` wires CORS, JSON body parsing, and route registration.
- **Where**: `packages/backend/src/transport/http/createApp.ts`, `routes.ts`.

## REST endpoints (current)

| Method | Path | Role |
|--------|------|------|
| `GET` | `/health` | Liveness check |
| `POST` | `/ai/layout` | Non-streaming layout plan from OpenAI; server applies to Yjs |
| `POST` | `/ai/compose-template` | **NDJSON** stream of template composition events |

## Zod schemas

- **What**: Runtime validation and typed parsing for HTTP bodies and streamed JSON lines.
- **Where**: `packages/backend/src/schemas/*` (e.g. `aiLayoutSchemas`, `templateComposeSchemas`, stream event schemas).

## AI layout pipeline

1. **Client** builds `AiLayoutElement[]` from Fabric + Yjs records (`buildAiLayoutElementsFromCanvas`).
2. **POST** `/ai/layout` with instruction, canvas dimensions, room/doc ids, and elements.
3. **Server** loads optional **conversation history** per `roomId` (`conversationStore`) to give the model multi-turn context.
4. **OpenAiLayoutService** calls OpenAI with structured prompts; response is parsed/validated.
5. **YjsCanvasApplyService** applies **moves** (update `left`/`top` on existing map entries) and **creates** (new ids + records) inside the live `Y.Doc` for that room.
6. **All clients** receive CRDT updates over `/yjs` and animate if the change is bulk.

## Conversation store

- **What**: In-memory rolling history keyed by canvas room id; pairs user instruction text with assistant output for subsequent layout calls.
- **Where**: `packages/backend/src/services/conversationStore.ts`.

## Template composition pipeline (streaming)

1. **Client** calls `streamTemplateCompose` → `fetch` to `/ai/compose-template` with prompt + allowed template ids (+ optional brand hints).
2. **Server** sets **NDJSON** headers (`application/x-ndjson`), flushes periodically, streams events from `OpenAiTemplateComposeService`.
3. **Client** reads the body with `ReadableStream` + `TextDecoder`, splits on newlines, parses JSON per line, validates event shape.
4. **Events** include `template_selected`, `field_patch`, `complete`, `error` (see `TemplateComposeEvent` type).
5. **Client** applies each valid patch into Yjs (`meta` + `fields` maps) inside `ydoc.transact`, with validation from `validateTemplatePatch`.

## NDJSON (newline-delimited JSON)

- **What**: One JSON object per line; ideal for incremental HTTP streaming without a single huge JSON payload.
- **Why**: UX for “typing in” template content; easier to flush proxies than chunked opaque binary.

## AbortController

- **What**: Cancels fetch/stream when the user navigates away or the HTTP connection closes; wired in `templateComposeController` and the frontend compose client.

## API key handling

- **Concept**: Keys stay **server-side** for layout/compose; optional Bearer header override for local experiments (`openAiAuth.ts`).

## Theme rotation / pack policy (compose)

- **Supporting concepts**: Backend utilities constrain which templates/themes the model may pick (`templatePackPolicy`, `templateThemeRotation`, registry constants) so streamed selections stay within product allowlists.
