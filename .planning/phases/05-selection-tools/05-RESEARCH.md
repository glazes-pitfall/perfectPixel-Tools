# Phase 5: Selection Tools - Research

**Researched:** 2026-03-03
**Domain:** Browser Canvas 2D — pixel-level selection masks, marching-ants animation, grid-snapped rectangle marquee, magic-wand flood-fill
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Magic Wand 选区形状**
- 产生像素级不规则选区，**不是**边界矩形近似
- 蚂蚁线贴合每个匹配像素的外边缘逐像素绘制（所有外边都有蚂蚁线，包括内凹轮廓）
- Phase 6 Move 将基于像素掩码精准移动非矩形像素集合

**Rectangle Marquee 网格吸附**
- 拖动起点和终点均吸附到最近的网格单元角点
- 选区的宽高必须是 gridW / gridH 的整数倍
- gridW/gridH = 0（未检测到网格）时退化为 1px 单位吸附（普通像素级）

**工具裁剪范围**
- 选区激活时，**Pencil + Eraser + Paint Bucket 三个工具全部受选区约束**
- 绘图/填充操作不能溢出选区边界之外

**Shift 累加选区**
- Shift + 拖拽 Marquee → 把新矩形并入已有选区（union 合并）
- Shift + 点击 Wand → 把新匹配像素并入已有选区（union 合并）
- 不带 Shift → 替换整个选区

**蚂蚁线动画**
- 样式：Aseprite 风格，1px 宽反色虚线（白/黑交替），持续动画滚动
- 形状：贴合实际像素掩码的外轮廓，Wand 选出不规则区域时蚂蚁线也不规则
- 使用现有 selection-canvas（z-index 2），RAF 循环驱动，取消选区时必须 cancelAnimationFrame

**选区持久性**
- **切换工具不取消选区**——选区在工具切换后保持激活
- 选区仅被以下操作取消：Cmd+D、新建选区（无 Shift）、加载新图片

**顶栏按钮（有选区时显示）**
- 选区激活时顶栏显示：**Deselect（Cmd+D）** 和 **Inverse（Shift+Cmd+I）** 按钮
- 无选区时这两个按钮隐藏（不是 disabled，是 display:none）

**选区操作快捷键**
- **Cmd+D** → 取消选区（Deselect）
- **Shift+Cmd+I** → 反选（Inverse）
- **Option+Delete** → 前景色填充选区内所有像素（push history）
- **Delete** → 透明像素填充选区内所有像素（清除选区内容，push history）

**反选语义**
- Inverse = 全画布像素掩码取反
- 所有当前未选中的像素变为选中，当前选中的像素变为未选中
- 结果包含完整的不规则掩码（非矩形），适用于 Wand 选区的反选

### Claude's Discretion
- 选区内部数据结构：统一使用 `Uint8Array` 像素掩码（一字节/像素，1=选中），同时用 `{x,y,w,h}` 记录边界框供快速范围检查
- 蚂蚁线虚线具体线段长度和动画帧率
- 网格吸附的具体像素对齐算法（四舍五入到最近整数倍）
- 选区工具的 cursor 样式（crosshair vs 自定义）

### Deferred Ideas (OUT OF SCOPE)
- 无——讨论全程在 Phase 5 范围内
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEL-01 | Rectangle Marquee Tool（快捷键 M）：选区对齐到检测到的像素网格 | Grid-snap algorithm: snap(v, grid) = Math.round(v / grid) * grid; gridW/gridH=0 → grid=1 |
| SEL-02 | Rectangle Marquee Tool（快捷键 M）：拖动时实时显示 1px 宽反色虚线选区边界（Aseprite 风格） | Marching-ants via RAF on selection-canvas; border-edge traversal algorithm documented below |
| SEL-03 | Magic Wand Tool（快捷键 W）：支持 Tolerance 容差参数 | Re-uses existing wandTolerance in EditorState.toolOptions; BFS flood-fill adapted from floodFill() |
| SEL-04 | Magic Wand Tool（快捷键 W）：支持 Contiguous 勾选框 | Re-uses existing contiguous flag; non-contiguous Wand scans all pixels matching tolerance |
| SEL-05 | 选区激活时，顶栏显示 Deselect（Cmd+D）和 Inverse（Shift+Cmd+I） | HTML buttons with display:none/block toggled by updateSelectionUI(); keyboard events added to existing keydown handler |
</phase_requirements>

