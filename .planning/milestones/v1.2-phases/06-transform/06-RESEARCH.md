# Phase 6: Transform - Research

**Researched:** 2026-03-04
**Domain:** Browser canvas pixel art transform — Move (floating selection), Scale (8-handle nearest-neighbor), RotSprite rotation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Move 行为（Floating Model）**
- 激活 Move(V) 并开始拖动时，选区内容从原位"剪切"——原位像素变为透明（alpha=0），内容以 `selectionPixels` 形式浮起，实时跟随鼠标
- 拖动中内容实时渲染到 selCanvas（不写入 EditorState.pixels）
- Enter / Apply 按钮：将浮起内容落点写入 EditorState.pixels，pushHistory()（一次），自动取消选区
- ESC / Cancel 按钮：恢复原位像素（从浮起前的备份还原），不写入历史

**Transform 激活方式（统一模式）**
- Move(V) 是唯一的变换入口工具，不拆分为三个独立工具
- 激活 Move(V) 且存在选区时，selCanvas 自动渲染：静态虚线框 + 8 个小方块 handle（4 角 + 4 边中点）
- 蚂蚁线动画停止（cancelAnimationFrame(antsRafId)），由静态虚线框替代
- 用户可在一次"待定态"中叠加：拖动移位 + 拖 handle 缩放 + 顶栏输入旋转角度，所有操作不写入历史
- 最终一次 Enter/Apply → 复合变换全部提交 → 一个 undo 步骤 → 自动取消选区

**Scale（8-handle 缩放）**
- 角点 handle：等比缩放（锁定宽高比）；边中点 handle：单轴缩放
- 允许任意比例（非整数倍），但像素落点始终对齐到画布整数网格
- 缩放算法：Claude 自选（推荐 nearest-neighbor，保留像素艺术硬边）
- 顶栏实时显示：X scale %、Y scale %、锁比例 checkbox

**RotSprite 旋转**
- 旋转入口：顶栏角度输入框（实时预览，输入即渲染到 selCanvas）
- 选区 > 128×128px 时：显示状态提示，不执行旋转
- RotSprite 算法在 selectionPixels 的当前浮起状态上运行（非原始截取时的快照）
- 顶栏显示：旋转角度输入框（度）

**Apply 后选区处理**
- Enter/Apply 提交后：自动取消选区（蚂蚁线不恢复），回到普通工具模式
- 用户需重新框选才能继续变换

**距离显示**
- 拖动移位时，在浮起内容旁显示浮动小标注（CSS overlay）
- 显示内容：到画布四边的像素距离（如 "←12 | 34→"）
- 不使用顶栏，避免视线离开画布

**溢出行为**
- 待定态（未 Apply）：允许浮起内容超出画布边界（不剪裁，方便精确定位）
- Apply 时：只将画布范围内的像素写入 EditorState.pixels，画布外部分丢弃

**变换视觉（Transform 模式 UI）**
- 蚂蚁线停止，改为静态虚线框 + 8 个方块 handle
- 不规则选区（Magic Wand）：handle 框以选区外围最大矩形 bounding box 为准
- Handle 配色：灰紫色系（与现有深色主题协调）
- Handle 尺寸：固定屏幕像素大小（约 8×8px CSS），与 zoom 无关
- 顶栏在 Transform 模式下始终显示：Apply 按钮 + Cancel 按钮 + 当前操作参数

### Claude's Discretion
- 缩放算法具体实现（nearest-neighbor 或等效）
- Handle 确切像素尺寸（推荐 8×8px CSS）
- 灰紫色 handle 的具体 hex 值（与主题色变量协调）
- 距离标注的 CSS 样式细节
- 顶栏在移位/缩放/旋转三种状态下的参数布局（可全部同时显示）

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| XFM-01 | 选区四角+四边共 8 个控制点，拖拽可进行缩放变换 | Handle hit-test pattern, nearest-neighbor scale algorithm documented below |
| XFM-02 | 选区旋转使用 RotSprite 算法（JavaScript 重新实现 Aseprite 的 Scale2x×3 + 最近邻旋转 + 下采样流程） | RotSprite algorithm fully documented with Scale2x pseudocode and JS pattern |
| XFM-03 | 变换/旋转激活时，顶栏显示 Apply ☑️（Enter）和 Cancel ✖️（ESC） | Top-bar panel show/hide pattern documented; keyboard handler pattern in place |
| XFM-04 | 变换/旋转激活时，顶栏显示 X 缩放倍率、Y 缩放倍率（可键入）、等比缩放勾选框、旋转角度（可键入） | Transform state structure and top-bar binding pattern documented |
| XFM-05 | Move Tool（快捷键 V）：移动选区时显示选区距画布四边的像素距离 | CSS overlay distance annotation pattern documented |
</phase_requirements>

---

## Summary

Phase 6 implements three transform operations on an existing selection: Move (floating cut-and-place), Scale (8-handle nearest-neighbor resize), and RotSprite rotation. All three share a single "pending state" model — no pixels are written to `EditorState.pixels` until Enter/Apply fires. The entire phase lives inside `editor.html` as inline JS; no external libraries are added.

