# Phase 3: Core Tools - Research

**Researched:** 2026-03-03
**Domain:** Browser Canvas 2D API — pixel art drawing tools, color picker, flood fill
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**A. Color Picker (CLR-01 / CLR-03 / CLR-04)**

Layout: permanent bottom-left panel, always visible.

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

HSL Wheel: hue ring + inner SL square approach.
- Outer ring: conic gradient (hue 0°→360°) drawn on a `<canvas>` element
- Inner square: 2D gradient — left→right = saturation (0→100%), bottom→top = lightness (0%→100%), at the selected hue — computed and rendered each time hue changes
- Drag on ring → set hue; drag in square → set S+L

Hex Input: single `<input type="text">` accepting `#rrggbb` or `rrggbb` (6-digit only, no 3-digit shorthand). Copy button uses `navigator.clipboard.writeText()`. On blur/Enter: parse hex → update `EditorState.foregroundColor` → sync wheel + RGB boxes. Reject non-hex input silently (restore last valid hex). No alpha.

RGB Inputs: three `<input type="number">` boxes, range 0–255, labeled R / G / B. On change: clamp → update `EditorState.foregroundColor` → sync wheel + hex. No alpha input.

State management: All four controls are views of `EditorState.foregroundColor = [r, g, b, 255]`. On any change → update `EditorState.foregroundColor` → call `syncColorUI()` which updates all other controls.

**B. Brush Cursor Preview**

- Filled solid preview in foreground color on cursor-canvas
- Size exactly matches brush; 1px white/inverted outline wraps it
- Drawn on `pointermove`, cleared with `clearRect` each frame
- Eraser preview: white/gray semi-transparent (not foreground color)
- Preview is pixel-grid-aligned — snaps to integer coords from `viewportToCanvas()`
- Preview moves in discrete jumps (pixel-by-pixel), not smooth
- Each preview pixel = one CSS-scaled pixel at current zoom

**C. Eyedropper (CLR-02)**

- Custom canvas eyedropper (NOT native `<input type="color">` or `EyeDropper` Web API)
- Eyedropper button lives in permanent palette panel (NOT right tool sidebar)
- Clicking activates eyedropper mode: `EditorState._prevTool = EditorState.activeTool` then `EditorState.activeTool = 'eyedropper'`
- `pointermove`: read from `EditorState.pixels` → show 1px crosshair + small hover color swatch
- `pointerdown`: set `EditorState.foregroundColor` → `syncColorUI()` → restore `EditorState.activeTool = EditorState._prevTool`
- `Escape`: cancel, restore previous tool, no color change
- Transparent pixel (alpha = 0): do NOT change foreground color; show "transparent" indicator

**D. Brush Shape Definition**

Round brush (Pixel Circle):
- Size 1: single pixel
- Size N ≥ 2: fill pixels where `Math.sqrt((x-cx)² + (y-cy)²) <= (brushSize-1)/2`
- Pre-compute a stamp (offset array) for each brush size; reuse per stroke

Square brush: N×N block centered on cursor pixel (floor for odd sizes).

Pixel-Perfect Mode (DRAW-03 — Pencil only):
- After each pixel on `pointermove`, check if newly placed pixel creates "double diagonal" L-corner
- If `abs(dx) == 1 && abs(dy) == 1` AND previous pixel was also diagonal → do NOT draw corner pixel
- Runs check before `setPixel`; tracks last drawn pixel

**E. Color Mode Constraint (Global)**

- Every `setPixel` from any tool MUST produce alpha = 255 (draw) or alpha = 0 (erase)
- No tool may produce alpha values between 1 and 254
- On image load: semi-transparent pixels left as-is (no normalization)
- Palette counting: skip pixels where alpha < 255

### Claude's Discretion

None documented in CONTEXT.md beyond the above locked decisions.

### Deferred Ideas (OUT OF SCOPE)

- Grid overlay reference lines on canvas (DRAW-V2-02 — Phase TBD)
- Hollow/outline brush shape (user only asked for filled solid)
- Alpha/opacity slider for foreground color (excluded by color mode constraint)
- Brush pressure sensitivity
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DRAW-01 | Pencil Tool (B): support round (Pixel Circle) / square brush head | Brush stamp algorithm; Euclidean pixel circle; square N×N block |
| DRAW-02 | Pencil Tool (B): support brush diameter from 1px (integer only) | Stamp pre-computation per size; `brushSize` from `EditorState.toolOptions` |
| DRAW-03 | Pencil Tool (B): support Pixel-perfect mode checkbox | L-corner detection algorithm: check last 3 points for diagonal corner |
| DRAW-04 | Paint Bucket Tool (G): support Tolerance parameter (numeric input) | Iterative BFS flood fill with per-channel axis-aligned tolerance comparison |
| DRAW-05 | Paint Bucket Tool (G): support Contiguous checkbox | BFS = contiguous; non-contiguous = scan all pixels matching tolerance |
| DRAW-06 | Eraser Tool (E): share shape/diameter/pixel-perfect logic with Pencil; writes alpha=0 | Same stamp logic, setPixel with [r,g,b,0]; Eraser inherits pencil brush options |
| CLR-01 | Permanent color picker (HSL wheel), bottom-left, always visible | HSL hue ring via `createConicGradient`; SL square via layered `createLinearGradient` |
| CLR-02 | Eyedropper: click canvas pixel → sync to palette | Custom canvas eyedropper reading `EditorState.pixels`; prev-tool restore pattern |
| CLR-03 | Hex color input (manual entry) | `<input type="text">` parsing; `navigator.clipboard.writeText()` for copy button |
| CLR-04 | RGB three-channel numeric inputs (manual entry) | Three `<input type="number">` 0-255; clamp + `syncColorUI()` |
</phase_requirements>