---

## Summary

Phase 5 is a pure browser-JS, zero-dependency implementation problem. All infrastructure (three-canvas stack, EditorState, tool dispatch, BFS flood fill, history) is already in place from Phases 1-3. The work is:

1. **Selection data model**: Extend `EditorState` so `selection` carries a `Uint8Array` mask alongside the `{x,y,w,h}` bounding box. Every tool that writes pixels checks the mask.
2. **Marquee tool**: Track pointerdown/move/up to compute a grid-snapped rectangle; update a preview rect on selection-canvas during drag; on pointerup commit the mask.
3. **Magic Wand tool**: Adapt the existing `floodFill()` BFS to produce a visited mask instead of writing colors.
4. **Marching-ants rendering**: Walk the mask border pixel-by-pixel, draw alternating white/black 1px dashes on selection-canvas in a RAF loop.
5. **Tool clipping**: Pencil, Eraser, and Paint Bucket check `EditorState.selectionMask` before writing each pixel.
6. **Keyboard + UI**: Add Cmd+D, Shift+Cmd+I, Delete, Option+Delete handlers; show/hide top-bar buttons when selection changes.

The two technically hard sub-problems are **marching-ants border tracing** (must work for irregular Wand masks) and **correct Shift-union semantics** (OR two masks together).

**Primary recommendation:** Implement the pixel mask as `EditorState.selectionMask` (a `Uint8Array`, length = width*height), keep the `EditorState.selection` bounding-box as a fast pre-check, and drive marching-ants from a single RAF loop that scans the mask for exposed edges.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Browser Canvas 2D API | Living Standard | Selection canvas rendering, RAF loop | Already the entire project stack |
| `Uint8Array` | ES2015 | One-byte-per-pixel mask | O(1) random access; same pattern as existing `visited` bitmap in `floodFill()` |
| `requestAnimationFrame` | Living Standard | Marching-ants animation | Already used by the project (CLAUDE.md pattern); cancel via `cancelAnimationFrame` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | — | No external dependencies needed | This is an inline-JS project; no npm |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Uint8Array mask | BitSet / typed bit array | Not needed; 1 byte/pixel is 64KB for a 256x256 canvas — totally fine |
| Manual border-edge scan | Path2D + clip | Path2D cannot produce the classic dash-offset animation; border scan is necessary |
| setLineDash on selection-canvas | Custom pixel rendering | `setLineDash` with `lineDashOffset` on Canvas 2D is actually the RIGHT approach for marching-ants on a rect; but for irregular pixel masks the approach must be pixel-edge scanning |

---

## Architecture Patterns

### Recommended Data Model Extension

The current `EditorState.selection` is `null | {x,y,w,h}`. The Phase 5 model adds a parallel mask:

```javascript
// Extend EditorState (add two new fields — existing fields unchanged):
EditorState.selectionMask = null; // Uint8Array, length = width*height; 1=selected, 0=not
// EditorState.selection stays as {x,y,w,h} bounding box for fast early-out checks

// Helper: set an active selection
function setSelection(mask, bbox) {
  EditorState.selectionMask = mask;
  EditorState.selection = bbox;   // {x, y, w, h}
  updateSelectionUI();
  scheduleAnts();
}

// Helper: clear selection
function clearSelection() {
  EditorState.selectionMask = null;
  EditorState.selection = null;
  if (antsRafId) { cancelAnimationFrame(antsRafId); antsRafId = null; }
  selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
  updateSelectionUI();
}
```

### Pattern 1: Grid-Snap for Marquee

