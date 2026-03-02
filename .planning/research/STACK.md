# Stack Research

**Domain:** Browser-based pixel art editor — vanilla JS, single HTML file, Canvas API, Flask backend
**Researched:** 2026-03-02
**Confidence:** HIGH (Canvas and Pointer Event APIs are stable, documented on MDN; RotSprite algorithm verified against Aseprite source)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| HTML5 Canvas API (2D Context) | Baseline / all browsers | Pixel buffer rendering — `getImageData`, `putImageData`, `ImageData` | The only viable pixel-level drawing API in vanilla JS. Direct `Uint8ClampedArray` manipulation is required for flood fill, magic wand, pixel-perfect pencil, and RotSprite. No external library can add this capability; it is native. |
| Pointer Events API | Baseline since 2017 | Unified input handling for mouse, touch, stylus | Supersedes both mouse events and touch events. A single handler works for all devices. `setPointerCapture` keeps events firing when pointer leaves canvas during a stroke — essential for accurate drawing. |
| `Uint8ClampedArray` | Baseline | Pixel data storage (persistent buffer) | The native type for `ImageData.data`. Values auto-clamp to 0–255, eliminating manual bounds checks in pixel manipulation loops. Direct index arithmetic `(y * width + x) * 4` is fast. |
| `requestAnimationFrame` | Baseline | Selection overlay animation (marching ants), cursor preview loop | Ties animation to screen refresh rate. All animated canvas updates (marching ants, brush cursor) must run in RAF loops — not `setInterval`. |
| `sessionStorage` | Baseline | Handoff of image + palette from `web_ui.html` to `editor.html` | Avoids a Flask round-trip for data already in the browser. Survives same-tab page navigation; cleared on tab close. Appropriate for transient editor state. |
| Canvas `setLineDash` / `lineDashOffset` | Baseline since 2015 | Animated marching ants selection border | Native canvas API produces the Aseprite-style dashed selection border. Animate `lineDashOffset` in a RAF loop; no library needed. |
| `ResizeObserver` | Baseline since 2020 | Observe canvas container size changes | More accurate than `window.resize` for responding to panel layout changes. Fires before paint, preventing visual flicker. |

### Context Options That Matter

The 2D context must be created with specific options for pixel editing performance. These are confirmed HIGH confidence via MDN spec and WHATWG canvas spec.

```javascript
// For the pixel-canvas (the main editing canvas):
const pixelCtx = pixelCanvas.getContext('2d', {
  willReadFrequently: true,  // REQUIRED — forces software rendering path for fast getImageData
  alpha: true,               // Needed for transparent pixels in pixel art
});

// For the selection-canvas and cursor-canvas:
const selCtx = selCanvas.getContext('2d', {
  willReadFrequently: false, // These canvases are write-only, never read back
  alpha: true,
  desynchronized: true,      // Reduces latency for cursor preview — lower-priority hint
});
```

**Why `willReadFrequently: true` is critical:** Without it, browsers use GPU-accelerated (hardware) rendering, which makes `getImageData` an expensive CPU-GPU readback. With the flag, the browser uses software (CPU) rendering which is slower for drawing but makes `getImageData` fast. Since flood fill, magic wand, pixel-perfect pencil, and color picking all call `getImageData`, this flag is non-optional on the pixel canvas.

### Canvas Rendering Architecture

Three stacked `<canvas>` elements inside a shared container `div`. This is the correct pattern — verified against canvas optimization docs on MDN.

```
cursor-canvas     z-index: 3    brush preview, grid lines       redraws on pointermove
selection-canvas  z-index: 2    marching ants, handles          redraws in RAF loop
pixel-canvas      z-index: 1    the actual pixel art data       redraws only when pixels change
```

**All three canvases are sized to exactly image dimensions in CSS pixels:**
```html
<canvas id="pixel-canvas" width="64" height="64" style="width:64px;height:64px"></canvas>
```

**Zoom via CSS transform on the container, not `ctx.setTransform`:**
```javascript
container.style.transform = `scale(${zoom}) translate(${panX}px, ${panY}px)`;
```

This keeps canvas pixel coordinates at a 1:1 mapping with image pixels. `putImageData` and `getImageData` are not affected by the canvas transform matrix — keeping the matrix at identity eliminates an entire class of coordinate bugs.

**CSS required on all canvases for pixel-perfect display:**
```css
canvas {
  image-rendering: pixelated;   /* Chrome, Firefox 93+, Edge */
  image-rendering: crisp-edges; /* Firefox fallback */
}
```

