# Concepts — table of contents

The **[root README.md](../../README.md)** is the **canonical, production-style** project spec (architecture, APIs, data flows, structure, operations). The files below split that material by topic for smaller edits and reviews.

Each file groups related ideas so you can read linearly or jump by topic.

| # | File | Topics |
|---|------|--------|
| 1 | [01-repository-and-runtime.md](./01-repository-and-runtime.md) | pnpm workspace, Nx, ESM, Vite, React Router, package boundaries |
| 2 | [02-collaboration-and-yjs.md](./02-collaboration-and-yjs.md) | CRDTs, `Y.Doc`, `Y.Map`, rooms/doc names, `y-websocket`, persistence, idempotency |
| 3 | [03-canvas-fabric-and-binding.md](./03-canvas-fabric-and-binding.md) | Fabric.js, `CanvasObjectRecord`, serialization, Fabric↔Yjs binding, viewport |
| 4 | [04-http-ai-and-streaming.md](./04-http-ai-and-streaming.md) | Express, CORS, Zod, OpenAI, AI layout, NDJSON streaming, abort signals |
| 5 | [05-template-domain.md](./05-template-domain.md) | Template packs, schema/slots, fields, themes, rendering, compose stages |
| 6 | [06-backend-structure.md](./06-backend-structure.md) | Transport vs controllers vs services vs repositories |
| 7 | [07-frontend-structure.md](./07-frontend-structure.md) | Pages, shells, libs vs components, types/constants |
| 8 | [08-glossary.md](./08-glossary.md) | A–Z quick reference of terms used across the codebase |