---

## Summary

Phase 3 is a pure browser-side implementation — no external libraries, no build step, no new dependencies. All implementation goes into `editor.html` (single self-contained file). The technical domain spans three areas: (1) pixel manipulation algorithms (brush stamp, flood fill, pixel-perfect line), (2) Canvas 2D rendering (HSL color wheel, brush cursor preview), and (3) UI event wiring (tool dispatch, keyboard shortcuts, color sync).

The core architectural constraint is the tool dispatch pattern: all tools expose `onDown(x,y,e)`, `onMove(x,y,e)`, `onUp(x,y,e)`, `onCursor(x,y)` methods keyed in a `tools` object, with `cursorCanvas` pointer events delegating to `tools[EditorState.activeTool]`. The history model (save-after, push on `pointerup` for stroke tools, push immediately for bucket) is already established in Phase 2 and must be followed exactly.

The HSL color picker is the most complex new UI component. It requires two canvas elements (or one redrawn dual-purpose canvas): an outer hue ring drawn with `createConicGradient` (baseline widely available since April 2023) and an inner SL square drawn with two layered `createLinearGradient` fills. All four color controls (wheel, hex, R/G/B inputs) must share a single `syncColorUI()` update path to prevent infinite sync loops.

**Primary recommendation:** Implement in this task order: (1) remove Phase 2 scaffold, (2) tool dispatch infrastructure + keyboard shortcuts, (3) brush stamp utility, (4) Pencil tool, (5) Eraser tool, (6) Paint Bucket tool (BFS), (7) HSL color picker panel, (8) eyedropper, (9) top-bar tool settings (brush size/shape, pixel-perfect, tolerance, contiguous). This ordering keeps each task independently testable.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Canvas 2D API | Browser-native | Pixel read/write, gradient rendering, cursor preview | Only option for direct pixel manipulation without extra dependencies |
| Pointer Events API | Browser-native | Touch/mouse/stylus unified input | Already used in Phase 1-2; `setPointerCapture` works for drag outside canvas |
| `navigator.clipboard` | Browser-native (baseline 2020) | Copy hex to clipboard | No library needed; Promise-based; secure-context requirement met by localhost |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `createConicGradient` | Baseline since April 2023 | Hue ring rendering | Drawing HSL wheel outer ring; all modern browsers supported |
| `createLinearGradient` | Baseline always | SL square gradient layers | Two-pass fill: saturation L→R then lightness overlay T→B |
| `Uint8Array` (visited bitmap) | Browser-native | BFS flood fill visited tracking | Prevents O(n²) revisit explosion; faster than Set for large images |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `createConicGradient` for hue ring | Draw pixel-by-pixel using `hslToRgb` | Slower; only needed for browsers before 2023 — not a concern here |
| Custom canvas eyedropper | Native `EyeDropper` Web API | EyeDropper has no hover preview, no alpha, modal OS dialog — wrong UX for pixel editor |
| Native `<input type="color">` | — | Opens OS color dialog, no real-time canvas interaction — not usable |
| Recursive flood fill | Iterative BFS | Recursive stack-overflows at ~4000px; iterative is required |

**Installation:** None. Zero new dependencies. Everything in browser APIs.

---

## Architecture Patterns

### Recommended Code Structure (within editor.html `<script>`)

```
// ── Phase 3 additions, in order ──────────────────────────────────────────
// 1. Brush stamp utilities     (getBrushStamp, drawBrushAtPixel)
// 2. Tool implementations      (tools.pencil, tools.eraser, tools.bucket, tools.eyedropper)
// 3. Tool dispatch wiring      (cursorCanvas pointerdown/move/up → tools[activeTool])
// 4. Tool shortcut keys        (B, E, G, W, M, V added to keydown handler)
// 5. HSL color picker panel    (HTML injected into #left-panel bottom, or hardcoded)
// 6. syncColorUI()             (single update path for all color controls)
// 7. Top-bar tool settings     (brush size, shape, pixel-perfect, tolerance, contiguous)
```

### Pattern 1: Tool Object Dispatch