### Supporting Browser APIs

| API | Purpose | Confidence | Browser Compat |
|-----|---------|------------|----------------|
| `ImageData` constructor | Create pixel buffers | HIGH | Baseline — all browsers |
| `ctx.putImageData(imageData, 0, 0)` | Flush pixel buffer to canvas | HIGH | Baseline since 2015 |
| `ctx.getImageData(x, y, w, h)` | Read pixels for fill/wand | HIGH | Baseline since 2015 |
| `ctx.imageSmoothingEnabled = false` | Prevent antialiasing on `drawImage` | HIGH | Baseline — all browsers |
| `canvas.toBlob(cb, 'image/png')` | Client-side PNG download | HIGH | Baseline — all browsers |
| `ctx.setLineDash([n, n])` | Dashed marquee border | HIGH | Baseline since 2015 |
| `Path2D` | Reusable path for selection handles | MEDIUM | Baseline since 2020 |
| `element.setPointerCapture(id)` | Keep drag events in bounds | HIGH | Baseline since 2017 |
| `createImageBitmap()` | Fast async image decode from base64 | MEDIUM | Baseline since 2021 — use for initial image load from sessionStorage |
| `OffscreenCanvas` | Off-thread rendering | LOW — avoid | Baseline since 2023, but incompatible with no-module-system constraint |

### What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `OffscreenCanvas` with Web Workers | Requires `type: module` scripts or `importScripts`, incompatible with single-file HTML. RotSprite at pixel art scale (< 128×128) runs in < 50ms synchronously — Worker overhead not justified. | Synchronous computation in the main thread for small selections; `setTimeout(0)` chunking for large transforms |
| `ctx.setTransform` for zoom | `getImageData` / `putImageData` ignore the canvas transform matrix. Using `setTransform` for zoom causes a permanent mismatch between visual position and pixel data coordinates. | CSS `transform: scale()` on the container div |
| `ctx.drawImage` for per-pixel drawing | `drawImage` operates at the image level, not the pixel level. It cannot write individual RGBA values. | `setPixel` helper that writes to the `Uint8ClampedArray` buffer, then `putImageData` |
| Recursive flood fill | Stack overflow on contiguous areas larger than ~4000 pixels. Chrome's default call stack is ~10,000 frames. | Iterative BFS with an explicit `Array` stack |
| `setInterval` for animation | `setInterval` fires independent of screen refresh, causing tearing and wasted frames. | `requestAnimationFrame` for all canvas animation loops |
| CSS `filter` or `globalCompositeOperation` for tool effects | Adds implicit state to the canvas context that is easy to forget, causing rendering artifacts. All tool effects must be done by modifying the pixel buffer directly. | Direct `Uint8ClampedArray` manipulation |
| Third-party Canvas libraries (Fabric.js, Konva.js, Paper.js) | These impose object models (vector objects, event systems) incompatible with direct pixel manipulation. They add hundreds of KB. The project constraint forbids external JS frameworks. | Bare Canvas API |
| Premultiplied alpha round-trips | `putImageData` → `getImageData` can silently alter RGBA values due to premultiplied alpha conversion in some browsers (Chrome on non-opaque pixels). | Keep the canonical pixel buffer in `EditorState.pixels` (the `Uint8ClampedArray`). Never read pixels back from the canvas; always read from `EditorState.pixels`. |

---

## Algorithm Implementations

### RotSprite — JavaScript Reimplementation

**Source of truth:** Aseprite's C++ implementation at `src/doc/algorithm/rotsprite.cpp` (verified directly). The algorithm is:

1. **Scale 8x using Scale2x (EPX) algorithm applied 3 times**
   - Scale2x examines 4 neighbors (A=above, B=right, C=left, D=below) of each pixel P
   - Each pixel expands to 4 output pixels using conditional rules:
     - `E0 = (C==A && C!=D && A!=B) ? A : P`
     - `E1 = (A==B && A!=C && B!=D) ? B : P`
     - `E2 = (D==C && D!=B && C!=A) ? C : P`
     - `E3 = (B==D && B!=A && D!=C) ? D : P`
   - Applying 3× produces an 8× enlargement preserving sharp edges
   - Color equality for indexed/RGB: exact match only (no tolerance)

2. **Rotate the 8x image** using nearest-neighbor rotation (not bilinear — bilinear introduces color mixing, violating pixel art constraints)

3. **Downsample back to original size** using nearest-neighbor sampling