```javascript
// snap a canvas coordinate to the nearest grid corner
function snapToGrid(v, gridSize) {
  if (gridSize <= 1) return v;   // gridSize=0 or 1 → pixel-level
  return Math.round(v / gridSize) * gridSize;
}

// In tools.marquee.onDown / onMove / onUp:
const gW = EditorState.gridW || 1;
const gH = EditorState.gridH || 1;
const x0 = snapToGrid(startX, gW);
const y0 = snapToGrid(startY, gH);
const x1 = snapToGrid(currentX, gW);
const y1 = snapToGrid(currentY, gH);
// bounding rect: min/max so drag direction doesn't matter
const rx = Math.min(x0, x1), ry = Math.min(y0, y1);
const rw = Math.abs(x1 - x0), rh = Math.abs(y1 - y0);
```

Note: a Marquee drag that snaps both endpoints to the same grid corner produces a zero-size selection — skip committing in that case.

### Pattern 2: Magic Wand — BFS That Produces a Mask

The existing `floodFill()` uses an identical BFS with a `visited` Uint8Array. The Wand tool repurposes this to produce a selection mask instead of writing colors:

```javascript
function wandSelect(startX, startY, tolerance, contiguous) {
  const W = EditorState.width, H = EditorState.height;
  const mask = new Uint8Array(W * H);
  const target = getPixel(startX, startY);

  function matches(px, py) {
    const [r,g,b,a] = getPixel(px, py);
    if (target[3] === 0 && a === 0) return true;
    if (target[3] === 0 || a === 0) return false;
    return Math.abs(r-target[0]) <= tolerance &&
           Math.abs(g-target[1]) <= tolerance &&
           Math.abs(b-target[2]) <= tolerance &&
           Math.abs(a-target[3]) <= tolerance;
  }

  if (contiguous) {
    const startIdx = startX + startY * W;
    mask[startIdx] = 1;
    const stack = [startIdx];
    while (stack.length) {
      const idx = stack.pop();
      const px = idx % W, py = (idx / W) | 0;
      const neighbors = [[px-1,py],[px+1,py],[px,py-1],[px,py+1]];
      for (const [nx,ny] of neighbors) {
        if (nx<0||nx>=W||ny<0||ny>=H) continue;
        const ni = nx + ny * W;
        if (!mask[ni] && matches(nx,ny)) { mask[ni] = 1; stack.push(ni); }
      }
    }
  } else {
    // Non-contiguous: mark all matching pixels
    for (let y=0; y<H; y++)
      for (let x=0; x<W; x++)
        if (matches(x,y)) mask[x + y*W] = 1;
  }

  // Compute bounding box from mask
  let minX=W,minY=H,maxX=-1,maxY=-1;
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
    if (mask[x+y*W]) { minX=Math.min(minX,x); minY=Math.min(minY,y); maxX=Math.max(maxX,x); maxY=Math.max(maxY,y); }
  }
  if (maxX === -1) return; // nothing selected
  return { mask, bbox: {x:minX, y:minY, w:maxX-minX+1, h:maxY-minY+1} };
}
```

### Pattern 3: Shift-Union (Accumulating Selections)

```javascript
function unionMasks(existingMask, newMask, totalPixels) {
  if (!existingMask) return newMask;
  const result = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++)
    result[i] = existingMask[i] | newMask[i];  // bitwise OR
  return result;
}
```

Call this when `e.shiftKey` is true in `tools.marquee.onUp` and `tools.wand.onDown`.

### Pattern 4: Marching-Ants Rendering

Two-layer approach:
- During Marquee **drag**: render a simple rect preview (no animation needed yet — user is still dragging).
- After **commit** (any active selection): start RAF loop that scans mask edges.

**Edge scan approach for irregular masks:**

A pixel at `(x, y)` with `mask[x+y*W] = 1` contributes a top edge if `mask[x+(y-1)*W] = 0` (or y=0), a bottom edge if `mask[x+(y+1)*W] = 0` (or y=H-1), etc. Collect all such edge segments, then draw them with an animated dash offset.

