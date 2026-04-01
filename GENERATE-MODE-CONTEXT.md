# Design Generator — Implementation Context

## Prerequisites (already built)

- Fabric.js collaborative canvas with Yjs sync at `/canvas` route ✅
- Chat-based AI interaction (move/create shapes on freeform canvas) ✅
- Yjs write-back and broadcast to all clients ✅
- y-websocket server attached to Express ✅

## What We're Adding

A new `/design` route that turns the canvas into a structured page designer — like Canva or Moda. User types "landing page for a coffee brand" and watches elements appear on a white artboard in real time.

The existing `/canvas` route stays untouched. Both routes share the same backend.

---

## Route Architecture

```
/canvas    → existing freeform whiteboard (no artboard, no page bounds)
              Room: canvas-{roomId}
              AI: moves/creates shapes on infinite canvas

/design    → NEW structured page designer
              Room: design-{roomId}
              AI: generates full page layouts on a fixed artboard
              Has: white page, gray pasteboard, zoom/pan, page-relative coordinates
```

Both routes:
- Share the same canvas-be server
- Use the same y-websocket for Yjs sync
- Use the same OpenAI pipeline
- Show presence cursors
- Support real-time collaboration

### Frontend routing

```typescript
// apps/canvas-fe/src/App.tsx
<Routes>
  <Route path="/canvas" element={<CanvasWorkspace />} />   {/* existing */}
  <Route path="/design" element={<DesignWorkspace />} />    {/* new */}
  <Route path="/" element={<Navigate to="/design" />} />    {/* default to design for demo */}
</Routes>
```

`DesignWorkspace` reuses the same Fabric.js canvas component but wraps it with the artboard system, design-specific prompt bar, and chat history panel.

---

## Part 1: Page Artboard System

### Page Config (shared-types)

```typescript
interface PageConfig {
  width: number
  height: number
  preset: 'landscape-16-9' | 'portrait-a4' | 'square' | 'custom'
}

const PAGE_PRESETS = {
  'landscape-16-9': { width: 1280, height: 720 },
  'portrait-a4':    { width: 794, height: 1123 },
  'square':         { width: 1024, height: 1024 },
} as const
```

Default: `landscape-16-9` (1280×720). Hardcode this for the prototype. Page size selector is a nice-to-have.

### Artboard setup

File: `apps/canvas-fe/src/components/DesignCanvas.tsx`

```typescript
const PASTEBOARD_COLOR = '#E8E8E3'
const PAGE_COLOR = '#FFFFFF'

function setupArtboard(canvas: fabric.Canvas, pageConfig: PageConfig) {
  canvas.backgroundColor = PASTEBOARD_COLOR

  const pageX = (canvas.width! - pageConfig.width) / 2
  const pageY = (canvas.height! - pageConfig.height) / 2

  const page = new fabric.Rect({
    left: pageX,
    top: pageY,
    width: pageConfig.width,
    height: pageConfig.height,
    fill: PAGE_COLOR,
    selectable: false,
    evented: false,
    hoverCursor: 'default',
    shadow: new fabric.Shadow({
      color: 'rgba(0,0,0,0.1)',
      blur: 20,
      offsetX: 0,
      offsetY: 4,
    }),
  })

  page.set('data', { type: 'artboard', locked: true })
  canvas.insertAt(page, 0)

  return { pageX, pageY, pageWidth: pageConfig.width, pageHeight: pageConfig.height }
}
```

### Coordinate transforms

All AI coordinates are page-relative (0,0 = top-left of white page). The canvas offset is a rendering concern only.

```typescript
// AI element → Fabric.js object (add page offset)
function aiElementToFabricObject(element: CanvasElement, pageX: number, pageY: number) {
  return new fabric.Rect({
    left: pageX + element.x,
    top: pageY + element.y,
    width: element.width,
    height: element.height,
    fill: element.fill,
    // ...
  })
}

// Fabric.js object → AI element (subtract page offset)
function fabricObjToCanvasElement(obj: fabric.Object, pageX: number, pageY: number): CanvasElement {
  return {
    // ...
    x: obj.left! - pageX,
    y: obj.top! - pageY,
  }
}

// Filter artboard from element lists
function getDesignElements(): CanvasElement[] {
  return canvas.getObjects()
    .filter(obj => obj.data?.type !== 'artboard')
    .map(obj => fabricObjToCanvasElement(obj, pageX, pageY))
}
```

### Element clamping on drag

```typescript
canvas.on('object:moving', (e) => {
  const obj = e.target!
  if (obj.data?.type === 'artboard') return
  const left = Math.max(pageX, Math.min(obj.left!, pageX + pageWidth - obj.width! * obj.scaleX!))
  const top = Math.max(pageY, Math.min(obj.top!, pageY + pageHeight - obj.height! * obj.scaleY!))
  obj.set({ left, top })
})
```