The most technically complex piece is RotSprite. It is a pure-JS reimplementation of Aseprite's pixel-art rotation pipeline: (1) Scale2x applied 3 times to reach 8× size, (2) nearest-neighbor rotation at 8× scale, (3) 8× downsample back to original size using nearest-neighbor. The Scale2x algorithm has known pseudocode that fits in ~20 lines of JS. The 128×128 px hard limit (from CLAUDE.md) caps the 8× buffer at 1024×1024 = 4 MB, which is safe.

The second major piece is the handle system on `selCanvas`. Handles are drawn at fixed 8×8 CSS-px squares using the same coordinate conversion formula established in Phase 5.1 (canvas coords → selCanvas CSS coords via `pixelCanvas.getBoundingClientRect()`). Hit-testing handles requires the inverse of that formula (pointer client coords → handle index). Scale dragging applies nearest-neighbor resampling of `selectionPixels` into a new bounding box.

The floating model for Move is straightforward: on `pointerdown` in Move mode with an active selection, snapshot `selectionPixels`, clear those pixels to transparent in `EditorState.pixels`, then render `selectionPixels` at offset on `selCanvas` during drag without touching `EditorState.pixels`.

**Primary recommendation:** Implement in three plans — Plan 1: Move tool + floating model + distance overlay; Plan 2: 8-handle scale + top-bar controls; Plan 3: RotSprite algorithm + top-bar rotation input + Apply/Cancel/keyboard.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS + Canvas 2D API | Browser native | All pixel operations, selCanvas drawing | Project constraint — no external libraries; single HTML file |
| Uint8ClampedArray | Browser native | selectionPixels buffer, Scale2x intermediate buffers | Already the canonical pixel store in EditorState.pixels |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS position:fixed overlay | Browser native | Distance annotation div | Floating label near cursor — must track pointer position |
| requestAnimationFrame | Browser native | Redrawing transform preview on selCanvas | Not needed for ants (stopped), used if continuous preview needed during drag |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure JS Scale2x | WebGL shader (rotsprite-webgl) | WebGL faster for large images, but adds complexity; 128px limit makes pure JS fast enough |
| 8× Scale2x upscale | Fast RotSprite 3× upscale | 3× is faster/cheaper; 8× matches Aseprite exactly as required by XFM-02 |
| CSS overlay distance label | Top-bar display | Top-bar requires eye movement away from canvas — user decision mandates overlay |

**Installation:** None — no npm, no build step. Single HTML file.

---

## Architecture Patterns

### Recommended Structure

All new code goes inside `editor.html` `<script>` block, continuing the existing pattern:

```
editor.html
├── CSS: .transform-distance-label (new — CSS overlay for distance display)
├── HTML: #tool-settings-move div (new — top-bar panel for Move/Transform)
├── HTML: Move tool button (existing, currently disabled — enable with data-tool="move")
├── JS: EditorState.transformState = null (already reserved)
├── JS: transformRotSprite(pixels, w, h, angleDeg) → Uint8ClampedArray
├── JS: scaleNearestNeighbor(pixels, srcW, srcH, dstW, dstH) → Uint8ClampedArray
├── JS: scale2x(pixels, w, h) → Uint8ClampedArray  (3× applied = 8×)
├── JS: drawTransformHandles()  (renders static dashed border + 8 handles on selCanvas)
├── JS: hitTestHandle(clientX, clientY) → handleIndex | null  (0–7 clockwise from TL)
├── JS: tools.move = { onDown, onMove, onUp, onCursor }
└── JS: applyTransform() / cancelTransform()
```

### Pattern 1: TransformState — Pending State Object

**What:** `EditorState.transformState` stores all pending transform parameters during a transform session. Nothing writes to `EditorState.pixels` until commit.

**When to use:** Activated on `pointerdown` when Move(V) is active and a selection exists.

```javascript
// Source: 06-CONTEXT.md decisions + CLAUDE.md EditorState section
EditorState.transformState = {
  // Snapshot of original pixels under selection (for ESC restore)
  originalPixels: EditorState.pixels.slice(),       // full canvas snapshot
  // The floating content being transformed
  floatPixels: null,          // Uint8ClampedArray, size = sel.w * sel.h * 4
  floatW: 0, floatH: 0,       // current dimensions (changes on scale)
  // Current position of float top-left in canvas pixel coords
  floatX: 0, floatY: 0,
  // Scale factors (1.0 = original)
  scaleX: 1.0, scaleY: 1.0,
  // Rotation angle in degrees (0 = no rotation)
  angleDeg: 0,
  // Drag state
  _dragMode: null,     // null | 'move' | 'handle-0' .. 'handle-7'
  _dragStartClientX: 0, _dragStartClientY: 0,
  _dragStartFloatX: 0, _dragStartFloatY: 0,
  _dragStartScaleX: 1, _dragStartScaleY: 1,
  // Original bounding box (for handle scale anchor computation)
  origBbox: null,   // {x, y, w, h} from EditorState.selection at time of activation
};
```

### Pattern 2: Floating Model Activation

**What:** On first `pointerdown` in Move mode with an active selection, "lift" the selection content.