```javascript
let antsRafId = null;
let antsDashOffset = 0;

function drawAnts() {
  const W = EditorState.width, H = EditorState.height;
  const mask = EditorState.selectionMask;
  if (!mask) { antsRafId = null; return; }

  const dpr = window.devicePixelRatio || 1;
  selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
  selCtx.save();
  selCtx.scale(dpr, dpr);

  selCtx.lineWidth = 1;
  selCtx.setLineDash([4, 4]);

  // White dashes pass
  selCtx.strokeStyle = '#ffffff';
  selCtx.lineDashOffset = antsDashOffset;
  _drawMaskEdges(selCtx, mask, W, H);

  // Black dashes pass (offset by dash length so black fills white gaps)
  selCtx.strokeStyle = '#000000';
  selCtx.lineDashOffset = antsDashOffset + 4;
  _drawMaskEdges(selCtx, mask, W, H);

  selCtx.restore();
  antsDashOffset = (antsDashOffset - 1 + 8) % 8;  // scroll direction
  antsRafId = requestAnimationFrame(drawAnts);
}

function _drawMaskEdges(ctx, mask, W, H) {
  ctx.beginPath();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[x + y * W]) continue;
      // Top edge
      if (y === 0 || !mask[x + (y-1)*W]) { ctx.moveTo(x, y); ctx.lineTo(x+1, y); }
      // Bottom edge
      if (y === H-1 || !mask[x + (y+1)*W]) { ctx.moveTo(x, y+1); ctx.lineTo(x+1, y+1); }
      // Left edge
      if (x === 0 || !mask[(x-1) + y*W]) { ctx.moveTo(x, y); ctx.lineTo(x, y+1); }
      // Right edge
      if (x === W-1 || !mask[(x+1) + y*W]) { ctx.moveTo(x+1, y); ctx.lineTo(x+1, y+1); }
    }
  }
  ctx.stroke();
}

function scheduleAnts() {
  if (antsRafId) cancelAnimationFrame(antsRafId);
  antsDashOffset = 0;
  antsRafId = requestAnimationFrame(drawAnts);
}
```

**Performance note:** For a 256x256 canvas (65k pixels), the edge scan runs in ~1ms per frame. This is acceptable. For 512x512+ canvases (260k pixels) the scan can take 3-5ms; use `requestAnimationFrame` naturally throttles to 60fps regardless.

**Marquee drag preview (no animation — just a rect outline):**

```javascript
// In tools.marquee.onMove (during drag, before commit):
selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
const dpr = window.devicePixelRatio || 1;
selCtx.save(); selCtx.scale(dpr, dpr);
selCtx.strokeStyle = '#ffffff'; selCtx.lineWidth = 1;
selCtx.setLineDash([4, 4]); selCtx.lineDashOffset = 0;
selCtx.strokeRect(rx + 0.5, ry + 0.5, rw, rh);
selCtx.strokeStyle = '#000000'; selCtx.lineDashOffset = 4;
selCtx.strokeRect(rx + 0.5, ry + 0.5, rw, rh);
selCtx.restore();
```

### Pattern 5: Tool Clipping (Pencil / Eraser / Bucket)

Add a guard function:

```javascript
function isSelectedPixel(x, y) {
  if (!EditorState.selectionMask) return true;  // no selection → all pixels writable
  // Fast bounding-box pre-check
  const bb = EditorState.selection;
  if (x < bb.x || x >= bb.x + bb.w || y < bb.y || y >= bb.y + bb.h) return false;
  return EditorState.selectionMask[x + y * EditorState.width] === 1;
}
```

Modify existing `applyStamp()` to check `isSelectedPixel()` before `setPixel()`:

```javascript
function applyStamp(cx, cy, stamp, color) {
  for (const [dx, dy] of stamp) {
    const x = cx + dx, y = cy + dy;
    if (x >= 0 && x < EditorState.width && y >= 0 && y < EditorState.height) {
      if (isSelectedPixel(x, y)) setPixel(x, y, color);  // ← add this guard
    }
  }
  flushPixels();
}
```

For Paint Bucket: after `floodFill()` produces its result, we need it to respect the selection. The cleanest approach is to add the selection mask check inside `floodFill()`'s `setPixel` call path — or pass the mask in and AND with it. Since `floodFill()` calls `setPixel()` directly, the simplest implementation is to have `setPixel()` itself respect the mask:

