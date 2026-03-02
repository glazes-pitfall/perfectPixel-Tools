# Architecture Research

**Domain:** Browser-based pixel art editor — vanilla JS, single HTML file, Flask backend
**Researched:** 2026-03-02
**Confidence:** HIGH (based on direct codebase analysis + established canvas rendering patterns)

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         editor.html  (new page)                       │
│  ┌──────────────┐  ┌──────────────────────────┐  ┌────────────────┐  │
│  │  Left Panel  │  │      Center Canvas        │  │  Right Panel   │  │
│  │              │  │  ┌────────────────────┐   │  │                │  │
│  │ PalettePanel │  │  │  pixel-layer       │   │  │  ToolboxPanel  │  │
│  │ (ported from │  │  │  (main ImageData)  │   │  │  (6 tools +    │  │
│  │  web_ui.html)│  │  ├────────────────────┤   │  │   shortcuts)   │  │
│  ├──────────────┤  │  │  selection-overlay │   │  └────────────────┘  │
│  │ CanvasConfig │  │  │  (dashed marquee)  │   │                      │
│  │ Panel        │  │  ├────────────────────┤   │                      │
│  │ (size, grid) │  │  │  cursor-overlay    │   │                      │
│  ├──────────────┤  │  │  (brush preview)   │   │                      │
│  │ ColorPicker  │  │  └────────────────────┘   │                      │
│  │ (permanent,  │  │         ↑ CSS transform    │                      │
│  │  bottom-left)│  │         (zoom/pan)         │                      │
│  └──────────────┘  └──────────────────────────┘                      │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  Top Bar: [tool options area]           [Undo ⌘Z] [Redo ⇧⌘Z]   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
        │  fetch /api/editor/save-pixels    │
        │  fetch /api/apply-palette (reuse) │
        ▼                                   ▼
┌────────────────────────────────────────────────────────┐
│                     Flask  web_app.py                   │
│  /editor              → serve editor.html              │
│  /api/editor/init     → accept base64, return metadata │
│  /api/editor/save     → accept base64, return PNG dl   │
│  /api/apply-palette   → (existing, reused as-is)       │
│  /api/export-palette  → (existing, reused as-is)       │
└────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `EditorState` (JS object) | Single source of truth: ImageData, history stack, active tool, selection, palette, grid metadata | All other components read/write through it |
| `CanvasRenderer` | Composites layers onto display; handles zoom/pan transform | EditorState (reads), 3 canvas elements |
| `HistoryManager` | Push/pop snapshots for undo/redo; manages stack size | EditorState.history |
| `ToolController` | Routes pointer events to the active tool handler | EditorState, CanvasRenderer |
| `SelectionManager` | Tracks active marquee or wand selection; draws dashed overlay | EditorState.selection, CanvasRenderer |
| `PalettePanel` | Swatch grid, color sync, localStorage (ported from web_ui.html) | EditorState.palette, ColorPicker |
| `ColorPicker` | HSL wheel + hex/RGB inputs; permanent bottom-left | EditorState.foregroundColor, PalettePanel |
| `ToolOptionsBar` | Renders tool-specific parameters in top bar | EditorState.activeTool, ToolController |
| `CanvasConfigPanel` | Canvas size editor, grid overlay toggle | EditorState, HistoryManager |

---

## Canvas Rendering Architecture

### Three-Canvas Layer Stack

Use three `<canvas>` elements stacked with `position: absolute` inside a container `div`. CSS `image-rendering: pixelated` on all three.

```
┌───────────────────────────────┐
│  cursor-canvas  (z-index: 3)  │  ← brush preview, pixel grid lines
│  selection-canvas (z-index: 2)│  ← animated dashed marquee, transform handles
│  pixel-canvas   (z-index: 1)  │  ← the actual ImageData
└───────────────────────────────┘
```

**Why three canvases instead of one:**
- Redrawing the pixel layer (potentially large ImageData) on every mouse move is expensive. The cursor preview must update at pointer frequency without touching the pixel canvas.
- The selection marquee is animated (marching ants) — it redraws at 60 fps independently of pixel edits.
- Separating concerns means a pencil stroke only dirties `pixel-canvas`; a selection drag only dirties `selection-canvas`.