**What:** All tools exposed as methods on a keyed object; pointer handler delegates blindly.
**When to use:** Every pointer event on cursorCanvas.

```javascript
// Source: CLAUDE.md "Tool objects expose onDown/onMove/onUp/onCursor methods"
const tools = {
  pencil:      { onDown(x,y,e){}, onMove(x,y,e){}, onUp(x,y,e){}, onCursor(x,y){} },
  eraser:      { onDown(x,y,e){}, onMove(x,y,e){}, onUp(x,y,e){}, onCursor(x,y){} },
  bucket:      { onDown(x,y,e){}, onMove(x,y,e){}, onUp(x,y,e){}, onCursor(x,y){} },
  eyedropper:  { onDown(x,y,e){}, onMove(x,y,e){}, onUp(x,y,e){}, onCursor(x,y){} },
};

// Pointer handler wiring (replaces the Phase 2 _scaffoldClick):
let isDrawing = false;
cursorCanvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  cursorCanvas.setPointerCapture(e.pointerId);
  if (!EditorState.pixels) return;
  isDrawing = true;
  const [cx, cy] = viewportToCanvas(e.clientX, e.clientY);
  tools[EditorState.activeTool]?.onDown(cx, cy, e);
});
cursorCanvas.addEventListener('pointermove', e => {
  if (!EditorState.pixels) return;
  const [cx, cy] = viewportToCanvas(e.clientX, e.clientY);
  tools[EditorState.activeTool]?.onCursor(cx, cy);    // cursor preview always
  if (isDrawing) tools[EditorState.activeTool]?.onMove(cx, cy, e);
});
cursorCanvas.addEventListener('pointerup', e => {
  if (!isDrawing) return;
  isDrawing = false;
  const [cx, cy] = viewportToCanvas(e.clientX, e.clientY);
  tools[EditorState.activeTool]?.onUp(cx, cy, e);
});
cursorCanvas.addEventListener('pointercancel', () => { isDrawing = false; });
```

### Pattern 2: Brush Stamp (Pre-computed Offsets)

**What:** Pre-compute a list of `[dx, dy]` offsets for each brush size and shape. Reuse per stroke — never recompute on every pixel.
**When to use:** Pencil, Eraser — called in `onDown` and `onMove`.

```javascript
// Source: CONTEXT.md Section D; CLAUDE.md brush algorithm
function getBrushStamp(size, shape) {
  const offsets = [];
  if (size === 1) return [[0, 0]];
  if (shape === 'round') {
    const r = (size - 1) / 2;
    for (let dy = -Math.floor(r); dy <= Math.ceil(r); dy++) {
      for (let dx = -Math.floor(r); dx <= Math.ceil(r); dx++) {
        if (Math.sqrt(dx * dx + dy * dy) <= r) offsets.push([dx, dy]);
      }
    }
  } else { // square
    const half = Math.floor(size / 2);
    for (let dy = -half; dy <= half; dy++)
      for (let dx = -half; dx <= half; dx++)
        offsets.push([dx, dy]);
  }
  return offsets;
}

function applyStamp(cx, cy, stamp, color) {
  // color is [r, g, b, a] — caller sets a=255 for pencil, a=0 for eraser
  for (const [dx, dy] of stamp) {
    const x = cx + dx, y = cy + dy;
    if (x >= 0 && x < EditorState.width && y >= 0 && y < EditorState.height)
      setPixel(x, y, color);
  }
  flushPixels();
}
```

### Pattern 3: Pencil Tool (with save-after history and pixel-perfect)

**What:** Stroke tool that draws using brush stamp; one history entry per pointerdown→pointerup.
**When to use:** `activeTool === 'pencil'`

```javascript
// Source: CONTEXT.md Section D; CLAUDE.md history convention
let _lastPencilX = null, _lastPencilY = null;
let _pencilStamp = null;

tools.pencil = {
  onDown(x, y) {
    _pencilStamp = getBrushStamp(EditorState.toolOptions.brushSize, EditorState.toolOptions.brushShape);
    _lastPencilX = x; _lastPencilY = y;
    applyStamp(x, y, _pencilStamp, [...EditorState.foregroundColor]);
    // Note: NO pushHistory here — save-after model; push on pointerup
  },
  onMove(x, y) {
    if (_lastPencilX === x && _lastPencilY === y) return; // no movement
    // Line interpolation between last and current position
    const pts = bresenhamLine(_lastPencilX, _lastPencilY, x, y);
    for (const [px, py] of pts) {
      if (EditorState.toolOptions.pixelPerfect) {
        // pixel-perfect check: skip if forms L-corner (see Pattern 5)
        if (shouldSkipPixelPerfect(px, py)) continue;
      }
      applyStamp(px, py, _pencilStamp, [...EditorState.foregroundColor]);
    }
    _lastPencilX = x; _lastPencilY = y;
  },
  onUp() {
    pushHistory(); // save-after: push AFTER stroke completes
    _lastPencilX = null; _lastPencilY = null;
  },
  onCursor(x, y) { drawCursorPreview(x, y, EditorState.foregroundColor); },
};
```