```javascript
// Source: CONTEXT.md "Move 行为（Floating Model）"
function activateTransform() {
  if (!EditorState.selectionMask || !EditorState.selection) return;
  const bb = EditorState.selection;
  const W = EditorState.width;
  const mask = EditorState.selectionMask;

  // 1. Extract float pixels from EditorState.pixels (bounded by selection bbox)
  const floatPx = new Uint8ClampedArray(bb.w * bb.h * 4);
  for (let fy = 0; fy < bb.h; fy++) {
    for (let fx = 0; fx < bb.w; fx++) {
      const cx = bb.x + fx, cy = bb.y + fy;
      if (mask[cx + cy * W]) {
        const srcI = (cy * W + cx) * 4;
        const dstI = (fy * bb.w + fx) * 4;
        floatPx[dstI]   = EditorState.pixels[srcI];
        floatPx[dstI+1] = EditorState.pixels[srcI+1];
        floatPx[dstI+2] = EditorState.pixels[srcI+2];
        floatPx[dstI+3] = EditorState.pixels[srcI+3];
      }
      // Non-selected pixels within bbox: stay transparent in float
    }
  }

  // 2. Erase selected pixels from canvas (alpha=0)
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      const px = i % W, py = (i / W) | 0;
      setPixel(px, py, [0, 0, 0, 0]);
    }
  }
  flushPixels();

  // 3. Initialize transformState
  EditorState.transformState = {
    originalPixels: /* taken BEFORE erase */ ...,
    floatPixels: floatPx,
    floatW: bb.w, floatH: bb.h,
    floatX: bb.x, floatY: bb.y,
    scaleX: 1.0, scaleY: 1.0,
    angleDeg: 0,
    origBbox: { ...bb },
    _dragMode: null, ...
  };

  // 4. Stop ants, draw static transform UI
  cancelAnimationFrame(antsRafId); antsRafId = null;
  drawTransformHandles();
  showTransformTopBar();
}
```

**Critical note:** `originalPixels` must be snapshotted BEFORE the erase step (step 2), so ESC can restore the full original state.

### Pattern 3: selCanvas Handle Drawing

**What:** Draw 8 handles (fixed 8×8px CSS squares) and a dashed border on selCanvas using the Phase 5.1 coordinate formula.

```javascript
// Source: CONTEXT.md "Selection Canvas 架构" + Phase 5.1 implementation
function drawTransformHandles() {
  if (!EditorState.transformState) return;
  const ts = EditorState.transformState;
  const dpr = window.devicePixelRatio || 1;
  selCtx.clearRect(0, 0, selCanvas.width / dpr, selCanvas.height / dpr);

  // Coordinate conversion: canvas pixels → selCanvas CSS px
  const caRect  = document.getElementById('canvas-area').getBoundingClientRect();
  const pixRect = pixelCanvas.getBoundingClientRect();
  const originX = pixRect.left - caRect.left;
  const originY = pixRect.top  - caRect.top;
  const ps      = pixRect.width / EditorState.width;  // CSS px per canvas pixel

  // Float bounding box in screen CSS coords
  const sx = originX + ts.floatX * ps;
  const sy = originY + ts.floatY * ps;
  const sw = ts.floatW * ps;
  const sh = ts.floatH * ps;

  // Draw static dashed border (same lineWidth=2 convention as ants)
  selCtx.strokeStyle = 'rgba(160,150,220,0.9)';   // gray-purple, theme-coordinated
  selCtx.lineWidth = 2;
  selCtx.setLineDash([4, 3]);
  selCtx.strokeRect(sx - 1, sy - 1, sw + 2, sh + 2);
  selCtx.setLineDash([]);

  // 8 handles: TL, TC, TR, ML, MR, BL, BC, BR (indices 0-7)
  const HALF = 4;  // handle half-size (8px total)
  const handlePositions = [
    [sx,        sy       ],  // 0 TL
    [sx + sw/2, sy       ],  // 1 TC
    [sx + sw,   sy       ],  // 2 TR
    [sx,        sy + sh/2],  // 3 ML
    [sx + sw,   sy + sh/2],  // 4 MR
    [sx,        sy + sh  ],  // 5 BL
    [sx + sw/2, sy + sh  ],  // 6 BC
    [sx + sw,   sy + sh  ],  // 7 BR
  ];
  selCtx.fillStyle = '#7c6af7';     // var(--accent) value
  selCtx.strokeStyle = '#fff';
  selCtx.lineWidth = 1;
  for (const [hx, hy] of handlePositions) {
    selCtx.fillRect(hx - HALF, hy - HALF, HALF*2, HALF*2);
    selCtx.strokeRect(hx - HALF, hy - HALF, HALF*2, HALF*2);
  }
}
```

### Pattern 4: Handle Hit-Testing

**What:** Convert pointer client coords to a handle index (0–7) or null. Uses the same CSS-space coordinate formula, but inverted.

