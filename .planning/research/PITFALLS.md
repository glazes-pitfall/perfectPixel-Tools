# Pitfalls Research

**Domain:** Browser-based pixel art editor — vanilla JS, Canvas API, Flask backend
**Researched:** 2026-03-02
**Confidence:** HIGH (Canvas API behavior verified against MDN official docs and multiple independent sources; RotSprite pitfalls verified against Aseprite source and JS implementation references)

---

## Critical Pitfalls

### Pitfall 1: Premultiplied Alpha Corrupts Pixel Colors on getImageData Round-Trip

**What goes wrong:**
When a canvas element contains semi-transparent pixels (alpha < 255), browsers internally store pixel data in premultiplied alpha format. When you call `putImageData()` followed by `getImageData()`, the RGB values returned are not guaranteed to match what you put in. The RGB values are quantized based on the alpha value — at low alpha values, only a few distinct RGB values can be recovered. This silently corrupts pixel color data.

**Why it happens:**
The Canvas 2D spec allows browsers to use premultiplied alpha internally for GPU compositing efficiency. The WHATWG issue (html#5365) documents this as a known spec gap. The bug has existed in Firefox since 2007 (Bugzilla #389366) and affects all browsers.

**How to avoid:**
Never use the canvas as the canonical pixel store. Keep the authoritative pixel buffer in `EditorState.pixels` (the `Uint8ClampedArray`). All drawing operations write to `EditorState.pixels` directly. The canvas is a display surface only. Never call `getImageData()` to read pixel data for tool operations — always read from `EditorState.pixels`. Only call `getImageData()` on a fresh `ImageData` constructed from `EditorState.pixels`.

```javascript
// CORRECT: Read from the canonical buffer
function getPixel(x, y) {
  const i = (y * EditorState.width + x) * 4;
  return [EditorState.pixels[i], EditorState.pixels[i+1], EditorState.pixels[i+2], EditorState.pixels[i+3]];
}

// WRONG: Read back from canvas — may get corrupted values
function getPixelFromCanvas(x, y) {
  return pixelCtx.getImageData(x, y, 1, 1).data; // DO NOT DO THIS
}
```

**Warning signs:**
- Colors appear correct on screen but the eyedropper tool returns slightly different RGB values than expected
- Semi-transparent pixels change color after a flood fill touches adjacent areas
- Palette matching stops working correctly for pixels near edges of transparency

**Phase to address:** Phase 1 (Foundation — pixel buffer architecture). The `EditorState.pixels` canonical buffer pattern must be established before any tool is implemented. Retrofitting this later requires touching every tool.

---

### Pitfall 2: Device Pixel Ratio Applied to the Wrong Canvas Layer

**What goes wrong:**
When devicePixelRatio (DPR) > 1 (Retina/HiDPI displays, or when the user zooms in the browser with Ctrl/Cmd +/-), developers either apply DPR to all canvas layers uniformly or apply it inconsistently. Applying DPR to the pixel canvas makes each image pixel occupy DPR physical pixels, which destroys the 1:1 pixel-to-image-coordinate mapping and breaks all tool coordinate math. Not applying DPR to the overlay canvases makes the selection marquee and cursor preview look blurry.

**Why it happens:**
The standard advice for high-DPI canvas ("multiply canvas size by devicePixelRatio and scale ctx by 1/DPR") is correct for drawing canvases but wrong for pixel art where canvas pixels must map 1:1 to image pixels. The STACK.md already documents this correctly but the rule is counterintuitive and easy to get backwards during implementation.

**How to avoid:**
- **pixel-canvas:** Do NOT apply DPR. Canvas `width`/`height` attributes must equal image width/height in pixels. CSS `width`/`height` attributes must also equal image dimensions. Zoom is handled entirely by CSS `transform: scale()` on the container div.
- **cursor-canvas and selection-canvas:** DO apply DPR for crisp overlay rendering. Set canvas `width`/`height` to `imageWidth * DPR` and scale the context by DPR with `ctx.scale(DPR, DPR)`.
- All `viewportToCanvas()` coordinate conversion must account for the zoom level from CSS transform (not from any canvas transform matrix, since the canvas matrix is identity).

```javascript
// pixel-canvas: 1:1 with image, zoom via CSS only
pixelCanvas.width = EditorState.width;
pixelCanvas.height = EditorState.height;
pixelCanvas.style.width = EditorState.width + 'px';
pixelCanvas.style.height = EditorState.height + 'px';

// cursor-canvas: DPR-scaled for crisp overlay
const dpr = window.devicePixelRatio || 1;
cursorCanvas.width = EditorState.width * dpr;
cursorCanvas.height = EditorState.height * dpr;
cursorCanvas.style.width = EditorState.width + 'px';
cursorCanvas.style.height = EditorState.height + 'px';
cursorCtx.scale(dpr, dpr);
```

**Warning signs:**
- Tool clicks land in the wrong position relative to the visible pixel (especially on Mac Retina displays or when browser zoom is not 100%)
- At zoom level 4x, a click appears to paint 4 pixels instead of 1
- The marching ants border is 2px wide on Retina and 1px wide on non-Retina in an inconsistent way

**Phase to address:** Phase 1 (Foundation — canvas setup). Canvas initialization must set these correctly from day one. Changing layer DPR handling after tools are implemented requires auditing every coordinate calculation.

---

### Pitfall 3: RotSprite 8x Buffer Allocates 64x Memory of Original Selection

**What goes wrong:**
RotSprite works by scaling the selection 8x before rotation. A 64×64 pixel selection becomes a 512×512 RGBA buffer = 1MB. A 256×256 selection becomes a 2048×2048 buffer = 16MB. Allocating these synchronously in the main thread causes a multi-second freeze on slower hardware. Creating and discarding multiple large `Uint8ClampedArray` objects in sequence triggers garbage collection pauses immediately after the operation.

**Why it happens:**
The 8x scale is required for quality — applying Scale2x three times correctly. The intermediate buffers (after each Scale2x pass) are not reused; each pass allocates a new array. For a 256×256 input: pass 1 = 4MB, pass 2 = 4MB (released), pass 3 = 16MB (released), rotation = 16MB, downsample output = 256KB. Peak allocation ~36MB for a single 256×256 rotation.

**How to avoid:**
- Enforce a selection size limit for RotSprite: refuse or warn if the bounding box exceeds 128×128 pixels. Pixel art is almost never 256×256 — the typical use case is 16×16 to 64×64 selections.
- Use a single pre-allocated scratch buffer rather than allocating in each Scale2x call when possible (requires passing buffer in as a parameter).
- For the UI, add a spinner or "Applying..." state before calling RotSprite synchronously, so the user knows to expect a delay.
- If a selection exceeds 64×64, use `setTimeout(0)` to yield between Scale2x passes, keeping the browser responsive.

```javascript
// Check before invoking RotSprite
function applyRotation(angleDeg) {
  const sel = EditorState.selection;
  if (sel.w * sel.h > 128 * 128) {
    showStatus('Selection too large for rotation — reduce selection size');
    return;
  }
  showSpinner();
  setTimeout(() => {
    const rotated = rotsprite(selectionPixels, sel.w, sel.h, angleDeg);
    applySelectionPixels(rotated);
    hideSpinner();
  }, 0);
}
```

**Warning signs:**
- Rotation on a large selection freezes the browser tab for 2+ seconds
- DevTools Performance panel shows a single long task spike after clicking Apply on rotation
- Garbage collector pauses appear in the timeline immediately after rotation completes

**Phase to address:** Phase 6 (Transform — RotSprite). Add the size check when first implementing the apply-rotation path.

---

### Pitfall 4: Flood Fill Without a Visited Bitmap Revisits Pixels Exponentially

**What goes wrong:**
A common flood fill bug is pushing the same pixel coordinate onto the stack multiple times from different neighbors, causing O(n^2) or worse performance. For a 256×256 image fully filled with one color, a naive BFS without visited tracking pushes ~262,000 pixels but each pixel's 4 neighbors are checked — meaning the stack grows to ~1 million entries. With a 1024×1024 canvas this causes an out-of-memory error.

**Why it happens:**
Developers check if a coordinate matches the target color before pushing, but two neighbors can both match and both push the same coordinate before it is processed. Without a visited bitmap, the pixel gets processed multiple times and its neighbors get pushed multiple times.

**How to avoid:**
Use a flat `Uint8Array` as the visited bitmap, indexed by `y * width + x`. Mark a pixel as visited *before* processing it, not after. Never push a coordinate to the stack without first marking it visited.

```javascript
function floodFill(startX, startY, fillColor) {
  const target = getPixel(startX, startY);
  if (colorsEqual(target, fillColor)) return;
  const visited = new Uint8Array(EditorState.width * EditorState.height);
  const stack = [startX + startY * EditorState.width];
  visited[startX + startY * EditorState.width] = 1;
  while (stack.length) {
    const idx = stack.pop();
    const x = idx % EditorState.width;
    const y = (idx / EditorState.width) | 0;
    if (!colorMatch(getPixelByIdx(idx), target)) continue;
    setPixelByIdx(idx, fillColor);
    const neighbors = [
      x > 0 ? idx - 1 : -1,
      x < EditorState.width - 1 ? idx + 1 : -1,
      y > 0 ? idx - EditorState.width : -1,
      y < EditorState.height - 1 ? idx + EditorState.width : -1,
    ];
    for (const n of neighbors) {
      if (n >= 0 && !visited[n]) { visited[n] = 1; stack.push(n); }
    }
  }
}
```

**Warning signs:**
- Paint bucket on a large uniform-color area freezes the browser for 1-2 seconds
- DevTools Memory tab shows a spike then drop immediately after flood fill (GC of over-allocated stack)
- Flood fill produces correct result but is slow on simple areas

**Phase to address:** Phase 3 (Core Tools — Paint Bucket). Implement correctly from the start; a bug here is also a Phase 5 issue since magic wand shares the same BFS.

---

### Pitfall 5: Undo Push on Every Pointer Move Creates Thousands of History Entries Per Stroke

**What goes wrong:**
Developers connect `pushHistory()` to the `pointermove` event rather than `pointerdown`. A single pencil stroke of 200 pixels generates 200 undo snapshots instead of 1. With 50 max history entries, the user's entire undo history is consumed by a single stroke, making undo effectively useless. The snapshots also fill memory quickly.

**Why it happens:**
The natural place to "save state before drawing" feels like "every time I draw a pixel," which maps to `pointermove`. The correct mental model is "save state at the beginning of each discrete user action."

**How to avoid:**
Track a `strokeInProgress` boolean. Push history exactly once in `pointerdown`, set `strokeInProgress = true`. On `pointerup`, set `strokeInProgress = false`. Never push in `pointermove`.

```javascript
let strokeInProgress = false;

function onPointerDown(e) {
  if (!strokeInProgress) {
    pushHistory(); // once per stroke, not per pixel
    strokeInProgress = true;
  }
  ToolController.onDown(...);
}

function onPointerUp(e) {
  strokeInProgress = false;
  ToolController.onUp(...);
}
```

**Warning signs:**
- Cmd+Z immediately after a stroke jumps back further than expected (multiple intermediate states)
- Memory usage climbs steadily as the user draws strokes (visible in DevTools Memory tab)
- The undo button is grayed out after just one or two visible operations

**Phase to address:** Phase 2 (History). The stroke-boundary push discipline must be established when history is first implemented. Every tool added later inherits this pattern.

---

## Moderate Pitfalls

### Pitfall 6: Scale2x Color Equality Uses Channel-by-Channel Comparison Without Alpha

**What goes wrong:**
The Scale2x algorithm (used inside RotSprite) compares pixel colors for equality. If the comparison ignores the alpha channel, two pixels that appear visually different (different alpha, same RGB) are treated as equal and the algorithm substitutes the wrong pixel. Transparency at selection edges produces wrong colors after rotation.

**Why it happens:**
The Aseprite C++ implementation uses an indexed color model (palette index equality), which has no separate alpha concern. In the JavaScript RGBA reimplementation, developers compare only `r`, `g`, `b` and forget `a`. A transparent pixel `[255, 0, 0, 0]` (visually invisible) is then treated as equal to an opaque red `[255, 0, 0, 255]`, producing wrong edge behavior.

**How to avoid:**
Compare all four channels in Scale2x equality checks. If the selection uses a transparency mask (alpha = 0 for empty pixels), treat any alpha-0 pixel as "transparent" and never substitute it as a color source.

```javascript
function colorEq(a, b) {
  // If either pixel is fully transparent, only match other fully transparent pixels
  if (a[3] === 0 && b[3] === 0) return true;
  if (a[3] === 0 || b[3] === 0) return false;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}
```

**Warning signs:**
- Rotation of a selection with transparent edges fills the border with wrong colors (leaked from adjacent opaque pixels)
- Rotating a selection by 0 degrees produces a different image than the original (proves Scale2x equality bug)
- Scale2x 2x test image shows "halos" of wrong colors around pixel edges

**Phase to address:** Phase 6 (Transform — RotSprite). Write a manual test: scale a 4×4 test pattern with known transparency by 2x, verify output pixel-by-pixel before integrating RotSprite.

---

### Pitfall 7: CSS Transform Zoom Breaks Pointer Coordinate Conversion When Canvas is Inside a Scrolled Container

**What goes wrong:**
The `viewportToCanvas()` function uses `canvas.getBoundingClientRect()` to convert screen coordinates to canvas coordinates, accounting for zoom. This is correct when the zoom container is centered in a fixed viewport. When the canvas container is inside a scrollable `<div>`, `getBoundingClientRect()` already accounts for scroll offset — but if the scroll and zoom transforms are applied in the wrong order, or the CSS stacking context changes, the coordinate calculation drifts, causing tool clicks to land in the wrong position.

**Why it happens:**
`getBoundingClientRect()` returns coordinates relative to the viewport (accounting for scroll), while `clientX`/`clientY` in pointer events are also viewport-relative. This is correct in isolation, but CSS `transform: scale()` changes the visual position without changing the element's layout position in some browser implementations. The computed rect from `getBoundingClientRect()` is affected by transforms in modern browsers but the behavior differs if there is a `will-change: transform` on an ancestor.

**How to avoid:**
Use `getBoundingClientRect()` on the cursor-canvas (topmost, receives events) and compute the image coordinate directly from there, dividing by the current zoom level. Test coordinate conversion explicitly at multiple zoom levels (1x, 2x, 4x, 8x) and at multiple scroll positions before implementing any tools.

```javascript
function viewportToCanvas(clientX, clientY) {
  const rect = cursorCanvas.getBoundingClientRect();
  // rect already accounts for CSS transform scale (in modern browsers)
  // The "size" of the rect reflects the zoomed canvas
  const scaleX = EditorState.width / rect.width;   // un-zoom factor
  const scaleY = EditorState.height / rect.height;
  const x = Math.floor((clientX - rect.left) * scaleX);
  const y = Math.floor((clientY - rect.top) * scaleY);
  return [
    Math.max(0, Math.min(EditorState.width - 1, x)),
    Math.max(0, Math.min(EditorState.height - 1, y)),
  ];
}
```

**Warning signs:**
- At zoom 1x tool clicks land on the right pixel; at zoom 4x they are off by a constant offset
- Pencil draws pixels 2-3 pixels away from where the cursor visually appears
- The bug appears only on Mac (Retina) but not Windows, or only when the browser window is not maximized

**Phase to address:** Phase 1 (Foundation — coordinate system). Implement `viewportToCanvas()` first and test it with a click-to-read-coordinates debug mode before any drawing tool is wired up.

---

### Pitfall 8: willReadFrequently Not Set on the Pixel Canvas Causes Severe Performance Degradation

**What goes wrong:**
Without `willReadFrequently: true`, the pixel canvas uses GPU-accelerated rendering. Every call to `getImageData()` (for eyedropper, flood fill tolerance check, pixel-perfect check, magic wand) triggers an expensive CPU-GPU memory readback operation. Chrome console shows the warning "Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true." On hardware with a discrete GPU, readbacks can take 5-20ms each, making flood fill and eyedropper feel sluggish.

**Why it happens:**
This flag was added in Chrome 96 / Firefox 107 / Safari 15.4. Projects started before 2022 or copied from older tutorials never set it. It must be set on the *first* call to `getContext('2d')` for that canvas element — setting it later returns the same context instance and the flag is ignored.

**How to avoid:**
Set `willReadFrequently: true` when creating the pixel canvas context. Do NOT set it on the cursor or selection canvases (they are write-only and GPU acceleration is beneficial for smooth animation).

```javascript
// Required — must be set on first getContext call
const pixelCtx = pixelCanvas.getContext('2d', { willReadFrequently: true, alpha: true });

// Do NOT set willReadFrequently on overlay canvases
const selCtx = selCanvas.getContext('2d', { alpha: true });
const cursorCtx = cursorCanvas.getContext('2d', { alpha: true });
```

**Warning signs:**
- Chrome DevTools console shows the willReadFrequently warning
- Eyedropper tool has noticeable lag (100-200ms) on each click
- DevTools Performance trace shows long GPU readback tasks during flood fill

**Phase to address:** Phase 1 (Foundation — canvas initialization). One line that must be correct from day one.

---

### Pitfall 9: sessionStorage Quota Exceeded for Large Images

**What goes wrong:**
sessionStorage has a ~5MB per-origin quota (2.5MB on Safari iOS). A large pixel art image stored as base64 in sessionStorage can exceed this. Base64 encoding inflates binary data by 33%, so a 3.75MB PNG becomes 5MB base64. The `setItem()` call throws a `QuotaExceededError` DOMException with no fallback, silently preventing the editor from opening with no user-visible error message.

**Why it happens:**
sessionStorage was chosen over a Flask round-trip for efficiency. The constraint is easy to overlook because most pixel art is small, but PerfectPixel also accepts regular images (up to 32MB upload limit) that could produce large outputs.

**How to avoid:**
Wrap `sessionStorage.setItem()` in a try-catch. On failure, fall back to passing the image via a Flask redirect (POST to `/api/editor/init`, store server-side in a temporary file, pass a token in the redirect URL). Alternatively, compress the base64 data using a simple run-length encoding before storing (pixel art often has large uniform areas).

```javascript
try {
  sessionStorage.setItem('editorImage', imageB64);
  window.location.href = '/editor';
} catch (e) {
  if (e.name === 'QuotaExceededError') {
    // Fall back: POST to Flask, get a token, redirect with token
    postImageToFlaskAndRedirect(imageB64);
  }
}
```

**Warning signs:**
- "Open in Editor" button appears to do nothing (redirect happens but editor has no image)
- Browser console shows `QuotaExceededError: Failed to execute 'setItem' on 'Storage'`
- Bug appears only on large images (> 2MB PNG output) but not on typical pixel art

**Phase to address:** Phase 7 (Integration — sessionStorage handoff). Implement the quota check and fallback when wiring the "Open in Editor" button.

---

### Pitfall 10: Marching Ants RAF Loop Not Cancelled When Selection is Cleared

**What goes wrong:**
The marching ants animation starts a `requestAnimationFrame` loop when a selection becomes active. If the loop is self-referencing (RAF re-schedules itself inside the callback), and the selection is cleared without cancelling the loop, the animation continues running invisibly — consuming CPU and preventing garbage collection of the closure and canvas reference. On a long editing session, multiple stale animation loops accumulate.

**Why it happens:**
`requestAnimationFrame` callbacks are easy to fire-and-forget. Developers add a guard like `if (!EditorState.selection) { selCtx.clearRect(...); return; }` but call `requestAnimationFrame(animateAnts)` before the return, so the loop keeps scheduling itself regardless.

**How to avoid:**
Store the RAF handle and cancel it explicitly when the selection is cleared.

```javascript
let antsRafId = null;

function startAntsAnimation() {
  if (antsRafId) return; // already running
  function tick() {
    if (!EditorState.selection) { antsRafId = null; return; } // EXIT the loop
    drawAnts();
    antsRafId = requestAnimationFrame(tick);
  }
  antsRafId = requestAnimationFrame(tick);
}

function clearSelection() {
  EditorState.selection = null;
  if (antsRafId) {
    cancelAnimationFrame(antsRafId);
    antsRafId = null;
  }
  selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
}
```

**Warning signs:**
- CPU usage stays elevated (5-15%) even when no selection is active
- DevTools shows continuous animation frame callbacks in the Performance panel during idle
- Multiple successive selections cause CPU usage to increment with each one (multiple loops accumulating)

**Phase to address:** Phase 5 (Selection Tools). Implement the cancel pattern when the marching ants loop is first written.

---

### Pitfall 11: Pixel-Perfect Pencil Removes the Wrong Pixel (Check Applied to Global Buffer Instead of Stroke Buffer)

**What goes wrong:**
The pixel-perfect algorithm removes pixels that form L-shapes. The check is supposed to remove pixels placed during the *current stroke* only. If the check runs against the global pixel buffer (including pre-existing pixels), it will erase pixels that were already present before the stroke began, deleting existing artwork.

**Why it happens:**
The algorithm checks neighboring pixels for "matches to foreground color." Existing artwork can have the same foreground color as the new stroke. The fix requires tracking which pixels belong to the current stroke separately from the background.

**How to avoid:**
Maintain a separate `strokeMask` — a `Uint8Array` of the same dimensions as the canvas, initialized to 0 at `pointerdown`, set to 1 for each pixel placed during the current stroke. The L-shape check consults `strokeMask` to determine whether a neighbor was drawn by the current stroke, not whether it matches the foreground color.

```javascript
let strokeMask = null; // initialized in pointerdown

function drawPixelPerfect(x, y, color) {
  setPixel(x, y, color);
  strokeMask[y * EditorState.width + x] = 1;

  // Check if new pixel forms L with recent stroke pixels
  const dx = x - lastX, dy = y - lastY;
  if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
    // Diagonal move — check if either intermediate pixel is stroke-owned
    const adjacentH = strokeMask[y * EditorState.width + (x - dx)];
    const adjacentV = strokeMask[(y - dy) * EditorState.width + x];
    if (adjacentH && adjacentV) {
      // L-shape: remove the previous pixel in the diagonal direction
      clearPixel(x - dx, y - dy);
    }
  }
}
```

**Warning signs:**
- Pixel-perfect mode erases pixels from a previously drawn line when the pencil passes near it
- Existing artwork disappears when the current stroke color matches adjacent existing pixels
- The bug only manifests when the foreground color matches an existing pixel in the scene

**Phase to address:** Phase 3 (Core Tools — Pencil). Must be implemented correctly from the start. A stroke buffer is also needed for other checks.

---

### Pitfall 12: Transform Handles Hit-Test Fails at High Zoom Because Handle Size Not Adjusted for Zoom

**What goes wrong:**
Selection transform handles are drawn at a fixed size in screen pixels (e.g., 8×8px square). The handle hit-test checks whether a click lands within the handle's canvas-coordinate bounding box. At low zoom, the handle takes up many canvas pixels and is easy to hit. At high zoom (e.g., 16x), each canvas pixel is 16 screen pixels — but the handle is still drawn as an 8-screen-pixel square, meaning it covers only 0.5 canvas pixels. The hit target becomes a fraction of a pixel and is impossible to click accurately.

**Why it happens:**
The handle rendering correctly divides by zoom (e.g., `handleSize / zoom`) to keep the visual size constant. But the hit-test often uses the canvas-coordinate box with the unscaled handle size, creating a mismatch.

**How to avoid:**
Define handle size in *screen pixels* and convert to canvas pixels only for the hit-test using the current zoom level. Keep handle positions in canvas coordinates (corner/edge of selection), convert to screen for rendering, but hit-test in screen coordinates.

```javascript
const HANDLE_SIZE_PX = 8; // always 8 screen pixels regardless of zoom

function hitTestHandles(clientX, clientY) {
  const rect = cursorCanvas.getBoundingClientRect();
  const scaleX = rect.width / EditorState.width;  // screen pixels per canvas pixel
  const scaleY = rect.height / EditorState.height;

  const handles = getHandlePositions(); // returns canvas-coordinate positions
  for (const [hx, hy, type] of handles) {
    // Convert handle canvas position to screen position
    const screenX = rect.left + hx * scaleX;
    const screenY = rect.top + hy * scaleY;
    const half = HANDLE_SIZE_PX / 2;
    if (
      clientX >= screenX - half && clientX <= screenX + half &&
      clientY >= screenY - half && clientY <= screenY + half
    ) {
      return type; // 'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'
    }
  }
  return null;
}
```

**Warning signs:**
- Handles are easy to click at zoom 1-2x but impossible at zoom 8x or higher
- Clicking near a handle at high zoom starts a selection drag instead of a resize
- Handle interaction only works reliably at one specific zoom level

**Phase to address:** Phase 6 (Transform — selection handles). Implement hit-testing in screen coordinates from the start, not as an afterthought.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using `ctx.getImageData()` for pixel reads instead of `EditorState.pixels` | Simpler code — one source of truth appears to be the canvas | Premultiplied alpha corruption on semi-transparent pixels; performance overhead on each read | Never acceptable — always read from canonical buffer |
| Single canvas instead of three-canvas layer stack | Fewer elements, simpler setup | Pixel canvas redraws on every mouse move for cursor preview — causes jank at large zoom | Never acceptable — three-canvas pattern is required |
| Recursive flood fill | Shorter code | Stack overflow on any image larger than ~200×200 with a contiguous region | Never acceptable — iterative BFS is same length |
| `ctx.setTransform(zoom, ...)` for zoom instead of CSS transform | Familiar API | `putImageData`/`getImageData` ignore canvas transform — permanent coordinate mismatch | Never acceptable |
| Polling `EditorState` from UI components on `setInterval` | Avoids pub/sub complexity | Stale renders, excessive CPU, race conditions on tool changes | Never acceptable — use the minimal pub/sub pattern |
| Storing undo snapshots as `toDataURL()` strings | Familiar API | 33% larger than `Uint8ClampedArray.slice()`; slower decode on undo | Only in a throwaway prototype; convert before launch |
| Not clamping x/y in `viewportToCanvas()` | Simpler function | Pixel draws outside canvas bounds corrupt adjacent memory in the `Uint8ClampedArray` | Never acceptable — always clamp to `[0, width-1]` × `[0, height-1]` |
| Pushing history on every `pointermove` | Guarantees every state is recoverable | 200 undo steps per stroke, history full after 1 stroke, unusable undo | Never acceptable — push only on `pointerdown` |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| sessionStorage handoff (web_ui.html → editor.html) | Storing the full raw PNG base64 without checking quota | Wrap in try-catch; for large images fall back to a Flask token-based redirect |
| Flask `/api/apply-palette` reuse from editor | Sending `EditorState.pixels` directly as a `Uint8Array` instead of as base64 PNG | Construct a PNG from `EditorState.pixels` using `canvas.toBlob()` before sending; Flask expects base64 PNG |
| Flask `/api/editor/save` | Using `cv2.resize` with `INTER_LINEAR` for the scaled download | Force `INTER_NEAREST` — pixel art must never be resized with interpolation |
| Palette panel port from web_ui.html | Copying the palette JS with `currentPalette` as a module-level global variable | Wrap palette state in `EditorState.palette`; palette panel reads/writes only through `EditorState` |
| `pointerdown` / `pointerup` on different elements | Registering `pointerup` on the canvas when the user releases outside the canvas | Call `setPointerCapture(e.pointerId)` on `pointerdown`; this keeps events firing regardless of where the pointer travels |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Calling `new ImageData(EditorState.pixels, w, h)` and then `putImageData` inside the RAF loop on every frame | Canvas redraws 60 times/second even when no pixels changed | Only call `flushPixels()` when `EditorState.pixels` has actually changed; use a dirty flag | Immediately — animation loops run at 60fps |
| Creating a new `Uint8ClampedArray` inside each Scale2x pass for RotSprite | Allocates 4MB–16MB of GC pressure per rotation operation | Pre-allocate scratch buffers at editor init for common selection sizes | On any rotation of a selection > 32×32px |
| Flood fill `stack` implemented as `Array` with `push`/`shift` (queue) instead of `push`/`pop` (stack) | Correct result but 10x slower due to O(n) `Array.shift()` | Use `stack.pop()` — order of BFS traversal does not matter for correctness; `pop()` is O(1) | On any fill touching > 1000 pixels |
| Redrawing all 8 transform handles on every pointermove during a drag | Flicker on slow machines; unnecessary draw calls | Only redraw handles when the selection bounds change; handles don't need to redraw during drags that don't resize |  Immediately visible on mid-range hardware |
| Using `canvas.toDataURL('image/png')` for undo snapshots | Saves work but takes 5-50ms per snapshot | Use `Uint8ClampedArray.slice()` — same data, 10-100x faster, no encoding overhead | On the first undo push after a complex operation |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visual feedback while RotSprite is computing (synchronous, blocks UI thread) | UI appears frozen for 1-5 seconds on larger selections; user double-clicks thinking first click didn't register | Show a "Applying rotation..." spinner before the synchronous computation; disable all inputs during computation |
| Keyboard shortcuts active when user types in a numeric input (tolerance, brush size) | User types "15" in tolerance box, fires tool shortcut "1" then "5" | Check `e.target.matches('input, textarea')` before acting on keydown events |
| Undo removes the initial "loaded image" state and leaves an empty canvas | User loses their original pixel art with no way to recover | Push the initial image state into history as index 0 and prevent undo below index 0 |
| Selection snapped to grid produces confusing selection when grid is large (e.g., 32px grid, user tries to select 1 pixel) | User cannot make fine selections on large-grid artwork | Provide a Shift key modifier to bypass grid snapping for precision selection |
| Eyedropper does not update the foreground color in real-time while hovering (only updates on click) | User cannot preview which color will be picked before clicking | Show the hovered pixel color in the color picker display as a hover preview, update on click to commit |
| Canvas Size tool guide lines not visible against bright areas of the image | User cannot see the boundary preview for light-colored images | Use a contrasting guide line (alternating black/white, or a colored highlight, not a single color) |

---

## "Looks Done But Isn't" Checklist

- [ ] **Undo/Redo:** Does undo restore the selection state (active selection bounds), not just the pixel data? A stroke made inside a selection should undo to the state with that selection still active.
- [ ] **Flood Fill with Tolerance:** Does tolerance 0 fill only exact color matches? Does tolerance 255 fill the entire image regardless of color? Test both extremes.
- [ ] **RotSprite 0-degree Rotation:** Rotating by 0 degrees should return the identical pixel data. If Scale2x + downsample at 0° changes any pixel, the implementation has a correctness bug.
- [ ] **Magic Wand Non-Contiguous Mode:** With `contiguous: false`, does the wand select ALL pixels in the image that match the tolerance, including isolated pixels far from the click point? Run BFS over the entire image, not just from the start point.
- [ ] **Pencil Over Selection Boundary:** When a selection is active and the user draws with the pencil, does the pencil correctly clip to the selection bounds? Does it draw outside the selection when it should not?
- [ ] **Canvas Resize Undo:** After canvas resize (expand left by 10px), does undo restore the original canvas dimensions AND the pixel data? Undo must restore `EditorState.width`/`height` as well as `EditorState.pixels`.
- [ ] **Download Produces Exact Pixel Data:** Does `canvas.toBlob('image/png')` produce a PNG where `getImageData()` on a freshly-loaded version returns the same RGBA values? (Test with a pixel that has alpha < 255 — premultiplied alpha round-trip must not corrupt it.)
- [ ] **Palette Sync on Load:** When editor opens, does `EditorState.palette` correctly reflect the palette that was active in Ver 1.1 at the time "Open in Editor" was clicked? Test with a non-default saved palette.
- [ ] **Browser Zoom Compatibility:** Do all tools work correctly when the *browser* is zoomed to 90% or 110% (not editor zoom — browser-level zoom changes devicePixelRatio)? Test by setting browser zoom to 150%.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Premultiplied alpha corruption discovered late (after tools built) | HIGH | Audit every tool that reads pixels: replace all `getImageData()` calls with reads from `EditorState.pixels`; regression test all tools |
| DPR applied to wrong canvas layer discovered after tools built | HIGH | Fix canvas init, then audit every `viewportToCanvas()` call and every place canvas size is referenced; full coordinate system regression test |
| RotSprite Scale2x color equality bug | MEDIUM | Fix the `colorEq()` function; re-run rotation tests on known test patterns; transparent-edge test cases catch this quickly |
| Flood fill revisiting pixels (performance bug, not correctness) | LOW | Swap the `Array` used as stack to use `push`/`pop`; add the `visited` bitmap; existing test images show the improvement immediately |
| History push on every pointermove | MEDIUM | Move `pushHistory()` to `pointerdown`; test undo count after a long stroke (should be 1 undo step regardless of stroke length) |
| Marching ants RAF loop leak | LOW | Add the `antsRafId` guard; verify with DevTools Performance that animation frames stop when selection is cleared |
| sessionStorage quota exceeded | MEDIUM | Add try-catch and implement Flask fallback for large images; test with a 3MB+ output image from Ver 1.1 |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Premultiplied alpha (Pitfall 1) | Phase 1: Foundation | Write a test that sets a pixel with alpha=128, flushes to canvas, and reads back from `EditorState.pixels` — must match exactly |
| DPR applied to wrong canvas (Pitfall 2) | Phase 1: Foundation | Click a known pixel at zoom 1x, 4x, 8x — all must paint the correct pixel |
| RotSprite memory / performance (Pitfall 3) | Phase 6: Transform | Rotate a 64×64 selection — must complete without visible freeze; rotate a 256×256 selection — must show spinner |
| Flood fill revisit bug (Pitfall 4) | Phase 3: Core Tools | Flood-fill a 256×256 solid area — must complete in < 100ms; memory must not spike |
| Undo push on pointermove (Pitfall 5) | Phase 2: History | Draw a 100-pixel stroke — undo once should revert the entire stroke, not one pixel |
| Scale2x alpha equality (Pitfall 6) | Phase 6: Transform | Rotate a selection with transparent edges by any angle — no color contamination at edges |
| Coordinate conversion with scroll (Pitfall 7) | Phase 1: Foundation | Click-to-log-coordinate test at multiple zoom levels and scroll positions |
| willReadFrequently missing (Pitfall 8) | Phase 1: Foundation | Open DevTools console — zero willReadFrequently warnings after any tool operation |
| sessionStorage quota (Pitfall 9) | Phase 7: Integration | Test handoff with a 3MB+ PNG output; must open editor successfully |
| Marching ants RAF leak (Pitfall 10) | Phase 5: Selection Tools | Create and clear 10 selections; DevTools Performance shows no residual animation frames |
| Pixel-perfect wrong pixel erased (Pitfall 11) | Phase 3: Core Tools | Draw over an existing line of the same color in pixel-perfect mode — existing pixels must not be erased |
| Handle hit-test at high zoom (Pitfall 12) | Phase 6: Transform | At zoom 16x, click a transform handle — must activate resize, not start a new selection |

---

## Sources

- MDN Web Docs: Canvas API Pixel Manipulation — https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas (HIGH confidence)
- WHATWG HTML Issue #5365: ImageData alpha premultiplication — known spec gap (HIGH confidence — official issue tracker)
- Mozilla Bugzilla #389366: Canvas getImageData returning premultiplied alpha values — reported 2007, affects all browsers (HIGH confidence)
- MDN Web Docs: Window.devicePixelRatio — https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio (HIGH confidence)
- web.dev: High DPI Canvas — https://web.dev/articles/canvas-hidipi (MEDIUM confidence — Google web.dev, slightly dated but core DPR concepts stable)
- Kevin Schiener: "Slow HTML Canvas Performance? Understanding Chrome's `willReadFrequently` Attribute" (2024) — https://www.schiener.io/2024-08-02/canvas-willreadfrequently (MEDIUM confidence — verified against MDN spec)
- Ben's Blog: "An HTML5 canvas Flood Fill that doesn't kill the browser" — https://ben.akrin.com/an-html5-canvas-flood-fill-that-doesnt-kill-the-browser/ (MEDIUM confidence — flood fill performance patterns verified against iterative BFS theory)
- Codeheir: "Comparing Flood Fill Algorithms in JavaScript" (2022) — https://codeheir.com/blog/2022/08/21/comparing-flood-fill-algorithms-in-javascript/ (MEDIUM confidence)
- Aseprite source: `src/doc/algorithm/rotsprite.cpp` (HIGH confidence for algorithm correctness; MEDIUM confidence for JS translation pitfalls)
- MDN Web Docs: cancelAnimationFrame — https://developer.mozilla.org/en-US/docs/Web/API/Window/cancelAnimationFrame (HIGH confidence)
- MDN Web Docs: Storage quotas and eviction criteria — https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria (HIGH confidence)
- Rickyhan.com: "Pixel Art Algorithm: Pixel Perfect" — https://rickyhan.com/jekyll/update/2018/11/22/pixel-art-algorithm-pixel-perfect.html (MEDIUM confidence — algorithm description corroborated by STACK.md research)
- Direct analysis of `.planning/research/STACK.md` and `.planning/research/ARCHITECTURE.md` (HIGH confidence — previously researched)

---

*Pitfalls research for: Browser-based pixel art editor in vanilla JS/Canvas API*
*Researched: 2026-03-02*
