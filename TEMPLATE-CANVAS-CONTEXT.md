# Template Canvas — Convert Design Route to Fabric.js

## What This Is

Replace the HTML-based template renderer in `/design/editor` with a Fabric.js canvas. Template slots become editable, draggable Fabric.js objects on a white artboard. The LLM compose stream fills content into Fabric objects instead of HTML divs.

## What Already Exists (do NOT rewrite)

### Reuse from /canvas route as-is:

- `bindYjsToFabric.ts` — bidirectional Yjs ↔ Fabric.js sync with animation
- `fabricFactories.ts` — object creation helpers (Rect, Textbox, Group, Line)
- `fabricRecords.ts` — serialization (serializeObject, applyRecordToObject, ensureObjectForRecord, getObjectId)
- `FabricCanvas.tsx` — canvas component with zoom/pan
- `viewport.ts` — viewport utilities

### Reuse from template system as-is:

- `templatePackV1.ts` — slot positions (LANDING_BASE_SLOTS, all patch variants)
- `templatePacks.ts` / `templateSchemas.ts` — TEMPLATE_PACKS registry, all 5 templates
- `contracts.ts` — createDefaultTemplateFields, readTemplateFieldsFromMap, validateTemplatePatch
- `composeTemplateClient.ts` — streamTemplateCompose (NDJSON consumer)
- `renderTemplate.ts` — textForSlot(), colorForSlot() functions (reuse the logic, change the output)
- All backend: OpenAiTemplateComposeService, templateComposeController, schemas, prompts

### Reuse Yjs infrastructure:

- `YjsCollabService.ts`, `InMemoryDocRepository.ts`, `attachYjsWebsocket.ts`
- WebsocketProvider connection pattern from TemplateEditorShell

## What Changes

### 1. New component: TemplateCanvasShell.tsx

Replaces `TemplateEditorShell.tsx` as the renderer for `/design/editor`.

This component:

- Creates a Fabric.js canvas (reuse FabricCanvas setup pattern)
- Adds a white artboard rect (1600×900 from TEMPLATE_PAGE) on gray pasteboard
- Reads the selected template schema from TEMPLATE_PACKS
- Converts each template slot to a Fabric.js object at the slot's x/y coordinates
- Uses `bindYjsToFabric` for collaborative sync
- Listens to the compose stream and updates Fabric objects when LLM content arrives

### 2. New function: slotToFabricObject()

Maps a template slot + its content to a Fabric.js object:

```typescript
import { Rect, Textbox, Line, Group } from 'fabric';
import type { TemplateSlot } from '../types/template';

function slotToFabricObject(
  slot: TemplateSlot,
  text: string | null,
  pageX: number, // artboard offset on canvas
  pageY: number,
): FabricObject {
  const absoluteX = pageX + slot.x + slot.w / 2; // fabric uses center origin
  const absoluteY = pageY + slot.y + slot.h / 2;

  // Connectors → Line
  if (slot.type === 'connector') {
    const line = new Line(
      [
        pageX + slot.x,
        pageY + slot.y + slot.h / 2,
        pageX + slot.x + slot.w,
        pageY + slot.y + slot.h / 2,
      ],
      {
        stroke: 'rgba(148, 163, 184, 0.75)',
        strokeWidth: slot.h,
        strokeLineCap: 'round',
        selectable: true,
      },
    );
    line.set('id', slot.id);
    return line;
  }

  // Text slots → Textbox (editable, no background)
  if (slot.type === 'text') {
    const textbox = new Textbox(text ?? '', {
      left: pageX + slot.x,
      top: pageY + slot.y,
      width: slot.w,
      fontSize: slot.id.includes('headline') ? 34 : 16,
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      fill: '#f3f4f6',
      editable: true,
      originX: 'left',
      originY: 'top',
    });
    textbox.set('id', slot.id);
    textbox.set('data', { slotId: slot.id, slotType: slot.type });
    return textbox;
  }

  // Box, pill, logo, cta → Rect + Textbox group
  const bgColor = colorForSlot(slot); // reuse from renderTemplate.ts
  const rect = new Rect({
    width: slot.w,
    height: slot.h,
    fill: bgColor,
    rx: slot.type === 'pill' ? slot.h / 2 : 8,
    ry: slot.type === 'pill' ? slot.h / 2 : 8,
    stroke: 'rgba(255,255,255,0.12)',
    strokeWidth: 1,
    originX: 'center',
    originY: 'center',
  });

  const label = new Textbox(text ?? '', {
    width: slot.w - 16,
    fontSize: slot.type === 'logo' ? 14 : 16,
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    fill: '#f3f4f6',
    textAlign: 'center',
    editable: true,
    originX: 'center',
    originY: 'center',
  });

  const group = new Group([rect, label], {
    left: absoluteX,
    top: absoluteY,
    originX: 'center',
    originY: 'center',
    subTargetCheck: true, // allows clicking into the textbox to edit
    objectCaching: false,
  });
  group.set('id', slot.id);
  group.set('data', { slotId: slot.id, slotType: slot.type });
  return group;
}
```

### 3. Artboard setup