```javascript
// Note: clientX/clientY from pointer event; caRect = canvas-area.getBoundingClientRect()
function hitTestHandle(clientX, clientY) {
  if (!EditorState.transformState) return null;
  const ts = EditorState.transformState;
  const caRect  = document.getElementById('canvas-area').getBoundingClientRect();
  const pixRect = pixelCanvas.getBoundingClientRect();
  const originX = pixRect.left - caRect.left;
  const originY = pixRect.top  - caRect.top;
  const ps      = pixRect.width / EditorState.width;

  // Client coords relative to canvas-area
  const lx = clientX - caRect.left;
  const ly = clientY - caRect.top;

  const sx = originX + ts.floatX * ps;
  const sy = originY + ts.floatY * ps;
  const sw = ts.floatW * ps;
  const sh = ts.floatH * ps;
  const HALF = 6;  // slightly larger hit zone than visual (8px visual, 12px hit)

  const handlePositions = [
    [sx, sy], [sx+sw/2, sy], [sx+sw, sy],
    [sx, sy+sh/2],            [sx+sw, sy+sh/2],
    [sx, sy+sh], [sx+sw/2, sy+sh], [sx+sw, sy+sh],
  ];
  for (let i = 0; i < handlePositions.length; i++) {
    const [hx, hy] = handlePositions[i];
    if (Math.abs(lx - hx) <= HALF && Math.abs(ly - hy) <= HALF) return i;
  }
  return null;
}
```

**Handle index to scale axis mapping:**
- Corners (0, 2, 5, 7): both X and Y scale (locked if aspect-lock checkbox checked)
- Edge midpoints TC/BC (1, 6): Y scale only
- Edge midpoints ML/MR (3, 4): X scale only

### Pattern 5: Nearest-Neighbor Scale

**What:** Resample `selectionPixels` to a new `dstW × dstH` size using nearest-neighbor (no anti-aliasing).

```javascript
// Source: standard nearest-neighbor algorithm; verified against pixel art convention
function scaleNearestNeighbor(pixels, srcW, srcH, dstW, dstH) {
  const out = new Uint8ClampedArray(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;
  for (let dy = 0; dy < dstH; dy++) {
    const sy = Math.min(srcH - 1, Math.floor(dy * yRatio));
    for (let dx = 0; dx < dstW; dx++) {
      const sx = Math.min(srcW - 1, Math.floor(dx * xRatio));
      const srcI = (sy * srcW + sx) * 4;
      const dstI = (dy * dstW + dx) * 4;
      out[dstI]   = pixels[srcI];
      out[dstI+1] = pixels[srcI+1];
      out[dstI+2] = pixels[srcI+2];
      out[dstI+3] = pixels[srcI+3];
    }
  }
  return out;
}
```

### Pattern 6: Scale2x Algorithm (single pass, 2× upscale)

**What:** Pixel-art-quality 2× upscale. Applied 3 times consecutively to achieve 8× for RotSprite.

```javascript
// Source: scale2x.it/algorithm — verified pseudocode
// colorEq must include alpha (CLAUDE.md rule)
function colorEq(pixels, i1, i2) {
  if (pixels[i1+3] === 0 && pixels[i2+3] === 0) return true;
  if (pixels[i1+3] === 0 || pixels[i2+3] === 0) return false;
  return pixels[i1] === pixels[i2] && pixels[i1+1] === pixels[i2+1] &&
         pixels[i1+2] === pixels[i2+2] && pixels[i1+3] === pixels[i2+3];
}

function scale2x(pixels, w, h) {
  const out = new Uint8ClampedArray(w * 2 * h * 2 * 4);
  const OW = w * 2;

  function copyPixel(src, dst) {
    out[dst]   = pixels[src];
    out[dst+1] = pixels[src+1];
    out[dst+2] = pixels[src+2];
    out[dst+3] = pixels[src+3];
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 3x3 neighborhood (clamp to border)
      const A = ((Math.max(0, y-1)) * w + x)                   * 4;
      const B = (y * w + Math.max(0, x-1))                     * 4;
      const C = (y * w + x)                                     * 4;  // E (center)
      const D = (y * w + Math.min(w-1, x+1))                   * 4;
      const E = ((Math.min(h-1, y+1)) * w + x)                 * 4;
      // Standard Scale2x naming: A=top, B=left, C=center(E), D=right, E=bottom
      // Using official notation: B=top, D=left, E=center, F=right, H=bottom
      const Btop = ((Math.max(0, y-1)) * w + x)               * 4;
      const Dlft = (y * w + Math.max(0, x-1))                  * 4;
      const Ectr = (y * w + x)                                  * 4;
      const Frgt = (y * w + Math.min(w-1, x+1))                * 4;
      const Hbot = ((Math.min(h-1, y+1)) * w + x)              * 4;

      const oy = y * 2, ox = x * 2;
      const E0 = (oy * OW + ox) * 4;
      const E1 = (oy * OW + ox + 1) * 4;
      const E2 = ((oy+1) * OW + ox) * 4;
      const E3 = ((oy+1) * OW + ox + 1) * 4;

      if (!colorEq(pixels, Btop, Hbot) && !colorEq(pixels, Dlft, Frgt)) {
        // E0 = D==B ? D : E
        copyPixel(colorEq(pixels, Dlft, Btop) ? Dlft : Ectr, E0);
        // E1 = B==F ? F : E
        copyPixel(colorEq(pixels, Btop, Frgt) ? Frgt : Ectr, E1);
        // E2 = D==H ? D : E
        copyPixel(colorEq(pixels, Dlft, Hbot) ? Dlft : Ectr, E2);
        // E3 = H==F ? F : E
        copyPixel(colorEq(pixels, Hbot, Frgt) ? Frgt : Ectr, E3);
      } else {
        copyPixel(Ectr, E0); copyPixel(Ectr, E1);
        copyPixel(Ectr, E2); copyPixel(Ectr, E3);
      }
    }
  }
  return out;
}
```

