# Repository and runtime concepts

## Monorepo (pnpm workspace)

- **What**: A single repository with multiple packages under `packages/*`, orchestrated by the root `package.json` scripts.
- **Why**: Clear separation between browser UI (`packages/frontend`) and long-lived Node server (`packages/backend`) while sharing tooling (TypeScript, Prettier, Nx).
- **Where**: `pnpm-workspace.yaml`, root `package.json`.

## Package manager: pnpm

- **What**: Fast, content-addressable installs with strict dependency isolation via symlinks.
- **In this repo**: Workspace protocol links packages; `pnpm dev` runs frontend and backend concurrently.

## Nx

- **What**: Monorepo task runner / build graph tooling (listed in root devDependencies).
- **Use here**: Optional orchestration alongside plain `pnpm` scripts; see root `package.json` for the commands actually used day-to-day.

## ECMAScript modules (ESM)

- **What**: Native `import`/`export`; Node runs packages with `"type": "module"` where configured.
- **Why it matters**: Relative imports in frontend often use explicit `.ts`/`.tsx` extensions to satisfy bundler + editor resolution (see workspace rules).

## Frontend runtime: Vite + React

- **Vite**: Dev server and production bundler for the SPA; fast HMR during development.
- **React**: UI library; route-level pages compose “shell” components that wire Yjs, Fabric, or template state.
- **React Router**: Declares routes in `packages/frontend/src/App.tsx` (`/design`, `/design/editor`, `/canvas`, etc.).

## Backend runtime: Node + `http.Server`

- **What**: A single Node process creates an HTTP `Server`, attaches Express for REST, and attaches a WebSocket server on path `/yjs` for collaboration.
- **Where**: `packages/backend/src/index.ts`.

## Environment configuration

- **Backend**: `dotenv` loads `packages/backend/.env` (e.g. `OPENAI_API_KEY`, `PORT`).
- **OpenAI auth**: API key from env or `Authorization: Bearer` header (see `getOpenAiApiKey` in backend utils).

## Cross-package rule

- **No deep cross-imports** between frontend and backend packages; contracts are duplicated or implied via HTTP/WS payloads and shared naming — not shared TypeScript packages in this layout.