In TemplateCanvasShell, after creating the Fabric.js canvas:

```typescript
const PASTEBOARD_COLOR = '#1a1a2e'; // dark, matches your design theme
const PAGE_COLOR = '#0f0f23'; // slightly lighter dark for the page
// Or use light theme:
// const PASTEBOARD_COLOR = '#E8E8E3';
// const PAGE_COLOR = '#FFFFFF';

const PAGE_W = 1600; // from TEMPLATE_PAGE
const PAGE_H = 900;

function setupArtboard(canvas: FabricCanvasType) {
  canvas.backgroundColor = PASTEBOARD_COLOR;

  // Center the page on the canvas
  const pageX = (canvas.width! - PAGE_W) / 2;
  const pageY = (canvas.height! - PAGE_H) / 2;

  const artboard = new Rect({
    left: pageX,
    top: pageY,
    width: PAGE_W,
    height: PAGE_H,
    fill: PAGE_COLOR,
    selectable: false,
    evented: false,
    hoverCursor: 'default',
    shadow: {
      color: 'rgba(0,0,0,0.3)',
      blur: 30,
      offsetX: 0,
      offsetY: 8,
    },
  });
  artboard.set('id', '__artboard__');
  artboard.set('data', { type: 'artboard', locked: true });
  canvas.insertAt(artboard, 0);

  return { pageX, pageY };
}
```

### 4. Initial render: template slots → Fabric objects

When the component mounts and the template is known:

```typescript
function renderSlotsToCanvas(
  canvas: FabricCanvasType,
  template: TemplateSchema,
  fields: TemplateFields,
  pageX: number,
  pageY: number,
) {
  // Remove existing slot objects (not the artboard)
  canvas.getObjects().forEach((obj) => {
    if (obj.get('data')?.type !== 'artboard') {
      canvas.remove(obj);
    }
  });

  // Create a Fabric object for each slot
  for (const slot of template.slots) {
    const text = textForSlot(slot.id, fields); // reuse from renderTemplate.ts
    const obj = slotToFabricObject(slot, text, pageX, pageY);
    canvas.add(obj);
  }

  canvas.requestRenderAll();
}
```

### 5. LLM stream → update Fabric objects

When the compose stream sends field patches (same as current TemplateEditorShell logic), instead of setting React state, find the corresponding Fabric object and update its text:

```typescript
function applyFieldsToCanvas(
  canvas: FabricCanvasType,
  fields: Partial<TemplateFields>,
  template: TemplateSchema,
) {
  for (const slot of template.slots) {
    const newText = textForSlot(slot.id, fields as TemplateFields);
    if (newText === null) continue;

    // Find the Fabric object by slot ID
    const obj = canvas.getObjects().find((o) => o.get('id') === slot.id);
    if (!obj) continue;

    // For Group objects (pill, box, cta, logo): update the Textbox inside
    if (obj instanceof Group) {
      const textChild = obj
        .getObjects()
        .find((child) => child instanceof Textbox);
      if (textChild instanceof Textbox) {
        textChild.set('text', newText);
      }
    }
    // For standalone Textbox (text slots): update directly
    else if (obj instanceof Textbox) {
      obj.set('text', newText);
    }
  }
  canvas.requestRenderAll();
}
```

### 6. Yjs integration approach

Two Yjs maps per design room:

**`templateMeta` Y.Map** — same as now. Stores templateId, theme, status, prompt, patchCount. Used by the compose stream logic. No changes.

**`templateFields` Y.Map** — same as now. Stores the LLM-generated content (heroHeadline, etc). When fields change via Yjs observe, call `applyFieldsToCanvas()`.

**`objects` Y.Map** (NEW) — stores Fabric.js object positions/sizes after user edits. When user drags a slot on canvas, the modified position writes to this map via `bindYjsToFabric`. Other clients receive the update and move the object.

The flow:

1. LLM streams content → writes to `templateFields` Y.Map (existing behavior)
2. `templateFields` observer fires → calls `applyFieldsToCanvas()` → updates Fabric text
3. User drags/resizes an object → `bindYjsToFabric` writes to `objects` Y.Map
4. Other clients receive `objects` update → Fabric object moves with animation

This means content syncs via `templateFields` and positions sync via `objects`. Both are collaborative.

### 7. Preventing position reset on content update

When the LLM fills new content, we update text but must NOT reset positions that the user has already customized. Check if the `objects` Y.Map has a custom position for a slot before applying the template default:

```typescript
function getSlotPosition(
  slot: TemplateSlot,
  objectsMap: Y.Map<CanvasObjectRecord>,
  pageX: number,
  pageY: number,
) {
  // Check if user has moved this slot
  const customRecord = objectsMap.get(slot.id);
  if (customRecord && typeof customRecord.left === 'number') {
    return { left: customRecord.left, top: customRecord.top };
  }
  // Fall back to template default
  return {
    left: pageX + slot.x + slot.w / 2,
    top: pageY + slot.y + slot.h / 2,
  };
}
```

### 8. TemplateEditorPage routing update