### Pattern 4: Iterative BFS Flood Fill

**What:** Iterative BFS with visited bitmap; replaces any recursive approach.
**When to use:** Paint Bucket tool `onDown`. Also basis for non-contiguous variant.

```javascript
// Source: CLAUDE.md "Flood fill must be iterative BFS"
function floodFill(startX, startY, fillColor, tolerance, contiguous) {
  const targetColor = getPixel(startX, startY);
  if (targetColor[3] === 0 && fillColor[3] === 0) return; // fill transparent with transparent = noop

  function colorMatches(px, py) {
    const [r, g, b, a] = getPixel(px, py);
    if (targetColor[3] === 0 && a === 0) return true; // both transparent
    if (targetColor[3] === 0 || a === 0) return false; // one transparent, other not
    return Math.abs(r - targetColor[0]) <= tolerance &&
           Math.abs(g - targetColor[1]) <= tolerance &&
           Math.abs(b - targetColor[2]) <= tolerance &&
           Math.abs(a - targetColor[3]) <= tolerance;
  }

  if (contiguous) {
    // BFS: mark visited BEFORE pushing (prevents exponential revisit)
    const visited = new Uint8Array(EditorState.width * EditorState.height);
    visited[startX + startY * EditorState.width] = 1;
    const stack = [startX + startY * EditorState.width];
    while (stack.length) {
      const idx = stack.pop();
      const px = idx % EditorState.width;
      const py = Math.floor(idx / EditorState.width);
      setPixel(px, py, fillColor);
      for (const [nx, ny] of [[px-1,py],[px+1,py],[px,py-1],[px,py+1]]) {
        if (nx < 0 || nx >= EditorState.width || ny < 0 || ny >= EditorState.height) continue;
        const ni = nx + ny * EditorState.width;
        if (!visited[ni] && colorMatches(nx, ny)) {
          visited[ni] = 1;  // mark BEFORE push
          stack.push(ni);
        }
      }
    }
  } else {
    // Non-contiguous: scan all pixels matching target color
    for (let y = 0; y < EditorState.height; y++)
      for (let x = 0; x < EditorState.width; x++)
        if (colorMatches(x, y)) setPixel(x, y, fillColor);
  }
  flushPixels();
}

tools.bucket = {
  onDown(x, y) {
    floodFill(x, y, [...EditorState.foregroundColor],
      EditorState.toolOptions.bucketTolerance,
      EditorState.toolOptions.contiguous);
    pushHistory(); // instant-apply tool: push immediately after fill
  },
  onMove() {}, onUp() {},
  onCursor(x, y) { drawCursorPreview(x, y, EditorState.foregroundColor); },
};
```

### Pattern 5: Pixel-Perfect Mode

**What:** After each pixel placement on `pointermove`, check if the new pixel is the redundant corner of an L-shape (forms a "double diagonal").
**Algorithm:** Track the last two placed pixels `[prev2, prev1]`. On new pixel `cur`:
- If `prev1` is on the same row or column as `prev2` AND on the same row or column as `cur`
- AND `prev2` and `cur` differ in both X and Y (true diagonal)
- Then `prev1` is the L-corner: erase it (set back to previous color or skip drawing it)

```javascript
// Source: CONTEXT.md Section D; rickyhan.com pixel-perfect algorithm
// Track last 3 pixels: [p2, p1, cur]
// Skip cur if: (p1.x === p2.x || p1.y === p2.y) AND (p1.x === cur.x || p1.y === cur.y)
//               AND p2.x !== cur.x AND p2.y !== cur.y
let _ppHistory = []; // [[x, y], [x, y]] — last two placed pixels

function shouldSkipPixelPerfect(cx, cy) {
  if (_ppHistory.length < 2) { _ppHistory.push([cx, cy]); return false; }
  const [p2, p1] = _ppHistory;
  const sharesAxisWithP2 = (p1[0] === p2[0] || p1[1] === p2[1]);
  const sharesAxisWithCur = (p1[0] === cx    || p1[1] === cy);
  const curDiffersFromP2  = (p2[0] !== cx && p2[1] !== cy);
  const skip = sharesAxisWithP2 && sharesAxisWithCur && curDiffersFromP2;
  _ppHistory = [p1, [cx, cy]];
  return skip;
}
```

### Pattern 6: HSL Color Picker Canvas

**What:** Two-layer canvas rendering for HSL hue ring + SL square. Redraws SL square whenever hue changes.
**When to use:** `initColorPicker()` and whenever `EditorState.foregroundColor` changes.