**Zoom/pan:** Apply a single CSS `transform: scale(zoom) translate(panX, panY)` to the container `div` that holds all three canvases. Do NOT use `ctx.setTransform` — keeping the canvas coordinate system at 1:1 pixel ratio means ImageData operations remain trivially correct.

**Display sizing:** The canvases are sized to exactly `imageWidth * devicePixelRatio` × `imageHeight * devicePixelRatio` to keep pixel-perfect rendering at any zoom. The CSS `width`/`height` attributes match the logical image dimensions.

### Pixel Canvas Operations

All drawing operations work directly on a persistent `Uint8ClampedArray` (the pixel buffer), not through `ctx.fillRect`. This is required for:
- Flood fill (needs direct pixel access)
- Magic wand tolerance comparisons
- Pixel-perfect pencil (needs to see neighboring pixels before drawing)
- RotSprite transform (reads and writes entire regions)

The rendering loop is:
```
modify pixel buffer
  → create ImageData from buffer
  → ctx.putImageData(imageData, 0, 0)
```

For large canvases (> 256×256), putImageData of the full buffer is still fast (sub-millisecond). Do not attempt partial putImageData (the API is quirky with dirty rectangles and the complexity is not worth it at pixel art scales).

---

## State Management

### Single State Object (No Framework)

```javascript
const EditorState = {
  // Canvas data
  width: 0,
  height: 0,
  pixels: null,           // Uint8ClampedArray, RGBA, length = width*height*4
  gridW: 0,               // pixel art grid cell width (from Ver 1.1 output)
  gridH: 0,               // pixel art grid cell height

  // Rendering
  zoom: 4,                // display scale factor
  panX: 0,
  panY: 0,

  // Tool state
  activeTool: "pencil",   // "pencil"|"eraser"|"bucket"|"wand"|"marquee"|"move"
  foregroundColor: [0,0,0,255],  // RGBA

  // Tool options (all tools share this namespace, each reads its own keys)
  toolOptions: {
    brushSize: 1,
    brushShape: "round",  // "round"|"square"
    pixelPerfect: false,
    bucketTolerance: 15,
    wandTolerance: 15,
    contiguous: true,
  },

  // Selection
  selection: null,        // null | { x, y, w, h } in canvas pixels
  selectionPixels: null,  // Uint8ClampedArray of selected region (during move/transform)
  transformState: null,   // null | { active: true, originX, originY, ... }

  // Undo/redo
  history: [],            // array of Uint8ClampedArray snapshots
  historyIndex: -1,       // points to current state in history
  MAX_HISTORY: 50,

  // Palette (synced with PalettePanel)
  palette: [],            // [[r,g,b], ...] — same format as web_ui.html currentPalette
};
```

**Key discipline:** No component stores its own copy of derived data. The palette array lives only in `EditorState.palette`; the PalettePanel renders from it. The foreground color lives only in `EditorState.foregroundColor`; the ColorPicker reads it.

**Change notification:** Use a minimal pub/sub pattern — `EditorState.on('change', handler)` — instead of polling. Components subscribe to the keys they care about. This avoids cascading re-renders while keeping state updates explicit.

```javascript
// Minimal pub/sub (20 lines, no library needed)
const listeners = {};
EditorState.on = (event, fn) => { (listeners[event] = listeners[event] || []).push(fn); };
EditorState.emit = (event, data) => (listeners[event] || []).forEach(fn => fn(data));
// Usage: after any state mutation, call EditorState.emit('pixels-changed')
```

---

## Undo/Redo Architecture

### Snapshot-Based (Not Command Pattern)

**Recommendation: Use full pixel buffer snapshots, not a command log.**

Rationale for this project:
- Pixel art canvases are small (typically 16×16 to 256×256 pixels). A 256×256 RGBA snapshot is 256KB. At 50 history entries that is 12.8 MB — acceptable for a desktop browser.
- A command pattern requires implementing an inverse for every operation (pencil, flood fill, transform, canvas resize). Flood fill inversion requires storing the pre-fill state anyway, so commands offer no memory advantage and add significant implementation complexity.
- Snapshot undo is trivially correct. Command pattern undo has edge cases with non-invertible operations.

**Implementation:**