```javascript
// Alternative: make setPixel selection-aware
function setPixelMasked(x, y, rgba) {
  if (!isSelectedPixel(x, y)) return;
  setPixel(x, y, rgba);
}
```

Then use `setPixelMasked` in floodFill when a selection is active, or just replace the `setPixel` call in floodFill's body with a masked variant when `EditorState.selectionMask` is non-null.

### Pattern 6: Inverse Selection

```javascript
function invertSelection() {
  const W = EditorState.width, H = EditorState.height;
  const total = W * H;
  if (!EditorState.selectionMask) {
    // No selection → invert = select all
    EditorState.selectionMask = new Uint8Array(total).fill(1);
    EditorState.selection = { x: 0, y: 0, w: W, h: H };
  } else {
    const newMask = new Uint8Array(total);
    for (let i = 0; i < total; i++) newMask[i] = EditorState.selectionMask[i] ? 0 : 1;
    EditorState.selectionMask = newMask;
    // Recompute bounding box
    EditorState.selection = computeBoundingBox(newMask, W, H);
  }
  updateSelectionUI();
  scheduleAnts();
}
```

### Pattern 7: Delete / Fill Shortcuts

```javascript
// Delete: fill selected pixels with transparent
function deleteSelection() {
  if (!EditorState.selectionMask) return;
  pushHistory();
  const W = EditorState.width;
  for (let i = 0; i < EditorState.selectionMask.length; i++) {
    if (EditorState.selectionMask[i]) {
      const x = i % W, y = (i / W) | 0;
      setPixel(x, y, [0, 0, 0, 0]);
    }
  }
  flushPixels();
}

// Option+Delete: fill selected pixels with foreground color
function fillSelection() {
  if (!EditorState.selectionMask) return;
  pushHistory();
  const W = EditorState.width;
  const color = [...EditorState.foregroundColor];
  for (let i = 0; i < EditorState.selectionMask.length; i++) {
    if (EditorState.selectionMask[i]) {
      const x = i % W, y = (i / W) | 0;
      setPixel(x, y, color);
    }
  }
  flushPixels();
}
```

### Pattern 8: Top-Bar Button Show/Hide

```javascript
function updateSelectionUI() {
  const hasSelection = !!EditorState.selectionMask;
  const btnDeselect = document.getElementById('btn-deselect');
  const btnInverse  = document.getElementById('btn-inverse');
  if (btnDeselect) btnDeselect.style.display = hasSelection ? '' : 'none';
  if (btnInverse)  btnInverse.style.display  = hasSelection ? '' : 'none';
}
```

The buttons must be added to the top-bar HTML:

```html
<!-- Inside #top-bar, after tool settings panels, before the flex-spacer -->
<button class="btn btn-ghost" id="btn-deselect" style="display:none" title="Deselect (Cmd+D)">Deselect</button>
<button class="btn btn-ghost" id="btn-inverse"  style="display:none" title="Inverse (Shift+Cmd+I)">Inverse</button>
```

### Pattern 9: Enabling Marquee and Wand Tool Buttons

Current HTML (line 361-362):

```html
<button class="tool-btn" disabled title="Marquee (M)">&#9645;</button>
<button class="tool-btn" disabled title="Wand (W)">&#10022;</button>
```

Must: remove `disabled`, add `data-tool="marquee"` and `data-tool="wand"`, add entries to `tools` object, add 'marquee' and 'wand' to the `panelIds` list in `setActiveTool()`, and add HTML tool-settings panels for Marquee (no options needed beyond implicit grid info display) and Wand (Tolerance + Contiguous inputs).

### Anti-Patterns to Avoid