```javascript
// Source: MDN createConicGradient (baseline April 2023); MDN createLinearGradient
// Assumes: pickerCanvas = dedicated <canvas> for the color wheel
//          pickerCtx = 2d context for that canvas
// State: let currentHue = 0, currentSat = 100, currentLit = 50;

function drawHueRing(ctx, cx, cy, outerR, innerR) {
  // Hue ring: conic gradient starting at top (-π/2)
  const grad = ctx.createConicGradient(-Math.PI / 2, cx, cy);
  const stops = [0,'#f00'],[1/6,'#ff0'],[2/6,'#0f0'],[3/6,'#0ff'],[4/6,'#00f'],[5/6,'#f0f'],[1,'#f00'];
  stops.forEach(([pos, color]) => grad.addColorStop(pos, color));

  // Draw as ring: outer circle clockwise, inner circle counterclockwise
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, 2 * Math.PI);
  ctx.arc(cx, cy, innerR, 0, 2 * Math.PI, true);
  ctx.fillStyle = grad;
  ctx.fill();
}

function drawSLSquare(ctx, x, y, w, h, hue) {
  // Pass 1: saturation gradient (left=gray, right=full hue color)
  const satGrad = ctx.createLinearGradient(x, y, x + w, y);
  satGrad.addColorStop(0, `hsl(${hue}, 0%, 50%)`);
  satGrad.addColorStop(1, `hsl(${hue}, 100%, 50%)`);
  ctx.fillStyle = satGrad;
  ctx.fillRect(x, y, w, h);

  // Pass 2: lightness overlay (top=white, middle=transparent, bottom=black)
  const litGrad = ctx.createLinearGradient(x, y, x, y + h);
  litGrad.addColorStop(0,   'rgba(255,255,255,1)');
  litGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
  litGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
  litGrad.addColorStop(1,   'rgba(0,0,0,1)');
  ctx.fillStyle = litGrad;
  ctx.fillRect(x, y, w, h);
}
```

### Pattern 7: syncColorUI — Single Sync Path

**What:** Any color control change calls `syncColorUI()` which updates all other controls. Prevents sync loops via a re-entrancy guard.
**When to use:** After any of the four controls (wheel, hex, R, G, B) updates `EditorState.foregroundColor`.

```javascript
// Source: CONTEXT.md Section A "Color State Management"
let _syncLock = false;
function syncColorUI() {
  if (_syncLock) return;
  _syncLock = true;
  const [r, g, b] = EditorState.foregroundColor;

  // Update hex input
  document.getElementById('clr-hex').value =
    '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

  // Update RGB inputs
  document.getElementById('clr-r').value = r;
  document.getElementById('clr-g').value = g;
  document.getElementById('clr-b').value = b;

  // Update foreground swatch
  document.getElementById('clr-swatch').style.background = `rgb(${r},${g},${b})`;

  // Recompute HSL and redraw SL square + indicator dot
  const [h, s, l] = rgbToHsl(r, g, b);
  currentHue = h; currentSat = s; currentLit = l;
  drawSLSquare(pickerCtx, SQ_X, SQ_Y, SQ_W, SQ_H, h);
  drawIndicatorDot(pickerCtx, h, s, l);

  _syncLock = false;
}
```

### Pattern 8: Bresenham Line Interpolation

**What:** Fill in all pixels between two points during a stroke (no gaps when mouse moves fast).
**When to use:** `pencil.onMove` and `eraser.onMove` to interpolate between previous and current position.

```javascript
// Source: Classic algorithm, well-established, no external library needed
function bresenhamLine(x0, y0, x1, y1) {
  const pts = [];
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    pts.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 <  dx) { err += dx; y0 += sy; }
  }
  return pts;
}
```

### Pattern 9: HSL↔RGB Conversion

**What:** Pure math conversion needed to sync HSL wheel with RGB/hex inputs.

```javascript
// Source: Industry-standard algorithm (matches browser HSL→RGB serialization)
function hslToRgb(h, s, l) {
  // h: 0-360, s: 0-100, l: 0-100
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)]; // achromatic
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}
```

### Pattern 10: Cursor Preview Drawing

**What:** Render a filled brush-shape preview on cursor-canvas at integer pixel coordinates.
**When to use:** All tool `onCursor()` implementations.

```javascript
// Source: CONTEXT.md Section B "Brush Cursor Preview"
function drawCursorPreview(cx, cy, color) {
  cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
  const stamp = getBrushStamp(EditorState.toolOptions.brushSize, EditorState.toolOptions.brushShape);
  // DPR already applied to cursorCtx via scale() in initCanvases
  // Each "canvas pixel" is 1 unit in cursorCtx (DPR-scaled already)
  const [r, g, b, a] = color;
  for (const [dx, dy] of stamp) {
    cursorCtx.fillStyle = `rgba(${r},${g},${b},${a/255})`;
    cursorCtx.fillRect(cx + dx, cy + dy, 1, 1);
  }
  // 1px white outline — draw pixel border around stamp for visibility
  cursorCtx.strokeStyle = 'rgba(255,255,255,0.8)';
  cursorCtx.lineWidth = 1 / (window.devicePixelRatio || 1);
  // Simple bounding box outline as fallback:
  const size = EditorState.toolOptions.brushSize;
  const half = Math.floor(size / 2);
  cursorCtx.strokeRect(cx - half - 0.5, cy - half - 0.5, size + 1, size + 1);
}
```