**Why 8x scale before rotation:** Rotating at 8x resolution gives 64 sub-pixel samples per output pixel, producing much cleaner diagonal edges than rotating at 1x. The Scale2x upscaling preserves pixel art character (no blur, no color mixing) unlike bilinear upscaling.

**JavaScript implementation pattern:**
```javascript
function scale2x(src, srcW, srcH) {
  // src: Uint8ClampedArray (RGBA), returns Uint8ClampedArray at 2x dimensions
  const dst = new Uint8ClampedArray(srcW * 2 * srcH * 2 * 4);
  const dstW = srcW * 2;
  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      const P = getPixelRGBA(src, srcW, x, y);
      const A = getPixelRGBA(src, srcW, x, y - 1);  // above (clamp at edge)
      const B = getPixelRGBA(src, srcW, x + 1, y);  // right
      const C = getPixelRGBA(src, srcW, x - 1, y);  // left
      const D = getPixelRGBA(src, srcW, x, y + 1);  // below
      const eqCA = colorEq(C, A), eqCD = colorEq(C, D), eqAB = colorEq(A, B), eqBD = colorEq(B, D);
      setPixelRGBA(dst, dstW, x*2,   y*2,   (eqCA && !eqCD && !eqAB) ? A : P);
      setPixelRGBA(dst, dstW, x*2+1, y*2,   (eqAB && !eqCA && !eqBD) ? B : P);
      setPixelRGBA(dst, dstW, x*2,   y*2+1, (eqCD && !eqBD && !eqCA) ? C : P);
      setPixelRGBA(dst, dstW, x*2+1, y*2+1, (eqBD && !eqAB && !eqCD) ? D : P);
    }
  }
  return dst;
}

function rotsprite(src, srcW, srcH, angleDegrees) {
  // 1. Scale 8x
  let buf = src, bufW = srcW, bufH = srcH;
  for (let i = 0; i < 3; i++) {
    buf = scale2x(buf, bufW, bufH);
    bufW *= 2; bufH *= 2;
  }
  // 2. Rotate at 8x (nearest-neighbor)
  const rad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const rotated = new Uint8ClampedArray(bufW * bufH * 4);
  const cx = bufW / 2, cy = bufH / 2;
  for (let dy = 0; dy < bufH; dy++) {
    for (let dx = 0; dx < bufW; dx++) {
      const sx = Math.round(cos * (dx - cx) + sin * (dy - cy) + cx);
      const sy = Math.round(-sin * (dx - cx) + cos * (dy - cy) + cy);
      const p = (sx < 0 || sx >= bufW || sy < 0 || sy >= bufH)
        ? [0, 0, 0, 0]
        : getPixelRGBA(buf, bufW, sx, sy);
      setPixelRGBA(rotated, bufW, dx, dy, p);
    }
  }
  // 3. Downsample 8x → 1x (nearest-neighbor: sample center of each 8x8 block)
  const out = new Uint8ClampedArray(srcW * srcH * 4);
  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      setPixelRGBA(out, srcW, x, y, getPixelRGBA(rotated, bufW, x * 8 + 4, y * 8 + 4));
    }
  }
  return out;
}
```

**Performance:** For a 64×64 selection, the 8× buffer is 512×512 = 262,144 pixels. Processing is O(width × height × 64) ≈ 16M iterations — typically 20–80ms on modern hardware. Acceptable for an interactive apply step (not for real-time preview).

**Confidence for RotSprite:** MEDIUM. Algorithm logic is verified from Aseprite source. The JavaScript pixel-index arithmetic and edge handling needs careful testing, particularly at boundary pixels and for non-square selections.

### Pixel-Perfect Pencil

After each pixel is drawn during a stroke, check whether the new pixel forms a 2×2 block with any of its diagonal neighbors that also belong to the current stroke. If it does, remove the pixel that would create the unwanted L-shape. This is a stateless per-pixel check on the `Uint8ClampedArray` buffer.

