# Phase 3 Context: Core Tools

**Phase**: 3 — Core Tools
**Goal**: User can draw, erase, and flood-fill pixels on the canvas, selecting colors with the permanent color picker
**Created**: 2026-03-03
**Status**: Ready for planning

---

## Summary of Decisions

Four gray areas were discussed and locked. All downstream agents must follow these decisions exactly — do NOT reopen them.

---

## A. Color Picker (CLR-01 / CLR-03 / CLR-04)

### Layout (permanent bottom-left panel, always visible)

```
┌─────────────────────────────┐
│  [HSL wheel canvas]         │
│                             │
│  Hex: [#rrggbb] [📋 copy]   │
│  R: [___]  G: [___]  B: [___] │
│  [eyedropper button]        │
│  ████ foreground swatch     │
└─────────────────────────────┘
```

### HSL Wheel Implementation

Use the **hue ring + inner SL square** approach (easiest to implement cleanly):
- Outer ring: conic gradient (hue 0°→360°) drawn on a `<canvas>` element
- Inner square: 2D gradient — left→right = saturation (0→100%), bottom→top = lightness (0%→100%), at the selected hue — computed and rendered each time hue changes
- Drag on ring → set hue; drag in square → set S+L
- Foreground color swatch below inputs reflects the current active color at all times

### Hex Input (CLR-03)

- Single `<input type="text">` accepting `#rrggbb` or `rrggbb` (6-digit hex, no 3-digit shorthand)
- Copy-to-clipboard button (📋 icon) next to it, uses `navigator.clipboard.writeText()`
- On blur/Enter: parse hex → update `EditorState.foregroundColor` → sync wheel + RGB boxes
- Validation: reject non-hex input silently (restore last valid hex on bad input)
- No alpha in hex (alpha is always 255 when drawn; color picker has no alpha channel)

### RGB Inputs (CLR-04)

- Three separate `<input type="number">` boxes, range 0–255, labeled R / G / B
- On change: clamp to 0–255 → update `EditorState.foregroundColor` → sync wheel + hex box
- No alpha input — the color picker never sets alpha; alpha is handled only by draw/erase ops

### Color State Management

All four controls (wheel, hex, R, G, B) are views of a single truth: `EditorState.foregroundColor = [r, g, b, 255]`.
On any change → update `EditorState.foregroundColor` → call `syncColorUI()` which updates all other controls.

---

## B. Brush Cursor Preview

### Behavior

- While any draw/erase tool is active and mouse is over the canvas, `cursor-canvas` shows a **filled solid preview** in the current foreground color
- Size exactly matches the brush (1px dot for size 1, pixel-circle-filled shape for size N)
- A 1px white (or inverted) outline wraps the preview to ensure visibility against any background color
- Drawn on `pointermove` on cursor-canvas, cleared on each frame with `clearRect`
- Preview color = `EditorState.foregroundColor` for Pencil; white/gray semi-transparent for Eraser (to indicate "erase" not "draw")
- When eyedropper is active: show a 1px crosshair + small color swatch preview (see Section C)

### Grid Alignment (Critical)

The preview is **pixel-grid-aligned**: each preview "block" corresponds to exactly one canvas pixel (one cell in `EditorState.pixels`), and the preview snaps to integer pixel coordinates — it never floats at sub-pixel positions.

- `viewportToCanvas()` already returns integer `[cx, cy]` via `Math.floor()` — use these snapped coordinates directly to draw the preview
- The preview moves in **discrete jumps** (pixel-by-pixel) rather than smoothly following the mouse
- Each preview pixel is rendered at the same size as one canvas pixel on screen, i.e., the CSS-scaled pixel size at the current zoom level
  - A single canvas pixel at zoom Z appears as `Z` CSS pixels on screen
  - Draw the preview using canvas pixel coordinates × 1 (no DPR factor for the pixel-space position), scaled by CSS zoom via `transform: scale(zoom)` on the container div
- The preview exactly predicts which pixels will be written to `EditorState.pixels` on click/drag

### Implementation

- `cursor-canvas` is already at z-index 3 and handles all pointer events
- On `pointermove`: call `drawCursorPreview(cx, cy)` where `(cx, cy)` comes from `viewportToCanvas()` → `clearRect` entire canvas → draw filled shape at the snapped integer pixel coords
- No DPR correction needed on cursor-canvas for the preview itself (it already scales with DPR)

---

## C. Eyedropper (CLR-02)

### Native HTML Picker Assessment

- `<input type="color">` opens OS color dialog — does NOT pick from screen in real-time. **Not usable.**
- `EyeDropper` Web API (`new EyeDropper()`) picks from anywhere on screen with native OS UI but: no hover preview, no alpha, no canvas-specific behavior. **Not suitable for pixel editor UX.**
- **Decision**: Custom canvas eyedropper tool implemented in JavaScript.