### Anti-Patterns to Avoid

- **Reading pixels from canvas element:** Never `ctx.getImageData()` in tool logic — always `EditorState.pixels`. Premultiplied alpha corrupts RGBA values on round-trips.
- **Pushing history on `pointermove`:** Fills undo stack in one stroke (each mouse move = one entry). Push only on `pointerup` for stroke tools.
- **Recursive flood fill:** Stack-overflows on regions > ~4000px. Always use iterative BFS.
- **Marking visited after push (not before):** Causes exponential revisit. Mark visited BEFORE pushing to stack.
- **Using ctx.setTransform for zoom:** `putImageData`/`getImageData` ignore canvas transforms; coordinate system breaks. CSS transform only.
- **Infinite sync loop in color controls:** Multiple controls updating each other without guard causes infinite recursion. Use `_syncLock` flag.
- **Sub-pixel cursor preview:** Preview must snap to integer canvas coordinates (from `viewportToCanvas()` which already floors). Never draw at float positions.
- **Setting alpha between 1-254 in draw ops:** Violates the global color mode constraint. Pencil writes alpha=255, Eraser writes alpha=0, nothing in between.
- **Recomputing brush stamp on every pixel:** Pre-compute once at `pointerdown`; reuse for entire stroke.
- **DPR applied to pixel-canvas:** pixel-canvas must be exactly `EditorState.width × EditorState.height`. Only overlay canvases use DPR scaling.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color wheel gradient rendering | Pixel-by-pixel HSL canvas loop | `createConicGradient` + `createLinearGradient` | Browser-native, hardware-accelerated; pixel loop is slow and brittle |
| Clipboard access | Custom clipboard buffer | `navigator.clipboard.writeText()` | Security gated by user gesture; browser API handles permissions |
| Line interpolation | "Skip pixels" between mouse events | Bresenham line algorithm | Fast mouse movement produces gaps without interpolation |
| Flood fill visited tracking | `Set` of pixel indices | `Uint8Array` visited bitmap | Set is ~10x slower and uses more memory for large images |
| Color conversion | CSS string parsing hacks | `hslToRgb` / `rgbToHsl` pure math | Reliable, no DOM dependency, works in all contexts |

**Key insight:** This phase is 100% Canvas 2D API — the browser provides everything needed. The complexity is in algorithmic correctness (BFS marking, Bresenham, pixel-perfect) not in library selection.

---

## Common Pitfalls

### Pitfall 1: Visited-After-Push in BFS Flood Fill
**What goes wrong:** BFS stack grows exponentially; fill takes seconds or freezes tab on even small fills.
**Why it happens:** If you mark visited when popping (not pushing), the same pixel gets pushed multiple times from its 4 neighbors before being popped.
**How to avoid:** Mark `visited[idx] = 1` immediately before or at the same time as `stack.push(idx)`. Never after.
**Warning signs:** Fill appears to work but is slow; stack length in console reaches millions.

### Pitfall 2: Sync Loop in Color Picker Controls
**What goes wrong:** Changing hex input triggers RGB update which triggers wheel redraw which triggers hex update → infinite loop → stack overflow.
**Why it happens:** Event listeners on all controls fire changes that update each other.
**How to avoid:** Use `_syncLock = true` at start of `syncColorUI()`, `_syncLock = false` at end. Check guard at entry.
**Warning signs:** Browser freezes on first color input; console shows "Maximum call stack exceeded".

### Pitfall 3: History Push on Move (not Up)
**What goes wrong:** One drawing stroke fills entire undo stack; Cmd+Z only undoes individual pixels.
**Why it happens:** Calling `pushHistory()` in `pointermove` handler.
**How to avoid:** For Pencil/Eraser, push ONLY in `onUp()`. For Bucket, push immediately after fill in `onDown()`.
**Warning signs:** Undo only steps back one pixel at a time; history fills up in one stroke.

### Pitfall 4: Missing Bresenham Interpolation
**What goes wrong:** Fast mouse movements leave gaps (dotted line instead of solid stroke).
**Why it happens:** `pointermove` fires less frequently than mouse speed; consecutive events can be far apart.
**How to avoid:** Always interpolate between `_lastX, _lastY` and current position using `bresenhamLine()`.
**Warning signs:** Stroke has gaps at corners or when moving mouse quickly.

### Pitfall 5: Pixel-Perfect Mode Resets Between Strokes
**What goes wrong:** Pixel-perfect history array `_ppHistory` retains state from previous stroke; first pixels of new stroke behave incorrectly.
**Why it happens:** `_ppHistory` not cleared on `pointerdown`.
**How to avoid:** Reset `_ppHistory = []` at the start of each `onDown()` call in Pencil tool.
**Warning signs:** First 1-2 pixels of each new stroke are skipped unexpectedly.