```javascript
function pushHistory() {
  // Truncate forward history on new action
  EditorState.history.splice(EditorState.historyIndex + 1);

  // Snapshot current pixels
  const snapshot = EditorState.pixels.slice(); // Uint8ClampedArray.slice() is fast
  EditorState.history.push(snapshot);

  // Enforce max
  if (EditorState.history.length > EditorState.MAX_HISTORY) {
    EditorState.history.shift();
  } else {
    EditorState.historyIndex++;
  }
}

function undo() {
  if (EditorState.historyIndex <= 0) return;
  EditorState.historyIndex--;
  EditorState.pixels.set(EditorState.history[EditorState.historyIndex]);
  EditorState.emit('pixels-changed');
}

function redo() {
  if (EditorState.historyIndex >= EditorState.history.length - 1) return;
  EditorState.historyIndex++;
  EditorState.pixels.set(EditorState.history[EditorState.historyIndex]);
  EditorState.emit('pixels-changed');
}
```

**When to push:** Push a snapshot **before** the first pixel modification in each discrete operation:
- Before the first `pointerdown` stroke (not on every move event during dragging)
- Before flood fill executes
- Before transform is applied (Apply button)
- Before canvas resize executes

Do NOT push on every pointer move event — that would produce hundreds of undo steps per stroke.

---

## Event Handling for Tools

### Pointer Event Model

Use the Pointer Events API (`pointerdown`, `pointermove`, `pointerup`) rather than mouse events. This handles both mouse and stylus input uniformly.

**Critical:** Call `canvas.setPointerCapture(event.pointerId)` on `pointerdown` so `pointermove` and `pointerup` continue to fire even if the pointer leaves the canvas element during a stroke.

```javascript
// On the cursor-canvas (topmost layer — receives all input)
cursorCanvas.addEventListener('pointerdown', onPointerDown);
cursorCanvas.addEventListener('pointermove', onPointerMove);
cursorCanvas.addEventListener('pointerup', onPointerUp);

function onPointerDown(e) {
  e.preventDefault();
  cursorCanvas.setPointerCapture(e.pointerId);
  const [cx, cy] = viewportToCanvas(e.clientX, e.clientY);
  pushHistory();
  ToolController.onDown(cx, cy, e);
}
```

**viewportToCanvas:** Converts screen coordinates to canvas pixel coordinates accounting for zoom and pan:

```javascript
function viewportToCanvas(clientX, clientY) {
  const rect = cursorCanvas.getBoundingClientRect();
  const x = Math.floor((clientX - rect.left) / EditorState.zoom);
  const y = Math.floor((clientY - rect.top) / EditorState.zoom);
  return [x, y];
}
```

### Tool Dispatch Pattern

Each tool is a plain object with `onDown`, `onMove`, `onUp`, `onCursor` (for cursor preview) methods. `ToolController` delegates to the active tool:

```javascript
const Tools = {
  pencil: {
    onDown(x, y) { drawPixel(x, y, EditorState.foregroundColor); },
    onMove(x, y) { drawPixel(x, y, EditorState.foregroundColor); },
    onUp() {},
    onCursor(x, y) { drawBrushPreview(x, y); },
  },
  eraser: { /* same shape, draws transparent */ },
  bucket: {
    onDown(x, y) { floodFill(x, y, EditorState.foregroundColor); },
    onMove() {},
    onUp() {},
    onCursor(x, y) { drawCrosshair(x, y); },
  },
  // etc.
};

const ToolController = {
  onDown(x, y, e) { Tools[EditorState.activeTool].onDown(x, y, e); },
  onMove(x, y, e) { Tools[EditorState.activeTool].onMove(x, y, e); },
  onUp(x, y, e)   { Tools[EditorState.activeTool].onUp(x, y, e); },
};
```

### Keyboard Shortcuts

Register at `document` level, not on individual elements, to ensure shortcuts work regardless of focus:

```javascript
document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea')) return; // don't steal from text inputs
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  if (e.key === 'b') setActiveTool('pencil');
  if (e.key === 'e') setActiveTool('eraser');
  if (e.key === 'g') setActiveTool('bucket');
  if (e.key === 'w') setActiveTool('wand');
  if (e.key === 'm') setActiveTool('marquee');
  if (e.key === 'v') setActiveTool('move');
  if (e.key === 's') enterCanvasSizeMode();
  if ((e.metaKey || e.ctrlKey) && e.key === 'd') { e.preventDefault(); clearSelection(); }
});
```