### Pattern 7: RotSprite — Full Pipeline

**What:** Pixel-art rotation using the Aseprite-compatible pipeline: 8× Scale2x → nearest-neighbor rotate at 8× → 8× downsample.

```javascript
// Source: Wikipedia "RotSprite" + rotsprite-webgl analysis + Aseprite rotsprite.cpp description
// MUST check 128×128 limit before calling (CLAUDE.md rule)
function rotSprite(pixels, w, h, angleDeg) {
  // Guard: called only if w*h <= 128*128
  // Step 1: upscale 8× via 3 passes of Scale2x
  let buf = pixels, bw = w, bh = h;
  for (let pass = 0; pass < 3; pass++) {
    buf = scale2x(buf, bw, bh);
    bw *= 2; bh *= 2;
  }
  // bw = w*8, bh = h*8

  // Step 2: nearest-neighbor rotate at 8× scale
  const rad = -angleDeg * Math.PI / 180;  // negative = clockwise
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const cx = bw / 2, cy = bh / 2;

  const rotBuf = new Uint8ClampedArray(bw * bh * 4);  // same dimensions (content rotates, canvas stays)
  for (let dy = 0; dy < bh; dy++) {
    for (let dx = 0; dx < bw; dx++) {
      // Inverse map: destination → source
      const relX = dx - cx, relY = dy - cy;
      const srcX = Math.round(relX * cos - relY * sin + cx);
      const srcY = Math.round(relX * sin + relY * cos + cy);
      if (srcX >= 0 && srcX < bw && srcY >= 0 && srcY < bh) {
        const si = (srcY * bw + srcX) * 4;
        const di = (dy * bw + dx) * 4;
        rotBuf[di]   = buf[si];
        rotBuf[di+1] = buf[si+1];
        rotBuf[di+2] = buf[si+2];
        rotBuf[di+3] = buf[si+3];
      }
      // Else: out of bounds → stays transparent (alpha=0 from Uint8ClampedArray init)
    }
  }

  // Step 3: 8× downsample → nearest-neighbor back to original size
  // Simple nearest-neighbor (pick center sample of each 8×8 block)
  const out = new Uint8ClampedArray(w * h * 4);
  for (let oy = 0; oy < h; oy++) {
    for (let ox = 0; ox < w; ox++) {
      const sx = ox * 8 + 4;  // center of 8×8 block
      const sy = oy * 8 + 4;
      const si = (sy * bw + sx) * 4;
      const di = (oy * w + ox) * 4;
      out[di]   = rotBuf[si];
      out[di+1] = rotBuf[si+1];
      out[di+2] = rotBuf[si+2];
      out[di+3] = rotBuf[si+3];
    }
  }
  return out;
}
```

### Pattern 8: Distance Annotation Overlay

**What:** A `position:fixed` CSS div that follows the float content's position, showing pixel distances to canvas edges.

```javascript
// Source: CONTEXT.md "距离显示" decision
// HTML element (added to body):
// <div id="transform-distance-label" style="position:fixed; display:none; ..."></div>

function updateDistanceLabel() {
  const ts = EditorState.transformState;
  if (!ts) return;
  const pixRect = pixelCanvas.getBoundingClientRect();
  const ps = pixRect.width / EditorState.width;  // CSS px per canvas pixel

  const left   = ts.floatX;                            // px from left edge
  const top    = ts.floatY;                            // px from top edge
  const right  = EditorState.width  - (ts.floatX + ts.floatW);   // px from right edge
  const bottom = EditorState.height - (ts.floatY + ts.floatH);   // px from bottom edge

  const label = document.getElementById('transform-distance-label');
  if (!label) return;
  label.textContent = `←${left} ↑${top} →${right} ↓${bottom}`;

  // Position: just below the float bounding box in screen space
  const screenX = pixRect.left + ts.floatX * ps;
  const screenY = pixRect.top  + (ts.floatY + ts.floatH) * ps + 4;
  label.style.left = screenX + 'px';
  label.style.top  = screenY + 'px';
  label.style.display = 'block';
}
```

### Pattern 9: Apply and Cancel

```javascript
function applyTransform() {
  const ts = EditorState.transformState;
  if (!ts) return;
  pushHistory();  // one undo step for the entire compound transform

  // Composite float pixels onto EditorState.pixels (clip to canvas bounds)
  const W = EditorState.width, H = EditorState.height;
  for (let fy = 0; fy < ts.floatH; fy++) {
    for (let fx = 0; fx < ts.floatW; fx++) {
      const cx = ts.floatX + fx;
      const cy = ts.floatY + fy;
      if (cx < 0 || cx >= W || cy < 0 || cy >= H) continue;  // clip overflow
      const si = (fy * ts.floatW + fx) * 4;
      if (ts.floatPixels[si+3] === 0) continue;  // transparent float pixel → skip
      setPixel(cx, cy, [
        ts.floatPixels[si], ts.floatPixels[si+1],
        ts.floatPixels[si+2], ts.floatPixels[si+3]
      ]);
    }
  }
  flushPixels();
  EditorState.transformState = null;
  clearSelection();     // auto-deselect after apply
  hideTransformTopBar();
  hideDistanceLabel();
}

function cancelTransform() {
  const ts = EditorState.transformState;
  if (!ts) return;
  // Restore original pixels (no history push)
  EditorState.pixels = ts.originalPixels;
  flushPixels();
  EditorState.transformState = null;
  clearSelection();
  hideTransformTopBar();
  hideDistanceLabel();
}
```

