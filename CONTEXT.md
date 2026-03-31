# Moda Canvas — Proof of Work

## What Is This

A collaborative AI canvas prototype built as a proof-of-work for the **Founding Engineer** role at [Moda](https://moda.app). Moda is an AI design agent with brand memory, backed by General Catalyst ($7.5M seed), building a collaborative canvas where AI agents produce brand-aligned, editable design output.

This prototype demonstrates the three core engineering challenges Moda's product solves:

1. **Real-time collaborative canvas** — Multiple users editing simultaneously with conflict-free convergence
2. **CRDT-based state management** — Using Yjs for production-grade distributed state (not naive last-write-wins)
3. **AI-driven layout intelligence** — Natural language prompts that rearrange canvas elements via LLM reasoning

## Architecture Overview

```
moda-canvas/
├── apps/
│   ├── canvas-fe/          # Vite + React + Fabric.js + Yjs
│   └── canvas-be/          # Node.js + Express + y-websocket + Claude API
├── libs/
│   ├── shared-types/       # CanvasElement, AILayoutRequest, AILayoutResponse
│   ├── shared-prompts/     # LLM system prompt templates
│   └── shared-utils/       # Zod validation, serialization helpers
├── CONTEXT.md              # This file
└── nx.json                 # Nx workspace config
```

### Data Flow

```
User prompt → canvas-fe serializes Yjs doc to JSON
  → POST /ai/layout to canvas-be
  → canvas-be calls Claude API with elements + instruction
  → Claude returns new {id, x, y} coordinates
  → canvas-be writes new positions into Yjs document
  → y-websocket broadcasts CRDT update to all clients
  → canvas-fe animates elements to new positions (Fabric.js animate, 300ms)
```

### Why These Technology Choices

**Yjs (not raw WebSocket state passing):**
Raw WebSocket diffing creates last-write-wins race conditions under real concurrency. Yjs is a CRDT library used by Notion, Jupyter, and Hocuspocus. When the AI returns new positions, those writes participate in the same CRDT merge as human edits — single source of truth with zero custom conflict resolution.

**Fabric.js (not Konva):**
Native JSON serialization with `canvas.toJSON()` / `canvas.loadFromJSON()`. This is critical for the AI pipeline — we serialize full canvas state to send to the LLM. Fabric also has a richer object model (grouping, clipping, transformation matrices) that maps to how design tools work.

**Separate Express + y-websocket (not Next.js):**
WebSocket connections need a long-lived process. Next.js API routes on Vercel are serverless (spin up/die per request), which is fundamentally incompatible with persistent WebSocket state. The server holds both REST endpoints and WebSocket connections in the same process.

**Claude API for layout reasoning:**
The LLM receives canvas state as a flat JSON array of elements and a natural language instruction. It returns new coordinates. The system prompt constrains output to strict JSON. We validate the response with Zod before writing to the CRDT.

## Shared Types Contract

These are the core interfaces in `shared-types` that both apps import:

```typescript
// The atomic unit on the canvas
interface CanvasElement {
  id: string
  type: 'rect' | 'text' | 'circle' | 'image'
  label: string
  x: number
  y: number
  width: number
  height: number
  fill: string
  rotation: number
  zIndex: number
}

// What we send to the AI endpoint
interface AILayoutRequest {
  elements: CanvasElement[]
  instruction: string         // Natural language: "arrange in a 2x2 grid"
  canvasWidth: number
  canvasHeight: number
}

// What Claude returns (validated by Zod)
interface AILayoutResponse {
  elements: Array<{
    id: string
    x: number
    y: number
    width?: number            // Optional resize
    height?: number
  }>
  reasoning?: string          // Optional explanation of layout logic
}
```

## Day-by-Day Build Plan

### Day 1: Canvas + Collaborative Sync

**Morning — Canvas foundation:**
- Fabric.js canvas component with responsive sizing
- Toolbar: add rectangle, add text, add circle, color picker
- Drag, resize, select, multi-select, delete
- Canvas state serialization to CanvasElement[] using shared-types

**Afternoon — Yjs integration:**
- y-websocket server in canvas-be (attached to same HTTP server as Express)
- Yjs document with Y.Map for each canvas element
- Bind Fabric.js events (object:moving, object:scaling) → Yjs updates
- Bind Yjs observe callbacks → Fabric.js object mutations
- Presence cursors via Yjs awareness protocol
- **Verify:** Two browser tabs with synced canvas + live cursor presence

### Day 2: AI Layout Engine

**Morning — Backend:**
- Express route: POST /ai/layout in canvas-be
- Canvas state serializer: Yjs doc → CanvasElement[] (using shared-utils)
- Claude API integration using @anthropic-ai/sdk
- System prompt from shared-prompts
- Zod validation of Claude's JSON response (using shared-utils)

**Afternoon — Integration:**
- Write validated positions back into Yjs document on server
- Client detects bulk position changes, triggers Fabric.js animate() (300ms ease)
- PromptBar component with submit and Cmd+Enter shortcut
- Loading state: pulsing canvas border while AI processes
- **Verify:** Type "arrange in a grid" → elements slide into position on all clients

### Day 3: Polish + Deploy

**Morning — UX:**
- Yjs UndoManager for collaborative undo/redo (Ctrl+Z)
- Element labels and color customization
- Error handling: API failures, disconnect recovery, invalid AI output
- Toast notifications for connection status

**Afternoon — Ship:**
- Deploy canvas-fe to Vercel
- Deploy canvas-be to Railway (long-lived process for WebSockets)
- README with architecture decisions and setup instructions
- 60-second demo video: multi-user + AI layout
- Cold outreach message to John Holliman (CTO) with repo link

## LLM Prompt Strategy

The system prompt in `shared-prompts` follows this structure:

```
System: You are a layout engine for a collaborative design canvas.
You receive canvas elements as JSON and a user instruction.
Return ONLY a JSON array of {id, x, y} for repositioned elements.
Keep elements within the canvas bounds (width: {canvasWidth}, height: {canvasHeight}).
Maintain 20px minimum padding from edges.
Do not add or remove elements — only reposition existing ones.

User: Elements: [{id, type, label, x, y, width, height}, ...]
Canvas: {width}x{height}
Instruction: "{user's natural language prompt}"
```

## Conversation Talking Points (for CTO interview)

- **Why Yjs over raw WebSocket diffing** — Conflict-free convergence, AI writes participate in same CRDT merge
- **Why Fabric.js over Konva** — Native JSON serialization critical for LLM pipeline
- **Why server calls LLM (not client)** — API key security, single sync channel, output validation
- **How this maps to Moda** — Same three-layer problem: canvas rendering → collaborative state → AI manipulation
- **How collaborative undo works** — Yjs UndoManager gives per-user undo stacks that compose correctly

## Outreach Target

**John Holliman** — Co-Founder & CTO at Moda. Low public presence, LinkedIn is primary channel. Was employee #1 at Dover (Anvisha's previous company). Reach out with repo link + 2-line message referencing the Founding Engineer role.