### Zoom and pan

```typescript
// Mouse wheel zoom
canvas.on('mouse:wheel', (opt) => {
  let zoom = canvas.getZoom() * (0.999 ** opt.e.deltaY)
  zoom = Math.max(0.3, Math.min(3, zoom))
  canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom)
  opt.e.preventDefault()
  opt.e.stopPropagation()
})

// Alt+drag to pan
canvas.on('mouse:down', (opt) => {
  if (opt.e.altKey) {
    canvas.isDragging = true
    canvas.lastPosX = opt.e.clientX
    canvas.lastPosY = opt.e.clientY
  }
})
```

### Page config in Yjs

```typescript
const yPageConfig = ydoc.getMap('pageConfig')
yPageConfig.set('width', 1280)
yPageConfig.set('height', 720)
yPageConfig.set('preset', 'landscape-16-9')
```

All clients read from this. Artboard resizes when it changes.

---

## Part 2: Generate Mode

### New Types (shared-types)

```typescript
interface AIGenerateRequest {
  prompt: string
  pageWidth: number
  pageHeight: number
  roomId: string
  style?: 'minimal' | 'dense' | 'presentation'
}

interface AIGenerateResponse {
  elements: CanvasElement[]
  reasoning?: string
}
```

Update existing layout types to use `pageWidth`/`pageHeight` and `roomId`:

```typescript
interface AILayoutRequest {
  elements: CanvasElement[]
  instruction: string
  pageWidth: number
  pageHeight: number
  roomId: string
}
```

### New Zod Schemas (shared-utils)

```typescript
const aiGenerateRequestSchema = z.object({
  prompt: z.string().min(1).max(1000),
  pageWidth: z.number().positive(),
  pageHeight: z.number().positive(),
  roomId: z.string().min(1),
  style: z.enum(['minimal', 'dense', 'presentation']).optional(),
})

const aiGenerateResponseSchema = z.object({
  elements: z.array(canvasElementSchema),
  reasoning: z.string().optional(),
})
```

### Generate System Prompt (shared-prompts/generate-system.txt)

```
You are an expert design layout generator for a collaborative canvas tool.
Given a description, create a complete page layout as JSON.

Return a JSON object: {"elements": [...], "reasoning": "brief explanation of layout choices"}

Each element in the array must have:
- id: descriptive slug string (e.g. "hero-bg", "main-heading", "cta-button", "feature-card-1")
- type: "rect" or "text"
- label: the display text or description of what this element represents
- x: number (pixels from left edge of the page)
- y: number (pixels from top edge of the page)
- width: number (pixels)
- height: number (pixels)
- fill: hex color string (e.g. "#2D3436")
- rotation: 0
- zIndex: number (layering order, higher = rendered on top)

IMPORTANT: All coordinates are relative to the page. (0,0) is the top-left corner.
All elements must fit within page bounds. No negative coordinates. No elements past edges.

## Design Intelligence

You are not randomly placing rectangles. You are designing. Follow these principles:

### Visual Hierarchy
- Most important element (hero, title) is largest and at the top
- Supporting content is smaller and below
- CTAs use accent colors at decision points
- Footer and fine print are smallest and at the bottom

### Layout Patterns

Landing Page:
- Hero background: full page-width rect, 35-45% of page height, dark or brand color
- Headline: large text centered on hero
- Subheadline: smaller text below, muted color
- CTA button: rect with accent color below subheadline
- Feature section: 2-3 equal-width rects in a row below hero
- Footer: full page-width rect at bottom, dark

Pricing Page:
- Header: centered title at top
- 3 tier columns: equal-width, middle one taller (featured)
- Price labels: large text in each column
- CTA per tier: accent rect at bottom of each column

Dashboard:
- Top bar: full-width, 50-60px, dark
- Metric cards: 3-4 equal rects in a row
- Main chart area: 60% width, 40% height
- Sidebar: 30% width on right

Presentation Slide:
- Full-page background rect
- Title: large text, centered, 30-40% from top
- Subtitle: below title
- Logo placeholder: small rect, bottom-right

Portfolio / Minimal:
- Large whitespace
- One large image placeholder (60% of page)
- Small name text, top-left or bottom-left
- Single accent shape

### Spacing
- 20px minimum padding from page edges
- 16-24px gaps between elements
- Align related elements on same x or y

### Color
- 1 dominant + 1 accent + 1 neutral
- Dark bg: #1A1A2E, #16213E, #0F3460, #2D3436
- Light bg: #FAFAFA, #F5F5F5, #FFFFFF
- Accents: #E94560, #FF6B6B, #48C9B0, #F39C12, #6C5CE7
- Text on dark: #FFFFFF or #F5F5F5
- Text on light: #2D3436 or #1A1A2E
- Never pure black (#000000) as background

### Element Count
- 8-15 elements per layout
- Every element has a clear purpose

Page size: {pageWidth} x {pageHeight} pixels.
Return ONLY valid JSON. No markdown fences.
```