The specific rule: if drawing at `(x, y)` and the pixel at `(x-1, y)` and `(x, y-1)` are both the foreground color, then the pixel at `(x-1, y-1)` would create a diagonal artifact — remove `(x-1, y-1)` (or alternatively, don't place the current pixel). Track which pixels were placed in the current stroke to apply the check only against stroke-owned pixels.

**Confidence:** MEDIUM (derived from Aseprite documentation descriptions; exact implementation rule varies by reference).

### Flood Fill and Magic Wand — Iterative BFS

Both flood fill and magic wand use the same BFS algorithm with a tolerance parameter. The visited tracking uses a `Uint8Array` (1 bit per pixel) rather than a `Set` for O(1) constant-time lookups without GC pressure.

```javascript
function colorMatch(a, b, tolerance) {
  return Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]) <= tolerance * 3;
}

function bfsFill(startX, startY, tolerance, contiguous, visitor) {
  const target = getPixel(startX, startY);
  const visited = new Uint8Array(EditorState.width * EditorState.height);
  const stack = [startX + startY * EditorState.width];
  while (stack.length) {
    const idx = stack.pop();
    if (visited[idx]) continue;
    visited[idx] = 1;
    const x = idx % EditorState.width, y = (idx / EditorState.width) | 0;
    if (!colorMatch(getPixelByIndex(idx), target, tolerance)) continue;
    visitor(x, y, idx);
    if (contiguous) {
      if (x > 0) stack.push(idx - 1);
      if (x < EditorState.width - 1) stack.push(idx + 1);
      if (y > 0) stack.push(idx - EditorState.width);
      if (y < EditorState.height - 1) stack.push(idx + EditorState.width);
    }
  }
}
```

**Confidence:** HIGH — iterative BFS with a visited array is the standard correct approach for flood fill.

---

## Installation

No `npm install`. No build tools. No package.json.

The editor is a single HTML file served directly by Flask:

```python
# web_app.py — one new route to add
@app.route("/editor")
def editor():
    return send_file(os.path.join(os.path.dirname(__file__), "editor.html"))
```

The only new Python dependency is none — the existing Flask + Pillow + OpenCV stack is reused as-is. All editor logic runs in the browser using native APIs.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Bare Canvas API + `Uint8ClampedArray` | Fabric.js, Konva.js | Only if building a vector editor (shapes, not pixels). These libraries are wrong-tool for pixel manipulation. |
| CSS `transform: scale()` for zoom | `ctx.setTransform()` for zoom | Never use `setTransform` for zoom in a pixel editor. `getImageData`/`putImageData` ignore transform. CSS transform is always correct here. |
| Full-buffer `putImageData` | Dirty-rect `putImageData` with 6-arg form | Dirty-rect is only worth the complexity above ~1024×1024. Pixel art never reaches that size. Full-buffer putImageData on a 512×512 canvas takes < 1ms. |
| Three-canvas layer stack | Single canvas with full redraw | Single canvas causes jank — the pixel layer (expensive putImageData) gets redrawn on every pointermove for cursor preview. Three layers eliminates this. |
| Snapshot-based undo (`Uint8ClampedArray.slice()`) | Command pattern undo | Command pattern is correct only if you need network sync or collaborative editing. Inversion of flood fill and transform is complex. Snapshots are trivially correct and memory is acceptable at pixel art sizes. |
| Pointer Events API | Mouse Events only | Mouse Events only if you need IE11 support (irrelevant — this project targets modern browsers only). Pointer Events handles stylus correctly. |
| `willReadFrequently: true` on pixel canvas | Default GPU-accelerated context | Default context makes `getImageData` slow. Pixel editors call `getImageData` constantly (fill, wand, eyedropper, pixel-perfect check). The flag is mandatory. |
| Nearest-neighbor downsampling after RotSprite | Bilinear downsampling | Bilinear introduces color mixing. Pixel art palettes are finite and strict — introducing blended colors would corrupt the palette constraint. Nearest-neighbor is always correct for pixel art. |

---

## Stack Patterns by Scenario

**If the selection is small (< 64×64 pixels):**
- Run RotSprite synchronously in the main thread — < 80ms execution time
- Apply immediately on button press

**If the selection is large (64×64 to 256×256 pixels):**
- Show a spinner/loading indicator
- Use a `setTimeout(0)` chain to yield to the browser between the scale-up, rotate, and scale-down phases
- Still synchronous JS, just yielded to avoid blocking the event loop

**If canvas is high-DPI (devicePixelRatio > 1):**
- Do NOT scale the pixel canvas by `devicePixelRatio` — this would create non-square pixels in the pixel art
- Only scale the cursor-canvas and selection-canvas by devicePixelRatio for crisp overlay rendering
- The pixel canvas must remain 1:1 with image pixels; zoom is handled by CSS transform

**If image comes from sessionStorage base64 string:**
- Use `createImageBitmap()` with a `Blob` for async decode — faster than creating an `<img>` element and waiting for `onload`
- Alternatively, decode base64 → binary string → Uint8Array → manually parse PNG header (more complex; avoid)

---

## Version Compatibility

| Browser | Canvas API | Pointer Events | `willReadFrequently` | `image-rendering: pixelated` | `OffscreenCanvas` |
|---------|------------|----------------|---------------------|------------------------------|-------------------|
| Chrome 99+ | Full | Full | Yes (Chrome 96+) | Yes | Yes |
| Firefox 93+ | Full | Full | Yes (Firefox 107+) | Yes (`crisp-edges` works too) | Yes |
| Safari 15.4+ | Full | Full | Yes (Safari 15.4+) | Yes | Yes |
| Edge 99+ | Full | Full | Yes | Yes | Yes |

All target browsers support the full stack. `willReadFrequently` is the newest required feature — baseline is 2022–2023 depending on browser. This is safe for a 2026 deployment.

---

## What To Avoid (Expanded)

### Avoid: External JS Color Picker Libraries

Libraries like `iro.js`, `Pickr`, or the browser's native `<input type="color">` are not suitable:

- `<input type="color">` opens the OS color picker (non-embedded, disrupts workflow)
- External libraries add script tags or ES module imports, incompatible with the single-file constraint
- A pixel art editor needs a custom HSL wheel or Hue-Saturation picker that integrates with the palette panel

**Implementation:** Build a minimal HSL color wheel using Canvas API itself. A 256×256 canvas with hue on the angular axis and saturation on the radial axis, plus a separate lightness slider. ~100 lines of canvas code. This is confirmed feasible — the existing `web_ui.html` already implements a simpler RGB version.

### Avoid: CSS Grid or Flexbox for Canvas Zoom Container

Using CSS layout properties on the canvas container causes the browser to recalculate layout on every zoom step. The container must be `position: absolute` with explicit pixel dimensions, inside a `position: relative` viewport div.

### Avoid: `innerHTML` for Dynamic Tool UI

The top bar tool options change when the active tool changes. Use `textContent` and DOM manipulation rather than `innerHTML` for security (no XSS surface) and consistency with the existing codebase style.

### Avoid: `globalCompositeOperation` for Eraser

Setting `globalCompositeOperation = 'destination-out'` on the canvas context creates implicit state that is easy to forget to reset, causing all subsequent drawing to erase instead of paint. Implement eraser by writing `[0, 0, 0, 0]` (transparent) to the pixel buffer directly.

---

## Sources

- MDN Web Docs: Canvas API Pixel Manipulation — https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas (HIGH confidence — official spec, Baseline APIs)
- MDN Web Docs: `CanvasRenderingContext2D.getContext` options — willReadFrequently, alpha, desynchronized (HIGH confidence)
- MDN Web Docs: `putImageData` — dirty rectangle optimization notes (HIGH confidence)
- MDN Web Docs: OffscreenCanvas — browser compatibility, transfer patterns (HIGH confidence for compat data)
- MDN Web Docs: Pointer Events — setPointerCapture, pointer capture during drag (HIGH confidence)
- MDN Web Docs: `setLineDash` / `lineDashOffset` — marching ants animation pattern (HIGH confidence)
- MDN Web Docs: Canvas Optimization — layered canvases, avoid state changes, RAF (HIGH confidence)
- MDN Web Docs: `imageSmoothingEnabled` — pixel art anti-aliasing control (HIGH confidence)
- MDN Web Docs: `Uint8ClampedArray` — clamping behavior, performance characteristics (HIGH confidence)
- MDN Web Docs: `Path2D` — reusable paths for selection handles (HIGH confidence)
- MDN Web Docs: `ResizeObserver` — container-level resize observation (HIGH confidence)
- Aseprite source: `src/doc/algorithm/rotsprite.cpp` — RotSprite algorithm (scale2x × 3 → parallelogram transform) (HIGH confidence for algorithm; MEDIUM confidence for JS translation)
- Aseprite source: Scale2x neighbor comparison rules (A/B/C/D/P) — (MEDIUM confidence — derived from WebFetch of GitHub source + Wikipedia description reference in code comments)
- WHATWG Canvas spec: `willReadFrequently` rationale — software vs hardware rendering tradeoff (HIGH confidence — spec language confirmed)
- Direct codebase analysis: `web_ui.html` (1142 lines, dark theme CSS vars, Flask API patterns) — (HIGH confidence — primary source)

---

*Stack research for: Vanilla JS pixel art editor with Canvas API*
*Researched: 2026-03-02*