---

## Selection Architecture

### Selection State

```javascript
// EditorState.selection: null when no selection
// When active: { x, y, w, h } — bounding box in canvas pixel coordinates
// Grid-snapped marquee: snap x/y/w/h to nearest gridW/gridH multiple
```

### Marching Ants Animation

The selection dashed border is drawn on `selection-canvas` using `ctx.setLineDash` with an animated offset:

```javascript
let antOffset = 0;
function animateAnts() {
  if (!EditorState.selection) { selCtx.clearRect(0,0,w,h); return; }
  selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
  selCtx.save();
  selCtx.scale(EditorState.zoom, EditorState.zoom);
  selCtx.strokeStyle = '#fff';
  selCtx.lineWidth = 1 / EditorState.zoom;
  selCtx.setLineDash([4 / EditorState.zoom, 4 / EditorState.zoom]);
  selCtx.lineDashOffset = -antOffset;
  const { x, y, w, h } = EditorState.selection;
  selCtx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  selCtx.restore();
  antOffset = (antOffset + 0.3) % 8;
  requestAnimationFrame(animateAnts);
}
```

### Transform Handles

When a selection is active, draw 8 handles on `selection-canvas`. Handles are hit-tested in `onPointerDown` before delegating to the tool. Handle size in screen pixels stays constant regardless of zoom (divide by zoom when drawing).

---

## Pixel Art Algorithm Integration

### RotSprite (JavaScript reimplementation)

RotSprite must be reimplemented in vanilla JS. The algorithm:
1. Scale up the selection 8× using Scale2×/Scale3× (or nearest-neighbor if simpler)
2. Rotate at the target angle using bilinear or nearest-neighbor
3. Scale back down to original size

This is compute-intensive. Keep it synchronous for small selections (< 64×64 cells). For larger selections, consider breaking into a `setTimeout` chain to avoid blocking the UI thread. Do NOT use Web Workers in this project (no module system, added complexity incompatible with single HTML file constraint).

### Pixel-Perfect Pencil

The pixel-perfect mode prevents "L-shaped" diagonal artifacts. After drawing each pixel, check if the newly drawn pixel would create a 2×2 diagonal cluster with its neighbors; if so, remove the offending pixel. This is a stateless per-pixel check on the pixel buffer.

### Flood Fill

Use iterative BFS (not recursive — recursive stack-overflows on large areas):

```javascript
function floodFill(startX, startY, fillColor) {
  const targetColor = getPixel(startX, startY);
  if (colorsEqual(targetColor, fillColor)) return;
  const stack = [[startX, startY]];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= EditorState.width || y < 0 || y >= EditorState.height) continue;
    if (!colorsMatch(getPixel(x, y), targetColor, EditorState.toolOptions.bucketTolerance)) continue;
    setPixel(x, y, fillColor);
    stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
  EditorState.emit('pixels-changed');
}
```

---

## File Structure (New Files to Add)

```
perfectPixel_ver1.1/
├── web_app.py                  ← add /editor route + /api/editor/save endpoint
├── web_ui.html                 ← add "Open in Editor" button to result card
├── editor.html                 ← new: single-file editor (inline CSS + JS)
│   ├── [CSS section]           ← dark theme variables reused from web_ui.html
│   ├── [HTML structure]        ← 4-panel layout
│   └── [JS section]            ← EditorState, CanvasRenderer, tools, history
└── .planning/
    └── research/
        └── ARCHITECTURE.md     ← this file
```

**Editor gets its own HTML file** (not merged into web_ui.html) because:
- web_ui.html is already ~51K lines; adding a full editor would make it unworkable
- The editor page needs a different layout structure (4-panel vs. 2-panel)
- Keeping it separate allows independent development and testing
- Both files can share CSS variables (copy the `:root` block)

---

## Data Flow

### Entry Flow: Ver 1.1 → Editor