### Pitfall 6: Eraser Sets Wrong Alpha
**What goes wrong:** Eraser produces semi-transparent pixels (e.g., alpha=128) instead of fully transparent.
**Why it happens:** Eraser inherits foreground color including alpha=255; forgets to override alpha.
**How to avoid:** Eraser's `applyStamp` must always use `[r, g, b, 0]` regardless of foreground color — the r/g/b values don't matter but alpha MUST be 0.
**Warning signs:** Erased area shows semi-transparent checkerboard instead of fully transparent.

### Pitfall 7: Hue Ring Pointer Hit Testing
**What goes wrong:** Dragging inside the SL square triggers hue ring update (or vice versa); controls interfere.
**Why it happens:** Both ring and square share the same canvas element; hit test logic is wrong.
**How to avoid:** On `pointerdown` on picker canvas, determine zone by checking if distance from center falls in `[innerR, outerR]` range (ring) vs `< innerR` range (square). Set `_pickerDragZone = 'ring' | 'square'` and lock to that zone for the drag.
**Warning signs:** Dragging in SL square also rotates hue; jumpy hue changes while moving in the square.

### Pitfall 8: `createConicGradient` Hue Offset
**What goes wrong:** Hue ring starts red at right (3 o'clock) instead of top (12 o'clock).
**Why it happens:** `createConicGradient(startAngle, x, y)` measures startAngle from positive X axis (right), not top.
**How to avoid:** Pass `startAngle = -Math.PI / 2` to start the gradient from 12 o'clock. Also ensure hue ring pointer-to-hue math uses the same offset: `hue = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360`.
**Warning signs:** Red is at 3 o'clock position; hue picked from ring is off by 90°.

### Pitfall 9: Non-Contiguous Bucket Tolerance
**What goes wrong:** Non-contiguous fill replaces pixels that don't match the target color.
**Why it happens:** Tolerance comparison uses target color from `startX, startY` — correct. But if startX,startY has a different color (e.g., you clicked a light pixel and tolerance is high), many unintended pixels match.
**How to avoid:** This is correct behavior — document it. Non-contiguous mode compares each pixel to the target color at click position, not to the fill color. No bug to fix; just be clear in implementation.

---

## Code Examples

Verified patterns from CLAUDE.md and MDN official docs:

### HSL Hue Ring with createConicGradient
```javascript
// Source: MDN createConicGradient — baseline since April 2023
// startAngle = -Math.PI/2 so red starts at top (12 o'clock)
const hueGrad = pickerCtx.createConicGradient(-Math.PI / 2, cx, cy);
hueGrad.addColorStop(0,     '#ff0000'); // red at top
hueGrad.addColorStop(1/6,   '#ffff00'); // yellow
hueGrad.addColorStop(2/6,   '#00ff00'); // green
hueGrad.addColorStop(3/6,   '#00ffff'); // cyan
hueGrad.addColorStop(4/6,   '#0000ff'); // blue
hueGrad.addColorStop(5/6,   '#ff00ff'); // magenta
hueGrad.addColorStop(1,     '#ff0000'); // back to red
pickerCtx.fillStyle = hueGrad;
// Draw ring (outer clockwise, inner counterclockwise):
pickerCtx.beginPath();
pickerCtx.arc(cx, cy, outerR, 0, 2 * Math.PI);
pickerCtx.arc(cx, cy, innerR, 0, 2 * Math.PI, true);
pickerCtx.fill();
```

### Navigator Clipboard Write
```javascript
// Source: MDN Clipboard API — baseline since March 2020
// Requires user gesture (button click) and secure context (localhost qualifies)
document.getElementById('clr-copy').addEventListener('click', () => {
  const hex = document.getElementById('clr-hex').value;
  navigator.clipboard.writeText(hex).catch(() => {
    // Fallback: execCommand('copy') for older browsers (deprecated but works)
  });
});
```

### Pixel Read Pattern (always from EditorState.pixels)
```javascript
// Source: CLAUDE.md "Pixel read/write (always through EditorState.pixels)"
function getPixel(x, y) {
  const i = (y * EditorState.width + x) * 4;
  return [EditorState.pixels[i], EditorState.pixels[i+1],
          EditorState.pixels[i+2], EditorState.pixels[i+3]];
}
```

### setPixel Pattern
```javascript
// Source: CLAUDE.md "Key Patterns"
function setPixel(x, y, [r, g, b, a]) {
  const i = (y * EditorState.width + x) * 4;
  EditorState.pixels[i]=r; EditorState.pixels[i+1]=g;
  EditorState.pixels[i+2]=b; EditorState.pixels[i+3]=a;
}
```

### Pointer Capture (ensures pointerup fires even outside canvas)
```javascript
// Source: CLAUDE.md "Pointer events (use capture so pointerup fires outside canvas)"
cursorCanvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  cursorCanvas.setPointerCapture(e.pointerId);
  // ... tool dispatch
});
```