### Pattern 10: Top Bar Panel for Transform Mode

Following the existing show/hide pattern for `#tool-settings-{name}` panels:

```html
<!-- Added to #top-bar, hidden by default -->
<div id="tool-settings-move" style="display:none; align-items:center; gap:8px;">
  <label style="font-size:12px; color:var(--text-muted);">X%</label>
  <input id="opt-scale-x" type="number" min="1" max="1600" value="100" style="width:56px;">
  <label style="font-size:12px; color:var(--text-muted);">Y%</label>
  <input id="opt-scale-y" type="number" min="1" max="1600" value="100" style="width:56px;">
  <label style="font-size:12px; color:var(--text-muted); display:flex; align-items:center; gap:4px; cursor:pointer;">
    <input id="opt-scale-lock" type="checkbox" checked>Lock
  </label>
  <label style="font-size:12px; color:var(--text-muted);">Angle°</label>
  <input id="opt-rotate-angle" type="number" min="-180" max="180" value="0" style="width:56px;">
  <button class="btn btn-primary" id="btn-apply-transform" style="padding:4px 10px; font-size:12px;">Apply ✓</button>
  <button class="btn btn-ghost"   id="btn-cancel-transform" style="padding:4px 10px; font-size:12px;">Cancel ✕</button>
</div>
```

**Note:** This panel is shown when Move(V) is active AND `EditorState.transformState` is non-null. It is hidden in all other states. The existing Deselect/Inverse buttons remain independent.

### Anti-Patterns to Avoid

- **Writing to EditorState.pixels during drag:** All intermediate states render to selCanvas only. `EditorState.pixels` is only modified on Apply or Cancel.
- **Reading from canvas for float pixels:** Float content sourced from `EditorState.pixels` at activation time, never `getImageData()`.
- **Single-pass Scale2x for RotSprite:** Must apply scale2x THREE times (not once) to reach 8× — each pass doubles dimensions.
- **Float bounding box not tracking scaled dimensions:** After a scale operation, `floatW` and `floatH` must reflect the new scaled dimensions so handles render in the correct positions.
- **Snapshotting originalPixels after the erase:** The erase of selected pixels must happen AFTER snapshotting, not before.
- **RotSprite on selections > 128×128:** Show status message and return early — the intermediate 8× buffer would be 1024×1024×4×4 bytes ≈ 16 MB for a greyscale path, safe only up to the limit.
- **Scale2x alpha equality bug:** `colorEq` must treat two fully-transparent pixels as equal regardless of RGB, AND treat transparent vs. opaque as unequal (CLAUDE.md rule — included in Pattern 6 above).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RotSprite 8× upscale | Custom pixel-art upscaler | Scale2x (pure JS, ~30 lines) | Scale2x is the standard algorithm; exact pseudocode is verified and public |
| Nearest-neighbor scale | Canvas `drawImage` with smoothing disabled | Manual Uint8ClampedArray loop | `drawImage` on a canvas reads back pixels with premultiplied alpha — corrupts transparent pixels; must stay in EditorState.pixels space |
| Handle coordinate math | CSS transform-based handles | selCanvas + BoundingClientRect formula | Phase 5.1 already established the correct pattern; CSS transform handles would need separate coordinate space |
| Float content rendering | drawImage to pixel-canvas | selCanvas putImageData in CSS space | Writing float to pixel-canvas mid-drag is a write to EditorState.pixels — violates pending-state rule |

**Key insight:** Nearest-neighbor resampling MUST be done in the Uint8ClampedArray domain (EditorState.pixels style), never via canvas drawImage, because canvas drawImage always applies premultiplied alpha compositing which corrupts semi-transparent and fully-transparent pixels.

---

## Common Pitfalls

### Pitfall 1: originalPixels snapshot timing
**What goes wrong:** ESC restores a state that already has the selection erased, so content is lost.
**Why it happens:** `originalPixels = EditorState.pixels.slice()` called AFTER `setPixel(x,y,[0,0,0,0])` loop.
**How to avoid:** Always snapshot `originalPixels` as the very first operation in `activateTransform()`, before any pixel writes.
**Warning signs:** ESC leaves blank area where selection was.

### Pitfall 2: Float position in canvas vs. screen coordinates
**What goes wrong:** Float content appears at wrong screen position; handles are misaligned with float.
**Why it happens:** `floatX/floatY` are canvas pixel coordinates, but selCanvas drawing uses CSS screen coordinates — they must be converted via `ps = pixRect.width / EditorState.width`.
**How to avoid:** Always use `originX + floatX * ps` for selCanvas drawing; never draw float position directly.
**Warning signs:** Handles appear at correct screen position but float preview is offset, or vice versa.