### Custom Eyedropper Behavior

- Eyedropper button lives in the permanent palette panel (NOT in the right tool sidebar)
- Clicking the button activates eyedropper mode: sets `EditorState._prevTool = EditorState.activeTool` then `EditorState.activeTool = 'eyedropper'`
- On `pointermove` over canvas: read pixel from `EditorState.pixels` at (cx, cy) → show live preview:
  - cursor-canvas draws a 1px crosshair at current pixel
  - palette panel shows a small "hover color swatch" next to the eyedropper button
- On `pointerdown` (click): set `EditorState.foregroundColor` from the hovered pixel → call `syncColorUI()` → restore `EditorState.activeTool = EditorState._prevTool` → clear eyedropper mode
- On `Escape` key: cancel eyedropper, restore previous tool, no color change
- If clicked pixel is transparent (alpha = 0): do NOT change foreground color (transparent is not a drawable color); show a visual indicator (e.g. "transparent" label in the hover preview)

---

## D. Brush Shape Definition

### Round Brush (Pixel Circle)

> "圆形是指实心的 Pixel Circle，即一种用像素构成的、带有锯齿感的圆形。"

- For size 1: single pixel
- For size N (N ≥ 2): fill all pixels within Euclidean radius = (N-1)/2 from center
  - `Math.sqrt((x - cx)² + (y - cy)²) <= (brushSize - 1) / 2`
  - This produces the classic aliased pixel circle with a natural jagged edge — correct for pixel art
- Pre-compute a stamp (offset array) for each brush size; reuse per stroke (don't recompute on every pixel)

### Square Brush

- For size N: fill an N×N block centered on the cursor pixel (floor for odd sizes)

### Pixel-Perfect Mode (DRAW-03)

- Only applies to Pencil (not Eraser or Bucket)
- Algorithm: after each pixel is placed on `pointermove`, check if the newly placed pixel creates a "double diagonal" — i.e., the last three points form an L-corner where the corner pixel is redundant for line continuity
- If so, do NOT draw the corner pixel
- Implementation: track the last drawn pixel; on each new pixel, if `abs(dx) == 1 && abs(dy) == 1` AND the previous pixel was also diagonal, remove the shared corner
- Push to `EditorState.pixels` as normal; the check runs before `setPixel`

---

## E. Color Mode Constraint (Global — enforced from Phase 3 onward)

> This constraint was added to ROADMAP.md as a global note. All phases inherit it.

- Every `setPixel` call from any tool MUST produce alpha = 255 (draw) or alpha = 0 (erase)
- **No tool or operation may produce alpha values between 1 and 254**
- On image load: semi-transparent pixels from the original file are left **as-is** — no normalization, no clamping
- Palette counting functions: skip any pixel where alpha < 255 (i.e. transparent or semi-transparent pixels are excluded from palette color counts)

---

## Code Context

### What Already Exists in editor.html

These patterns are live and must be preserved:

```javascript
// EditorState already has:
EditorState.foregroundColor = [0, 0, 0, 255];
EditorState.toolOptions = {
  brushSize: 1, brushShape: 'round',
  pixelPerfect: false,
  bucketTolerance: 15, wandTolerance: 15,
  contiguous: true,
};

// Already implemented helpers:
function getPixel(x, y) { /* reads EditorState.pixels */ }
function setPixel(x, y, [r,g,b,a]) { /* writes EditorState.pixels */ }
function flushPixels() { /* putImageData from EditorState.pixels */ }
function pushHistory() { /* save-after model, called on pointerup */ }
```

### Phase 2 Scaffold to Remove

The `_scaffoldClick` listener in `cursorCanvas.addEventListener('pointerdown', ...)` must be removed as the very first task of Phase 3.

### Tool Dispatch Pattern

Use the object dispatch pattern from CLAUDE.md:
```javascript
const tools = {
  pencil: { onDown, onMove, onUp, onCursor },
  eraser: { onDown, onMove, onUp, onCursor },
  bucket: { onDown, onMove, onUp, onCursor },
  eyedropper: { onDown, onMove, onUp, onCursor },
};
// Pointer handler delegates to tools[EditorState.activeTool]
```

### History Convention (Phase 2 established)

- Save-after model: `pushHistory()` is called AFTER pixels are committed
- Stroke tools (Pencil, Eraser): push on `pointerup`
- Instant tools (Bucket): push immediately after fill completes
- Do NOT push on `pointermove`

---

## Deferred Ideas (Not in Phase 3 Scope)

- Grid overlay reference lines on canvas (mentioned in DRAW-V2-02 — Phase TBD)
- Hollow/outline brush shape (user only asked for filled solid)
- Alpha/opacity slider for foreground color (explicitly excluded by color mode constraint)
- Brush pressure sensitivity