- **Using a rectangular mask for Wand selection**: A rectangular bounding box loses the irregular shape and breaks Phase 6 Move. Must be a per-pixel `Uint8Array`.
- **Not cancelling the RAF on clearSelection**: The CLAUDE.md Known Issues section explicitly calls this out. Forgetting this leaks an infinite RAF loop that keeps running even when no selection is active.
- **Reading from canvas for selection rendering**: The selection-canvas must only be written to, never read from, during tool logic.
- **Pushing history on every pointermove during Marquee drag**: The drag preview is visual-only; history push happens once in `onUp` when the selection is committed.
- **Running the marching-ants edge scan synchronously every frame for very large canvases**: For very large images (e.g. 1024x1024 = 1M pixels), the edge scan takes ~15ms per frame — too slow. Add a frame-skip or cache the edge path. For typical pixel art sizes (<= 256x256), this is not an issue.
- **Applying selection clip inside flushPixels()**: `flushPixels()` uses `putImageData` which operates on `EditorState.pixels` directly. The selection clip must happen before writing to `EditorState.pixels`, not during the flush.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Marching-ants dash pattern | Custom dithering or canvas pixel stamping | Canvas `setLineDash` + `lineDashOffset` + two-pass stroke | Browser handles anti-alias, clipping, GPU acceleration |
| Mask union | Complex polygon merge | Bitwise OR over `Uint8Array` | One loop, no edge cases |
| BFS flood-fill for Wand | Recursive DFS | Iterative BFS (reuse existing `floodFill` pattern) | CLAUDE.md explicitly warns: recursive overflows at ~4000px |
| Grid snap rounding | Floor/ceiling logic | `Math.round(v / grid) * grid` | Correct for both positive and negative coordinates |

---

## Common Pitfalls

### Pitfall 1: RAF Not Cancelled on clearSelection
**What goes wrong:** Marching-ants keep animating forever after Cmd+D; next selection starts with stale state.
**Why it happens:** `cancelAnimationFrame(antsRafId)` is not called, or `antsRafId` is not set to `null` after cancel, allowing duplicate RAF chains.
**How to avoid:** Always use the pattern: `if (antsRafId) { cancelAnimationFrame(antsRafId); antsRafId = null; }` in `clearSelection()`.
**Warning signs:** After deselecting, selCanvas still shows an animated border.

### Pitfall 2: Selection-Canvas DPR Coordinate Mismatch
**What goes wrong:** Selection outline is drawn at wrong position/scale relative to pixel-canvas.
**Why it happens:** The selection-canvas is DPR-scaled (overlay canvas), so drawing at pixel coordinate `(x, y)` must be done after `selCtx.scale(dpr, dpr)`. Forgetting the scale means the ants appear at wrong positions on Retina displays.
**How to avoid:** Always save/restore context, call `selCtx.scale(dpr, dpr)` before drawing, then restore. This follows the same pattern used during `initCanvases()`.
**Warning signs:** Marching-ants appear offset or at half/double size on a Retina screen.

### Pitfall 3: Committing Zero-Size Marquee Selection
**What goes wrong:** A click (no drag) on the canvas commits an empty selection mask, then Deselect button appears with an invisible selection confusing the user.
**Why it happens:** Grid-snap can collapse both endpoints to the same corner; `rw = 0` and `rh = 0`.
**How to avoid:** In `tools.marquee.onUp()`: if `rw === 0 || rh === 0`, call `clearSelection()` instead of `setSelection()`.
**Warning signs:** Deselect button visible but nothing appears on canvas.

### Pitfall 4: Shift-Union Not Creating New Mask Array
**What goes wrong:** Mutating `EditorState.selectionMask` in-place when computing union corrupts the existing selection.
**Why it happens:** Doing `existingMask[i] |= newMask[i]` writes into the existing buffer, which is fine for union but can cause issues if the same mask is referenced elsewhere (e.g. undo).
**How to avoid:** Always allocate a new `Uint8Array` for union results. The OR loop is O(n) and fast enough.
**Warning signs:** Undo after a Shift-union restores wrong mask.

### Pitfall 5: Wand on Transparent Background Selects Everything
**What goes wrong:** If the user clicks a fully-transparent pixel, the tolerance matching logic `(target[3] === 0 && a === 0) → true` selects all transparent pixels in the image, potentially the entire canvas.
**Why it happens:** The existing `floodFill()` semantics treat transparent as "same color regardless of RGB". This is correct for filling but may surprise users for selection.
**How to avoid:** This is acceptable and matches Photoshop/Aseprite behavior (select all transparent = select entire transparent region). Document, don't fight it.
**Warning signs:** Entire canvas selected after wanding a transparent area — this is expected.