### Endpoint: POST /ai/generate

File: `apps/canvas-be/src/routes/ai-generate.ts`

Uses **OpenAI** with JSON mode:

```typescript
import OpenAI from 'openai'

const openai = new OpenAI() // reads OPENAI_API_KEY from env

async function handleGenerate(req, res) {
  // 1. Validate
  const parsed = aiGenerateRequestSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error })

  const { prompt, pageWidth, pageHeight, roomId } = parsed.data

  // 2. Get conversation history
  const history = getHistory(roomId)

  // 3. Build system prompt (replace dimensions)
  const systemPrompt = generateSystemPrompt
    .replace('{pageWidth}', String(pageWidth))
    .replace('{pageHeight}', String(pageHeight))

  // 4. Call OpenAI
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: prompt },
    ],
  })

  const responseText = response.choices[0].message.content!
  const responseJson = JSON.parse(responseText)

  // 5. Validate response
  const validated = aiGenerateResponseSchema.safeParse(responseJson)
  if (!validated.success) return res.status(500).json({ error: 'AI returned invalid layout' })

  // 6. Post-process
  const elements = validated.data.elements
    .slice(0, 30)  // cap at 30
    .map(deduplicateIds)
    .map(el => clampToPage(el, pageWidth, pageHeight))
    .map(validateHexColor)

  if (elements.length === 0) {
    return res.status(400).json({ error: 'AI could not generate a layout. Try a more specific prompt.' })
  }

  // 7. Write to Yjs
  writeElementsToYjs(roomId, elements)

  // 8. Store in conversation memory
  pushExchange(roomId, prompt, responseText)

  // 9. Return
  return res.json({ elements, reasoning: validated.data.reasoning })
}
```

Also update the existing layout route to use OpenAI + conversation memory with the same pattern.

### Streaming (optional upgrade — real-time element appearance)

If you want elements to appear as OpenAI generates them (like Moda), instead of all at once:

```typescript
const stream = await openai.chat.completions.create({
  model: 'gpt-4o',
  stream: true,
  response_format: { type: 'json_object' },
  messages: [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: prompt },
  ],
})

let buffer = ''

for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta?.content || ''
  buffer += delta

  // Try to extract complete elements from partial JSON
  const extracted = extractCompleteElements(buffer)
  for (const element of extracted.newElements) {
    // Write each element to Yjs as soon as it's parseable
    writeSingleElementToYjs(roomId, element)
    // Client sees it appear immediately via y-websocket broadcast
  }
}
```

`extractCompleteElements` is a simple parser that looks for complete `{...}` objects within the `"elements": [...]` array as the JSON streams in. Each time it finds a complete element object, it validates with Zod and writes to Yjs.

**Build the non-streaming version first.** Add streaming only if you have time. The visual difference is subtle — both show elements appearing progressively. Streaming just removes the loading wait.

---

## Part 3: Conversation Memory

### Server-side store

File: `apps/canvas-be/src/services/conversation-store.ts`

```typescript
type Message = { role: 'user' | 'assistant', content: string }

const store = new Map<string, Message[]>()

export function getHistory(roomId: string): Message[] {
  return store.get(roomId) || []
}

export function pushExchange(roomId: string, userPrompt: string, assistantResponse: string) {
  const history = store.get(roomId) || []
  history.push({ role: 'user', content: userPrompt })
  history.push({ role: 'assistant', content: assistantResponse })
  store.set(roomId, history.slice(-10)) // last 5 pairs
}

export function clearHistory(roomId: string) {
  store.delete(roomId)
}
```

### Wire into both endpoints

Both `/ai/layout` and `/ai/generate` use the same pattern:

```typescript
// Before OpenAI call
const history = getHistory(roomId)
const messages = [
  { role: 'system', content: systemPrompt },
  ...history,
  { role: 'user', content: currentPrompt },
]

// After response
pushExchange(roomId, currentPrompt, responseText)
```

### Client: chat panel in /design route

The `/design` route has a chat panel (sidebar or bottom bar) showing the conversation:

```
┌─────────────────────────────────┬──────────────────────┐
│                                 │  Design chat          │
│      Gray pasteboard            │                      │
│   ┌──────────────────────┐      │  You:                │
│   │                      │      │  "landing page for   │
│   │    White artboard    │      │   a coffee brand"    │
│   │                      │      │                      │
│   │  [AI-generated       │      │  ✓ Generated 12      │
│   │   elements appear    │      │    elements          │
│   │   here]              │      │                      │
│   │                      │      │  You:                │
│   │                      │      │  "make the header    │
│   └──────────────────────┘      │   bigger"            │
│                                 │                      │
│                                 │  ✓ Updated 3         │
│                                 │    elements          │
│                                 │                      │
│                                 │  [Describe... ____]  │
└─────────────────────────────────┴──────────────────────┘
```