```
User clicks "Open in Editor" in web_ui.html
  ↓
JS: sessionStorage.setItem('editorImage', currentPixelArtB64)
    sessionStorage.setItem('editorGrid', JSON.stringify({w: gridW, h: gridH}))
    sessionStorage.setItem('editorPalette', JSON.stringify(currentPalette))
  ↓
window.location.href = '/editor'
  ↓
editor.html loads, reads sessionStorage
  ↓
EditorState.pixels = decode base64 → ImageData
EditorState.palette = parsed from session
EditorState.gridW/H = from session
  ↓
pushHistory()  // initial snapshot = undo point 0
CanvasRenderer.render()
```

**Why sessionStorage:** Avoids a round-trip to Flask for image data that is already in memory. sessionStorage survives page navigation within the same tab but is cleared on tab close — appropriate for editor state.

### Tool Stroke Flow

```
pointerdown on cursor-canvas
  ↓ viewportToCanvas(e.clientX, e.clientY)
  ↓ pushHistory() if first pointerdown of this stroke
  ↓ ToolController.onDown(cx, cy)
  ↓ tool modifies EditorState.pixels directly
  ↓ EditorState.emit('pixels-changed')
  ↓ CanvasRenderer.renderPixels()  // putImageData to pixel-canvas
  ↓ [animation loop redraws selection-canvas and cursor-canvas independently]
```

### Palette Sync Flow

```
User clicks swatch in PalettePanel
  ↓ EditorState.foregroundColor = [r,g,b,255]
  ↓ EditorState.emit('color-changed')
  ↓ ColorPicker.update() // updates HSL wheel display
  ↓ PalettePanel.highlightSelected(swatch)
```

```
User picks color in ColorPicker
  ↓ EditorState.foregroundColor = [r,g,b,255]
  ↓ EditorState.emit('color-changed')
  ↓ PalettePanel.highlightMatchingSwatch(rgb)  // highlight if color in palette
```

### Save / Export Flow

```
User clicks Download (exact or scaled)
  ↓ [Option A: pure client-side]
      canvas.toBlob() → createObjectURL → <a download> click
  ↓ [Option B: via Flask for consistency]
      POST /api/editor/save {image_b64, scale}
      Flask returns PNG file download
```

Recommendation: **Option A (client-side)** for exact download (avoids round-trip); **Option B (Flask)** only if server-side palette application is needed on save.

---

## Integration with Existing Flask App

### New Routes to Add to web_app.py

```python
@app.route("/editor")
def editor():
    return send_file(os.path.join(os.path.dirname(__file__), "editor.html"))

# Optional: server-side save endpoint (client-side download may suffice)
@app.route("/api/editor/save", methods=["POST"])
def editor_save():
    image_b64 = request.form.get("image")
    scale = int(request.form.get("scale", 1))
    if not image_b64:
        return jsonify({"error": "No image data"}), 400
    try:
        rgb = b64_to_rgb(image_b64)
    except Exception as e:
        return jsonify({"error": f"Cannot decode image: {e}"}), 400
    if scale > 1:
        import cv2
        rgb = cv2.resize(
            cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR),
            (rgb.shape[1] * scale, rgb.shape[0] * scale),
            interpolation=cv2.INTER_NEAREST
        )
        rgb = cv2.cvtColor(rgb, cv2.COLOR_BGR2RGB)
    out_b64 = encode_png_b64(rgb)
    return jsonify({"output": out_b64})
```

### Existing Routes Reused As-Is

| Existing Route | How Editor Uses It |
|---------------|-------------------|
| `/api/apply-palette` | Apply palette constraint to current editor canvas |
| `/api/export-palette` | Export editor palette as .act/.gpl/.pal |
| `/api/generate-palette` | Generate palette from current canvas image |

No existing routes need modification.

---

## Architectural Patterns to Follow

### Pattern 1: Immediate Mode Pixel Buffer

**What:** Treat the pixel buffer as a framebuffer. All drawing operations mutate `EditorState.pixels` directly, then call `putImageData` to sync to canvas.
**When to use:** Every drawing operation (pencil, eraser, flood fill, transform apply).
**Trade-offs:** Simple and fast for pixel art sizes. Requires full-buffer putImageData calls, which is fine up to ~512×512.

**Example:**
```javascript
function setPixel(x, y, [r, g, b, a]) {
  const i = (y * EditorState.width + x) * 4;
  EditorState.pixels[i]   = r;
  EditorState.pixels[i+1] = g;
  EditorState.pixels[i+2] = b;
  EditorState.pixels[i+3] = a;
}
function flushPixels() {
  const id = new ImageData(EditorState.pixels, EditorState.width, EditorState.height);
  pixelCtx.putImageData(id, 0, 0);
}
```