### Pitfall 6: Delete Key Conflicts with Text Inputs
**What goes wrong:** Pressing Delete in a Tolerance input field triggers `deleteSelection()`.
**Why it happens:** The keydown handler doesn't guard against text inputs for the Delete key.
**How to avoid:** The existing guard `if (e.target.matches('input, textarea')) return;` at the top of the keydown handler already prevents this — maintain it for all new key bindings.
**Warning signs:** Deleting digits in number inputs also erases selected canvas content.

### Pitfall 7: Marching-Ants Performance on Large Canvases
**What goes wrong:** Frame rate drops to <30fps when selection mask is large on a high-resolution canvas.
**Why it happens:** The edge scan is O(W*H) per frame. For a 512x512 canvas = 262k iterations per frame at 60fps.
**How to avoid:** Cache the edge path as a `Path2D` object, regenerate only when the mask changes (not every frame). Only the `lineDashOffset` needs updating per frame.
**Optimized approach:**
```javascript
let _antsPath = null;
function rebuildAntsPath(mask, W, H) {
  _antsPath = new Path2D();
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
    if (!mask[x+y*W]) continue;
    if (y===0   || !mask[x+(y-1)*W]) { _antsPath.moveTo(x,y);   _antsPath.lineTo(x+1,y);   }
    if (y===H-1 || !mask[x+(y+1)*W]) { _antsPath.moveTo(x,y+1); _antsPath.lineTo(x+1,y+1); }
    if (x===0   || !mask[(x-1)+y*W]) { _antsPath.moveTo(x,y);   _antsPath.lineTo(x,y+1);   }
    if (x===W-1 || !mask[(x+1)+y*W]) { _antsPath.moveTo(x+1,y); _antsPath.lineTo(x+1,y+1); }
  }
}
// Call rebuildAntsPath whenever mask changes; only update lineDashOffset per frame.
```
**Warning signs:** Browser DevTools show >8ms scripting per animation frame.

---

## Code Examples

### Enabling Marquee and Wand buttons (HTML delta)

```html
<!-- Replace disabled marquee button (line 361) -->
<button class="tool-btn" data-tool="marquee" title="Marquee (M)">&#9645;</button>
<!-- Replace disabled wand button (line 362) -->
<button class="tool-btn" data-tool="wand" title="Wand (W)">&#10022;</button>
```

### setActiveTool() extension (JS delta)

```javascript
// Add to panelIds array (line 595):
const panelIds = ['tool-settings-pencil','tool-settings-eraser','tool-settings-bucket',
                  'tool-settings-marquee','tool-settings-wand'];
// Add to tool shortcut keys:
if (e.key === 'm' || e.key === 'M') setActiveTool('marquee');
if (e.key === 'w' || e.key === 'W') setActiveTool('wand');
```

### Keyboard handler additions (inside existing keydown handler)

```javascript
// After undo/redo block — add selection shortcuts:
// Cmd+D → Deselect
if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'd') {
  e.preventDefault(); clearSelection();
}
// Shift+Cmd+I → Inverse
if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'i') {
  e.preventDefault(); invertSelection();
}
// Delete → clear selected pixels
if (e.key === 'Delete' && !e.altKey && EditorState.selectionMask) {
  e.preventDefault(); deleteSelection();
}
// Option+Delete → fill selected pixels with foreground color
if (e.key === 'Delete' && e.altKey && EditorState.selectionMask) {
  e.preventDefault(); fillSelection();
}
```

### Tool settings HTML for Wand

