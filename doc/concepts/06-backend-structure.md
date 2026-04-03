# Backend layering concepts

## Entrypoint

- **`index.ts`**: Loads env, creates `http.Server`, registers Yjs persistence with `setPersistence`, constructs `YjsCollabService`, attaches `/yjs` WebSocket, listens on `PORT`.

## Transport layer (`transport/`)

- **HTTP**: `createApp` + `registerRoutes` — only wiring; no business rules.
- **WebSocket**: `attachYjsWebsocket` creates `ws` `WebSocketServer` on path `/yjs` and delegates connections to `createYjsWsController`.

## Controllers (`controllers/`)

- **Role**: Parse/validate input (often with Zod `safeParse`), call services, write HTTP responses.
- **Examples**: `aiLayoutController`, `templateComposeController`, `healthController`, `yjsWsController` (thin pass-through to `YjsCollabService`).

## Services (`services/`)

- **Role**: Orchestrate domain behavior — OpenAI calls, apply layout to Yjs, compose streaming generation, collaboration helpers.
- **Examples**:
  - `OpenAiLayoutService` — prompt + model call for canvas layout.
  - `YjsCanvasApplyService` — mutate server-side `Y.Map` for a given doc name.
  - `OpenAiTemplateComposeService` — async iterable of compose events.
  - `YjsCollabService` — doc name resolution + `setupWSConnection`.
  - `conversationStore` — ephemeral chat history for layout.

## Repositories (`repositories/`)

- **Role**: Persistence abstraction; today **in-memory** only.
- **`InMemoryDocRepository`**: `load` / `save` Yjs update bytes per doc name.
- **`YjsPersistenceRepository`**: Adapts `DocRepository` to `y-websocket` persistence interface.

## Types and schemas (`types/`, `schemas/`)

- **`types/`**: TS contracts for layout results, AI DTOs, template compose, canvas theme, repositories, etc.
- **`schemas/`**: Zod definitions mirroring HTTP and stream payloads.

## Utils (`utils/`)

- **Role**: Small pure or infrastructure helpers — OpenAI auth, canvas record builders, NDJSON emitters, template pack policy, theme rotation.

## Constants (`constants/`)

- **Role**: Server-side registry of allowed template packs and related static configuration.

## Dependency direction

```
transport → controllers → services → (repositories, utils, OpenAI SDK)
```

Keep Express and `ws` types out of services where possible; controllers adapt `Request`/`Response` to plain inputs.