Keep it minimal:
- User prompts as text bubbles
- One-line result summary after each (e.g. "Generated 12 elements", "Updated 3 elements")
- Input at the bottom with placeholder "Describe your design..."
- Max 5-7 messages visible, scroll for more
- React state only (not Yjs — this is UI-only)

The `/canvas` route keeps its existing chat/prompt bar — no changes needed there.

---

## Part 4: Design-Specific PromptBar Logic

### Auto-detection in /design route

```typescript
const handleDesignPrompt = async (prompt: string) => {
  const elements = getDesignElements() // excludes artboard

  if (elements.length === 0) {
    // Generate mode: create from scratch
    await callGenerate({ prompt, pageWidth, pageHeight, roomId })
  } else {
    // Layout mode: rearrange/modify existing
    await callLayout({ elements, instruction: prompt, pageWidth, pageHeight, roomId })
  }
}
```

### "New design" button

In the design toolbar:
1. Clears all elements from Yjs (not the artboard)
2. Calls `clearHistory(roomId)` on the server
3. Clears chat panel in React state
4. Focuses prompt input with placeholder: "Describe the design you want..."

### Element appearance animation

```typescript
// In Yjs observe callback for /design route
if (change.action === 'add') {
  // New element → fade in on artboard with stagger
  const obj = aiElementToFabricObject(elementData, pageX, pageY)
  obj.set('opacity', 0)
  canvas.add(obj)
  obj.animate('opacity', 1, {
    duration: 300,
    delay: index * 50,
    easing: fabric.util.ease.easeInOutQuad,
  })
} else if (change.action === 'update') {
  // Existing element repositioned → animate to new position
  existingObj.animate({ left: pageX + newX, top: pageY + newY }, {
    duration: 300,
    easing: fabric.util.ease.easeInOutQuad,
    onChange: canvas.renderAll.bind(canvas),
  })
}
```

---

## Implementation Order

```
Step 1:  Create /design route and DesignWorkspace component         15 min
Step 2:  Add PageConfig type to shared-types                        5 min
Step 3:  Build artboard (white page, gray pasteboard, shadow)       25 min
Step 4:  Page-relative coordinate transforms                        15 min
Step 5:  Element clamping to page bounds on drag                    10 min
Step 6:  Zoom (mouse wheel) and pan (alt+drag)                     10 min
Step 7:  Store page config in Yjs                                   5 min
Step 8:  Add generate types + Zod schemas                           10 min
Step 9:  Add generate-system.txt prompt                             10 min
Step 10: Build conversation-store.ts                                10 min
Step 11: Build POST /ai/generate route (OpenAI + JSON mode)         30 min
Step 12: Wire conversation memory into layout + generate routes     15 min
Step 13: Build useAiGenerate hook                                   10 min
Step 14: Build DesignPromptBar (auto-detection + chat display)      25 min
Step 15: Fade-in animation for generated elements                   15 min
Step 16: "New design" button                                        10 min
Step 17: (Optional) Streaming element appearance                    30 min
Step 18: Test full flow                                             15 min
```

Without streaming: ~4 hours
With streaming: ~4.5 hours

## Test Scenarios

### Artboard
1. Open /design → white page on gray pasteboard
2. Drag element → stays within page
3. Mouse wheel zoom → canvas zooms, page stays centered
4. Alt+drag → pan
5. Open /canvas → no artboard, freeform (existing behavior intact)

### Generate
6. /design, empty page → "landing page for coffee brand" → elements on white page
7. /design, empty page → "pricing with three tiers" → columns within page
8. All elements are within white page, none on pasteboard

### Conversation memory
9. After test 6 → "make the header bigger" → OpenAI knows which element
10. "change colors to blue" → updates with context
11. "add testimonials at bottom" → adds below existing, within page

### Route isolation
12. /canvas still works as before — no artboard, freeform
13. /design has its own Yjs rooms, separate from /canvas
14. Two users on same /design room see same artboard + elements

### Edge cases
15. Refresh /design → artboard reloads from Yjs pageConfig, chat history gone
16. "New design" button → clears elements + chat, artboard stays
17. Generate → manually drag elements → "rearrange in grid" → layout mode works

## What NOT to Build

- No multi-page support
- No custom page size input (hardcode landscape-16-9)
- No rulers, grid lines, or snap-to-grid
- No export to PDF/PNG
- No templates or preset gallery
- No RAG or brand memory
- No database for chat history
- No changes to /canvas route