```html
<div id="tool-settings-wand" style="display:none; align-items:center; gap:8px;">
  <label style="font-size:12px; color:var(--text-muted);">Tolerance</label>
  <input id="opt-wand-tolerance" type="number" min="0" max="255" value="15"
    style="width:52px; padding:3px 6px; border-radius:5px; border:1px solid var(--border);
           background:var(--surface2); color:var(--text); font-size:12px;">
  <label style="font-size:12px; color:var(--text-muted); display:flex; align-items:center; gap:4px; cursor:pointer;">
    <input id="opt-wand-contiguous" type="checkbox" checked>Contiguous
  </label>
</div>
<div id="tool-settings-marquee" style="display:none; align-items:center; gap:8px;">
  <!-- No user options for Marquee — grid snap is automatic -->
  <span style="font-size:12px; color:var(--text-muted);">Grid-snapped selection</span>
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Recursive flood-fill (simple but crashes) | Iterative BFS with visited bitmap | Established in Phase 3 | Must reuse this pattern for Wand — no recursion |
| Rectangular selection only | Per-pixel `Uint8Array` mask | This phase introduces it | Enables irregular Wand selections and accurate Phase 6 Move |
| Canvas 2D `setLineDash` for dash patterns | Same — still current standard | Living Standard | No change needed; works in all modern browsers |
| `getImageData` for pixel reading | `EditorState.pixels` buffer | Established in Phase 1 | Never read from canvas; always from EditorState |

---

## Open Questions

1. **Marching-ants frame rate for large canvases**
   - What we know: 60fps RAF with O(W*H) edge scan is fine for typical pixel art (<= 256x256).
   - What's unclear: Project doesn't state a max supported canvas size; some images from web_ui.html output may be 512x512+.
   - Recommendation: Use the Path2D caching approach (rebuild only on mask change, animate only dash offset) so performance scales to larger canvases without frame drops.

2. **Wand Tolerance input — shared with Bucket or separate?**
   - What we know: CONTEXT.md implies Wand gets its own Tolerance input (SEL-03 separates it from DRAW-04). `EditorState.toolOptions.wandTolerance` already exists as a separate field from `bucketTolerance`.
   - What's unclear: Should the Wand Contiguous checkbox be the same DOM input as Bucket's, or separate?
   - Recommendation: Use separate DOM inputs (`opt-wand-tolerance`, `opt-wand-contiguous`) that bind to `EditorState.toolOptions.wandTolerance` and a new `EditorState.toolOptions.wandContiguous` field. This avoids state coupling between two unrelated tools. The current `contiguous` field in `toolOptions` can remain for Bucket only.

3. **clearSelection on image load**
   - What we know: CONTEXT.md says "loading new image" clears selection.
   - What's unclear: Where exactly in editor.html is the image loaded? (No image-load code is visible in the current file — likely Phase 7 or sessionStorage handoff).
   - Recommendation: Call `clearSelection()` wherever `EditorState.pixels` is re-initialized. Add a comment as a reminder for Phase 7 integration.

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection of `/Users/calling/perfectPixel_ver1.1/editor.html` — confirmed: `selCanvas`/`selCtx` at lines 606/609, `floodFill()` BFS pattern at line 842, `EditorState.selection` at line 543, disabled Marquee/Wand buttons at lines 361-362, `tools` dispatch object at line 1048, keydown handler at line 1428
- CLAUDE.md "Known Issues" section — confirmed: RAF cancellation requirement, iterative BFS requirement, premultiplied alpha isolation
- CLAUDE.md "Key Patterns" — `clearSelection()` with `cancelAnimationFrame` pattern, `floodFill` visited-before-push pattern
- `05-CONTEXT.md` — locked decisions for all major design choices

### Secondary (MEDIUM confidence)

- MDN Web Docs Canvas 2D API: `setLineDash`, `lineDashOffset`, `Path2D` — standard browser API, stable and supported in all targets (Chrome, Safari, Firefox)
- `Path2D` constructor for caching edge paths — widely supported in browsers, no IE concern for a local tool

### Tertiary (LOW confidence)

- None — all findings are derived from direct codebase inspection or browser standard APIs.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pure browser Canvas 2D, zero new dependencies, all patterns verified against existing codebase
- Architecture: HIGH — all data structures and integration points confirmed by direct code inspection; patterns derived from existing Phase 3 code
- Pitfalls: HIGH — most pitfalls come directly from CLAUDE.md Known Issues or are mechanical consequences of the code structure

**Research date:** 2026-03-03
**Valid until:** 2026-06-03 (stable browser APIs; 90 days)