### Pitfall 3: Scale2x applied only once for RotSprite
**What goes wrong:** RotSprite output has jagged edges because 2× upscale is insufficient for the rotation interpolation to work correctly.
**Why it happens:** XFM-02 requires 8× (= 2^3 = three Scale2x passes), not 2× or 4×.
**How to avoid:** Loop `scale2x()` three times, verifying `bw === w * 8` before the rotate step.
**Warning signs:** Rotated content looks like plain nearest-neighbor rotation with no improvement over non-RotSprite.

### Pitfall 4: selCanvas not cleared before redraw during drag
**What goes wrong:** Ghost handles/previews accumulate on selCanvas during dragging.
**Why it happens:** `drawTransformHandles()` and float preview rendering forget to call `selCtx.clearRect(...)` first.
**How to avoid:** Always `selCtx.clearRect(0, 0, selCanvas.width / dpr, selCanvas.height / dpr)` at the top of any selCanvas redraw function.
**Warning signs:** Multiple overlapping handle squares visible during drag.

### Pitfall 5: Scale percentage inputs triggering RotSprite on every keystroke
**What goes wrong:** User types "1" in angle input (intending "15°"), RotSprite runs immediately on a 1° rotation — wasteful and potentially slow.
**Why it happens:** Binding RotSprite to `input` event on angle field.
**How to avoid:** Bind angle input to `change` event or debounce with 300ms; alternatively, only compute RotSprite on Enter/blur. Scale % inputs should similarly debounce or only apply on Enter/blur.
**Warning signs:** Visible delay/jank when typing in the angle input.

### Pitfall 6: Handle hit radius too small at low zoom
**What goes wrong:** User cannot click handles at zoom < 1× because hit zone is only 8×8 CSS pixels but handle visual is also 8px — any slight miss fails.
**Why it happens:** Hit zone radius exactly matches visual size; no tolerance.
**How to avoid:** Use a HALF=6 hit radius (12px total) vs. 8px visual (Pattern 4 above). This ensures ~2px tolerance around each handle.
**Warning signs:** Hard to click handles at zoom 1× or below.

### Pitfall 7: Move tool cursor leaves canvas during drag
**What goes wrong:** `pointerup` fires outside canvas, drag not finalized, float stuck in pending state.
**Why it happens:** Pointer events not captured.
**How to avoid:** `cursorCanvas.setPointerCapture(e.pointerId)` in pointerdown (already done in existing tool dispatch) ensures pointerup fires even outside canvas bounds.
**Warning signs:** Releasing mouse button outside canvas leaves float floating.

### Pitfall 8: Composite transform ordering (scale then rotate vs. rotate then scale)
**What goes wrong:** If user scales AND rotates, the order matters for correct output.
**Why it happens:** No defined operation order.
**How to avoid:** Always apply in this order: (1) extract original selectionPixels, (2) scale to current scaleX/scaleY dimensions, (3) apply RotSprite rotation. This matches Aseprite's transform behavior (scale first, then rotate).
**Warning signs:** Rotated content appears to have wrong bounding box after scale.

---

## Code Examples

### Complete colorEq (alpha-aware, required by CLAUDE.md)

```javascript
// Source: CLAUDE.md "Scale2x color equality (must include alpha)"
function colorEq(pixels, i1, i2) {
  if (pixels[i1+3] === 0 && pixels[i2+3] === 0) return true;   // both transparent
  if (pixels[i1+3] === 0 || pixels[i2+3] === 0) return false;  // one transparent
  return pixels[i1]   === pixels[i2]   &&
         pixels[i1+1] === pixels[i2+1] &&
         pixels[i1+2] === pixels[i2+2] &&
         pixels[i1+3] === pixels[i2+3];
}
```

### Rendering float preview to selCanvas

Float content is rendered onto selCanvas using `putImageData` + DPR scaling — but since selCtx has `scale(dpr, dpr)` applied, we can use `drawImage` from an offscreen canvas approach. However, to avoid premultiplied alpha issues, render the float as filled rectangles pixel-by-pixel at the selCtx logical coordinate scale, OR use an offscreen canvas:

```javascript
function renderFloatPreview() {
  const ts = EditorState.transformState;
  if (!ts) return;
  const caRect  = document.getElementById('canvas-area').getBoundingClientRect();
  const pixRect = pixelCanvas.getBoundingClientRect();
  const originX = pixRect.left - caRect.left;
  const originY = pixRect.top  - caRect.top;
  const ps      = pixRect.width / EditorState.width;

  // Draw float content pixel by pixel (correct for all zoom levels)
  for (let fy = 0; fy < ts.floatH; fy++) {
    for (let fx = 0; fx < ts.floatW; fx++) {
      const si = (fy * ts.floatW + fx) * 4;
      const a = ts.floatPixels[si + 3];
      if (a === 0) continue;
      const r = ts.floatPixels[si], g = ts.floatPixels[si+1], b = ts.floatPixels[si+2];
      const screenX = originX + (ts.floatX + fx) * ps;
      const screenY = originY + (ts.floatY + fy) * ps;
      selCtx.fillStyle = `rgba(${r},${g},${b},${a/255})`;
      selCtx.fillRect(screenX, screenY, ps, ps);
    }
  }
}
```