### Pattern 2: Pre-commit Snapshot for Undo

**What:** Call `pushHistory()` once before any series of pixel mutations that constitute a single undoable action (a stroke, a fill, a transform). Never call it during continuous pointer movement.
**When to use:** `pointerdown` (first event of a stroke), fill execution, transform apply, canvas resize.
**Trade-offs:** Simple, no per-operation bookkeeping. Slightly more memory than delta encoding, acceptable at pixel art scale.

### Pattern 3: CSS Transform for Zoom (Not Canvas Scale)

**What:** Wrap all three canvases in a `div` with `transform: scale(zoom)`. Canvas coordinates stay 1:1 with image pixels.
**When to use:** Zoom and pan controls.
**Trade-offs:** Eliminates coordinate space confusion. Sub-pixel CSS rendering can cause visual blurring — mitigate with `image-rendering: pixelated` on canvases and `will-change: transform` on the container.

### Pattern 4: Palette Panel Extracted to Shared Module

**What:** The palette panel JavaScript from web_ui.html is extracted as a self-contained init function: `initPalettePanel(containerEl, onColorSelect, onPaletteChange)`. editor.html calls this function and wires callbacks.
**When to use:** Implementing the left panel palette section.
**Trade-offs:** Avoids rewriting palette logic. Requires careful extraction (palette state must move to EditorState.palette, not a local closure).

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing State in the DOM

**What people do:** Use DOM element values (input.value, dataset, classList) as the canonical source of tool state.
**Why it's wrong:** undo/redo cannot snapshot DOM state; palette sync breaks when DOM and JS diverge.
**Do this instead:** All state in `EditorState`. DOM is write-only (rendered from state). Inputs update EditorState on `input` events; rendering re-reads from EditorState.

### Anti-Pattern 2: Redrawing the Full Canvas on Every Pointer Move

**What people do:** Call `ctx.clearRect` + `ctx.putImageData` + draw selection overlay + draw cursor on every `pointermove`.
**Why it's wrong:** At high DPI zoom, this redraws megapixel data 60 times per second — causes jank on slower machines.
**Do this instead:** Use three separate canvas layers. `pixel-canvas` only redraws when pixels change. `selection-canvas` runs its own RAF loop. `cursor-canvas` redraws only on `pointermove` (cheap clear + simple shape draw).

### Anti-Pattern 3: Recursive Flood Fill

**What people do:** Implement flood fill as a recursive depth-first function.
**Why it's wrong:** Stack overflow on large contiguous areas (> ~4000 pixels deep).
**Do this instead:** Iterative BFS with an explicit stack array (shown above).

### Anti-Pattern 4: Merging Editor into web_ui.html

**What people do:** Add the editor UI directly into the 51K-line web_ui.html.
**Why it's wrong:** The file becomes unworkable. The two pages have incompatible layout requirements. Conditional show/hide logic becomes tangled.
**Do this instead:** Separate editor.html file, served via new Flask route `/editor`. Shared state passed via sessionStorage.

### Anti-Pattern 5: Using Canvas setTransform for Zoom

**What people do:** Apply zoom by calling `ctx.setTransform(zoom, 0, 0, zoom, panX, panY)` and drawing at image coordinates.
**Why it's wrong:** ImageData operations (getImageData, putImageData) are not affected by canvas transform — they always operate in physical canvas pixels. This creates a mismatch where the displayed image and the data model use different coordinate systems.
**Do this instead:** CSS transform on the container div, canvas always drawn at 1:1 pixel scale.

---

## Build Order (What Must Be Built Before What)