```typescript
// In TemplateEditorPage.tsx — swap the shell component
import { TemplateCanvasShell } from '../components/TemplateCanvasShell';

export function TemplateEditorPage() {
  const location = useLocation();
  const state = location.state as { prompt?: string; docId?: string } | null;
  const params = new URLSearchParams(location.search);
  const docIdFromQuery = params.get('doc') ?? undefined;
  const candidates = params.get('candidates')?.split(',') as TemplateId[] | undefined;
  const docId = docIdFromQuery ?? state?.docId;

  return (
    <TemplateCanvasShell
      initialPrompt={state?.prompt}
      docId={docId}
      candidates={candidates}
    />
  );
}
```

## What to Keep from TemplateEditorShell

Copy these into TemplateCanvasShell — they work the same way:

- Yjs setup (ydoc, provider, metaMap, fieldsMap, streamMap refs)
- `startComposeStream()` function — triggers LLM compose
- `applyValidatedPatch()` function — validates and writes patches to Yjs
- Compose stream event handling (template_selected, field_patch, complete, error)
- Regenerate button
- Sidebar with status/metadata (templateId, status, patchCount, sync, stream events)
- All the `useEffect` for Yjs initialization and provider connection

Replace ONLY the `<article>` HTML rendering with the Fabric.js canvas + artboard.

## What NOT to Change

- No backend changes. Zero. The compose endpoint, OpenAI service, schemas, prompts — all stay the same.
- No changes to `/canvas` route or CanvasShell.
- No changes to DesignShell (the prompt/create page).
- No changes to template slot definitions or patch variants.
- No changes to composeTemplateClient.ts stream consumer.
- No changes to contracts.ts field/meta helpers.

## Implementation Order

```
Step 1:  Create TemplateCanvasShell.tsx                                  15 min
         - Copy Yjs setup + compose stream logic from TemplateEditorShell
         - Replace <article> HTML with a <canvas> container div

Step 2:  Add Fabric.js canvas initialization                            15 min
         - Reuse FabricCanvas setup pattern
         - Call setupArtboard() to add white page rect

Step 3:  Create slotToFabricObject() function                           30 min
         - Handle each slot type: text → Textbox, connector → Line,
           box/pill/logo/cta → Group(Rect + Textbox)
         - Reuse colorForSlot() from renderTemplate.ts
         - Set slot.id as the Fabric object ID

Step 4:  Create renderSlotsToCanvas() function                          15 min
         - Iterate template.slots, call slotToFabricObject for each
         - Use textForSlot() to get initial content from fields
         - Add all objects to canvas

Step 5:  Wire templateFields Yjs observer to canvas                     20 min
         - On fields change → call applyFieldsToCanvas()
         - Find Fabric objects by slot ID, update text
         - Do NOT reset user-customized positions

Step 6:  Add bindYjsToFabric for position sync                          15 min
         - Connect to a separate 'objects' Y.Map for position/size
         - User drags → writes to Yjs → other clients see movement
         - This is your existing binding, just connected to a new map

Step 7:  Wire compose stream → canvas                                   15 min
         - On field_patch event → update Yjs fieldsMap (existing)
         - Yjs observer → applyFieldsToCanvas → Fabric text updates
         - On template_selected → pick correct template schema,
           call renderSlotsToCanvas with new slot positions

Step 8:  Add zoom/pan (copy from FabricCanvas)                          10 min
         - Mouse wheel zoom
         - Alt+drag pan

Step 9:  Update TemplateEditorPage to use TemplateCanvasShell            5 min

Step 10: Keep sidebar metadata panel                                    10 min
         - Template ID, status, patch count, sync, stream events
         - Same as TemplateEditorShell sidebar

Step 11: Test                                                           15 min
```

Total: ~3 hours

## Test Scenarios

### Canvas rendering

1. Open /design → type prompt → Create → editor loads with Fabric.js canvas
2. White artboard visible on dark pasteboard
3. All template slots rendered as Fabric objects at correct positions
4. LLM content streams in → text updates in Fabric objects progressively

### Editing

5. Click on a text slot → edit text inline (Textbox is editable)
6. Drag a slot → moves freely on artboard
7. Resize a slot → scales
8. Double-click a Group (pill/CTA) → edit the text inside

### Collaboration

9. Open two tabs with same doc ID → both show same canvas
10. Drag a slot in tab 1 → it moves in tab 2 (via Yjs objects map)
11. LLM streams content → both tabs update text simultaneously (via Yjs fields map)

### Template selection

12. Use a prompt that triggers landing.v1 → slots render at landing.v1 positions
13. Regenerate → canvas clears and re-renders with new content

### Edge cases

15. Drag a slot, then regenerate → text updates but position stays where user put it
16. Refresh page → Yjs restores fields from server, canvas re-renders
17. Zoom in/out → artboard scales, objects stay positioned correctly

## Cursor Prompt to Start

"Read TEMPLATE-CANVAS-CONTEXT.md. Create TemplateCanvasShell.tsx by copying the Yjs setup and compose stream logic from TemplateEditorShell.tsx, then replacing the HTML article rendering with a Fabric.js canvas. Start with Step 1: create the component with Yjs setup, then Step 2: add Fabric.js canvas with artboard."