**Note on performance:** For float content > ~64×64 pixels, pixel-by-pixel fillRect will be slow (>4000 calls). Alternative: use an offscreen canvas + `drawImage` with `imageSmoothingEnabled = false`. Since float pixels come from `EditorState.pixels` and not from canvas readback, this is safe:

```javascript
// Faster approach for large float content
function renderFloatPreviewFast() {
  const ts = EditorState.transformState;
  if (!ts) return;
  const caRect  = document.getElementById('canvas-area').getBoundingClientRect();
  const pixRect = pixelCanvas.getBoundingClientRect();
  const originX = pixRect.left - caRect.left;
  const originY = pixRect.top  - caRect.top;
  const ps      = pixRect.width / EditorState.width;

  // Create offscreen canvas from float pixels (safe — no canvas readback)
  const off = document.createElement('canvas');
  off.width = ts.floatW; off.height = ts.floatH;
  const offCtx = off.getContext('2d');
  offCtx.putImageData(new ImageData(ts.floatPixels.slice(), ts.floatW, ts.floatH), 0, 0);

  // Draw to selCtx at screen scale (imageSmoothingEnabled = false for pixel-perfect)
  selCtx.imageSmoothingEnabled = false;
  selCtx.drawImage(off,
    originX + ts.floatX * ps,
    originY + ts.floatY * ps,
    ts.floatW * ps,
    ts.floatH * ps
  );
}
```

**Warning:** The fast approach writes float pixels via drawImage which internally premultiplies alpha. For display purposes this is acceptable (pixels are only being shown, not read back). For the actual `applyTransform()` write, always use the Uint8ClampedArray loop (Pattern 9).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Recursive flood fill | Iterative BFS with visited bitmap | Phase 3 | Already in codebase; same pattern applies to Scale2x loops |
| Marching ants on zoom-container | selCanvas outside zoom-container | Phase 5.1 / Quick 10-11 | Handle drawing uses same fixed screen-space coordinate system |
| canvas.getImageData for pixel reads | EditorState.pixels direct access | Phase 1 | Critical — all transform operations must stay in EditorState.pixels space |

---

## Open Questions

1. **Float preview rendering performance for large selections**
   - What we know: pixel-by-pixel fillRect is O(w×h) selCtx calls; 128×128 = 16,384 calls per frame during drag
   - What's unclear: Whether 16K fillRect calls per RAF frame causes visible jank on a typical laptop
   - Recommendation: Implement with fast offscreen-canvas path (renderFloatPreviewFast) from the start; pixel-by-pixel path as fallback. Monitor with browser profiler if lag is observed.

2. **RotSprite downsample strategy: center-sample vs. average**
   - What we know: Aseprite uses nearest-neighbor (center sample) for the 1/8 downsample; Wikipedia confirms this
   - What's unclear: Whether center-sample (pixel at position `ox*8+4, oy*8+4`) or mode-sample (most frequent color in 8×8 block) produces better results
   - Recommendation: Use center-sample (Pattern 7) as it matches Aseprite behavior exactly (XFM-02 requirement)

3. **Angle input UX: live preview vs. commit-on-Enter**
   - What we know: "实时预览，输入即渲染到 selCanvas" — CONTEXT.md mandates live preview
   - What's unclear: Whether live preview means on every keypress or on blur/change
   - Recommendation: Use `input` event with 200ms debounce; bind RotSprite execution to the debounced handler. This gives live preview without lag on each keystroke.

---

## Validation Architecture

> `workflow.nyquist_validation` is not present in config.json — section skipped.

---

## Sources

### Primary (HIGH confidence)
- scale2x.it/algorithm — Scale2x pseudocode (E0/E1/E2/E3 computation from 3×3 neighborhood)
- CLAUDE.md project instructions — colorEq alpha rule, EditorState.pixels constraint, RotSprite 128×128 limit, selCanvas coordinate formula
- 06-CONTEXT.md — All locked user decisions for this phase

### Secondary (MEDIUM confidence)
- [rotsprite-webgl (GitHub/adnanlah)](https://github.com/adnanlah/rotsprite-webgl) — confirmed 8× upscale via Scale2x variant, simultaneous rotate+downsample approach
- [Wikipedia: Pixel-art scaling algorithms](https://en.wikipedia.org/wiki/Pixel-art_scaling_algorithms) — RotSprite algorithm description, Scale2x basis
- [Aseprite rotsprite.cpp (GitHub)](https://github.com/aseprite/aseprite/blob/main/src/doc/algorithm/rotsprite.cpp) — reference implementation (C++, not read directly but cross-confirmed by secondary sources)

### Tertiary (LOW confidence)
- WebSearch results on Fast RotSprite 3× variant — referenced but not used (project requires 8× per XFM-02)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no external libraries, all browser-native APIs already in use
- Architecture: HIGH — patterns follow directly from established Phase 5.1 selCanvas architecture
- RotSprite algorithm: HIGH — Scale2x pseudocode verified from official source; algorithm steps confirmed by multiple references
- Pitfalls: HIGH — most derived from project-specific CLAUDE.md rules and existing code analysis

**Research date:** 2026-03-04
**Valid until:** 2026-06-04 (stable algorithms, no external dependencies)