```
Phase 1: Foundation
  1a. EditorState object definition
  1b. Canvas layer setup (3 canvases, container, CSS)
  1c. viewportToCanvas coordinate transform
  1d. setPixel / getPixel / flushPixels helpers
  1e. CanvasRenderer.render() (putImageData)

Phase 2: History
  2a. pushHistory() / undo() / redo()
  2b. Keyboard shortcuts (⌘Z / ⇧⌘Z)
  2c. Undo/Redo buttons in top bar

Phase 3: Core Tools (no selection dependency)
  3a. Pencil tool (draw on pointerdown/move)
  3b. Eraser tool (draw transparent)
  3c. Paint Bucket (flood fill)
  3d. Tool options bar (brush size, shape, pixel-perfect, tolerance)
  3e. Color picker panel (HSL or simpler RGB wheel)

Phase 4: Palette Panel
  4a. Port palette state management from web_ui.html
  4b. Swatch grid rendering
  4c. Sync swatch click → foreground color
  4d. Sync color picker → swatch highlight
  4e. localStorage persistence

Phase 5: Selection Tools
  5a. Rectangle Marquee (grid-snapped)
  5b. Marching ants animation
  5c. Magic Wand (BFS with tolerance)
  5d. Deselect / Inverse
  5e. Selection-aware painting (pencil/eraser respect selection bounds)

Phase 6: Transform
  6a. Move Tool (translate selection contents)
  6b. Scale handles (8-point resize)
  6c. RotSprite rotation

Phase 7: Canvas Config & Integration
  7a. Canvas Size tool (4-guide preview)
  7b. "Open in Editor" button in web_ui.html
  7c. sessionStorage handoff
  7d. Download buttons (exact + scaled)
  7e. Flask /editor route
```

**Hard dependencies:**
- Phase 2 (history) requires Phase 1 (state + pixel buffer)
- Phase 3 (tools) requires Phase 2 (history for undo on strokes)
- Phase 5 (selection) requires Phase 3 (tools need to be selection-aware)
- Phase 6 (transform) requires Phase 5 (transforms operate on selections)
- Phase 7 (integration) requires all others

---

## Scaling Considerations

This is a local single-user tool. Scaling in the traditional sense does not apply.

| Concern | At Current Scale (local) | If Distributed Later |
|---------|--------------------------|---------------------|
| Canvas size | Pixel art: 16×16 to 512×512. Full Uint8ClampedArray fits comfortably in RAM. | Same — pixel art never gets large |
| History memory | 50 snapshots of 512×512×4 = 52 MB worst case. Acceptable for desktop. | Add compression (LZ4/pako) if needed |
| Undo stack | 50 entries sufficient | Configurable via EditorState.MAX_HISTORY |
| Flask as backend | Handles one user at a time. No concurrency issues. | Add gunicorn workers if multi-user needed |

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| editor.html ↔ web_ui.html | sessionStorage (image b64, grid metadata, palette) | One-way: main page writes, editor reads on load |
| editor.html ↔ Flask | fetch() JSON/FormData API | Same pattern as web_ui.html; reuses existing endpoints |
| EditorState ↔ PalettePanel | Pub/sub events + direct state reads | PalettePanel subscribes to 'color-changed', 'palette-changed' |
| EditorState ↔ CanvasRenderer | Direct call on 'pixels-changed' event | Renderer has no state; pure function of EditorState |
| ToolController ↔ EditorState | Direct mutation of EditorState.pixels | Tools are pure functions operating on the pixel buffer |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Flask /api/apply-palette | POST with image_b64 + palette JSON | Reused as-is from Ver 1.1; no changes needed |
| Flask /api/export-palette | POST with palette JSON | Reused as-is from Ver 1.1 |
| Flask /editor | GET, serves editor.html | New route, trivial to add |

---

## Sources

- Direct analysis of `/Users/calling/perfectPixel_ver1.1/web_ui.html` (actual codebase, 2026-03-02)
- Direct analysis of `/Users/calling/perfectPixel_ver1.1/web_app.py` (actual codebase, 2026-03-02)
- Direct analysis of `/Users/calling/perfectPixel_ver1.1/.planning/PROJECT.md` (requirements, 2026-03-02)
- MDN Web Docs: Canvas API, Pointer Events API, ImageData, sessionStorage (HIGH confidence — well-established browser APIs, stable since 2015+)
- Aseprite source reference: https://github.com/aseprite/aseprite (C++ reference implementation for RotSprite and pixel-perfect algorithms — MEDIUM confidence for JS reimplementation approach)
- Canvas layering pattern: established practice in all major pixel art editors (Piskel, Lospec, etc.) — HIGH confidence from domain knowledge

---

*Architecture research for: Browser-based pixel art editor in vanilla JS*
*Researched: 2026-03-02*