### Keyboard Tool Shortcuts (extend existing keydown handler)
```javascript
// Source: CLAUDE.md "Guard keyboard shortcuts against text inputs"
// Add to existing keydown handler (do NOT replace it)
document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea')) return; // already in handler
  // ... existing zoom/undo/redo shortcuts ...
  // Phase 3 additions:
  if (!e.ctrlKey && !e.metaKey) {
    if (e.key === 'b' || e.key === 'B') setActiveTool('pencil');
    if (e.key === 'e' || e.key === 'E') setActiveTool('eraser');
    if (e.key === 'g' || e.key === 'G') setActiveTool('bucket');
  }
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pixel-by-pixel hue ring rendering | `createConicGradient` | April 2023 (baseline) | 100x faster; no manual HSL loop needed |
| Recursive flood fill | Iterative BFS with Uint8Array visited | Standard since browsers limited recursion | Prevents stack overflow on any image size |
| `EyeDropper` Web API | Custom canvas eyedropper | Design decision (not deprecation) | Custom gives real-time hover preview and alpha transparency handling |
| Mouse events | Pointer Events API | 2015+ | Unified touch/stylus/mouse; `setPointerCapture` for drag-out-of-canvas |
| `execCommand('copy')` | `navigator.clipboard.writeText()` | Baseline 2020 | execCommand deprecated; clipboard API is promise-based and secure |

**Deprecated/outdated:**
- `execCommand('copy')`: deprecated but still works as fallback; prefer `navigator.clipboard.writeText()`
- Recursive flood fill: fundamentally broken for pixel editors; never use

---

## Open Questions

1. **Color Picker Canvas Size**
   - What we know: Panel is 280px wide; picker needs to fit with hex/RGB inputs below
   - What's unclear: Optimal outer ring radius vs inner SL square size in pixels
   - Recommendation: Use 160px canvas, outerR=75, innerR=55; SL square 90×90 centered. Adjust if layout is too cramped. The planner should pick concrete numbers.

2. **Cursor Preview for Multi-Pixel Brush with Outline**
   - What we know: 1px white outline wraps the preview; implemented per CONTEXT.md Section B
   - What's unclear: For round brushes at large sizes, the bounding-box rectangle outline is not round — may look wrong
   - Recommendation: Use simple bounding-box rectangle outline for Phase 3 (fast and simple). Pixel-level perimeter outline can be a Phase 3 enhancement if it looks bad in testing.

3. **Eyedropper Hover Swatch Position**
   - What we know: "Small hover color swatch next to the eyedropper button" in palette panel
   - What's unclear: Exact DOM position (absolute overlay? inline element next to button?)
   - Recommendation: Inline element (16×16px colored div) immediately after the eyedropper button; show/hide on eyedropper activate/deactivate.

4. **Top-Bar Tool Settings Layout**
   - What we know: Context-sensitive — Pencil shows brush size, shape, pixel-perfect; Bucket shows tolerance, contiguous; Eraser shows same as Pencil
   - What's unclear: Whether tool settings should be always-visible divs (hidden/shown) or dynamically rendered
   - Recommendation: Pre-render all tool settings sections as `display:none` divs in the top bar; show only the active tool's section on tool change. Simplest approach, no DOM manipulation.

---

## Sources

### Primary (HIGH confidence)
- CLAUDE.md (project instructions) — tool architecture, EditorState, canvas patterns, brush algorithms, history model
- CONTEXT.md 03-CONTEXT.md — all locked decisions for Phase 3
- MDN createConicGradient — confirmed baseline widely available since April 2023
- MDN createLinearGradient — confirmed parameters and layer approach
- MDN navigator.clipboard — confirmed `writeText()` behavior and security requirements
- MDN arc() — confirmed ring drawing via clockwise/counterclockwise arcs

### Secondary (MEDIUM confidence)
- rickyhan.com pixel-perfect algorithm — L-corner detection logic confirmed by multiple pixel art tool implementations (Aseprite, Pixilart, Pixelorama all use same algorithm)
- WebSearch "pixel perfect pencil algorithm" — confirmed industry standard behavior

### Tertiary (LOW confidence)
- HSL→RGB and RGB→HSL math formulas — stated as "industry standard" by multiple sources; widely used but not formally verified against a single canonical spec in this research session. The code patterns provided are well-known and used in production pixel editors.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pure Canvas 2D API, no library choices to make
- Architecture: HIGH — patterns locked in CLAUDE.md and CONTEXT.md; all confirmed
- Brush algorithms: HIGH — Euclidean pixel circle, Bresenham, BFS flood fill are classical algorithms with known correct implementations
- HSL color picker: HIGH — MDN-verified APIs; color math is well-established
- Pitfalls: HIGH — based on code reading of existing Phase 1-2 implementation and locked CONTEXT.md decisions

**Research date:** 2026-03-03
**Valid until:** 2026-09-03 (stable browser APIs; Canvas 2D changes infrequently)
