# Phase 1: Foundation - Research

**Researched:** 2026-03-02
**Domain:** Browser Canvas API, single-file HTML editor architecture, CSS layout
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**面板布局（Panel Layout）**
- 4 面板结构：顶部栏（top bar）| 左侧面板（palette/色卡区）| 中央画布区 | 右侧工具栏
- **左侧**：调色板、色卡、像素检查器（颜色相关内容）
- **右侧**：窄图标条（工具图标，Phase 3 补全；Phase 1 显示禁用占位槽）
- 注意：CLAUDE.md 中 "left bar = tools" 的描述与用户确认的布局相反，以本文件为准

**顶部栏（Top Bar）**
- Phase 1 展示完整可见的 chrome，但未实现的功能（Undo/Redo、导出等）保持**禁用状态**
- 缩放控件放在顶部栏：缩放比例数字显示 + `+` / `-` 按钮

**缩放系统（Zoom）**
- 触发方式：滚轮（兼容触控板）+ 顶部栏 +/- 按钮 + 键盘 `Ctrl+=` / `Ctrl+-`
- 范围：1x – 64x
- 缩放中心：**鼠标指针位置**（不是画布中心）
- 实现方式：CSS `transform: scale(zoom)` 作用于画布容器 div，绝不使用 `ctx.setTransform`

**画布背景与平移（Canvas Background & Pan）**
- 画布后面显示**棋盘格**（表示透明区域）
- 棋盘格颜色：`--surface`（#1a1a22）/ `--surface2`（#22222e），与整体深色主题融合
- 棋盘格尺寸：1 格 = **16 画布像素**（随缩放等比变化；zoom=4x 时显示 64 CSS px/格）
- 棋盘格实现：CSS background 或 Canvas 绘制，跟随 CSS transform 缩放
- 平移方式：**滚动条**（canvas 区域 overflow: auto）
- 画布对齐：画布小于视口时**居中显示**，四周保留固定边距（约 24px）

**像素检查器（Pixel Inspector — Phase 4 调色板脚手架）**
- 位置：左侧面板**底部固定区域**
- 显示内容：`X, Y` 坐标 + `R G B A` 数值 + **颜色预览色块**
- 更新时机：鼠标悬停在画布上时实时更新（不需要点击）
- 用途：满足 Phase 1 验收标准「点击像素返回 EditorState.pixels 的 RGBA 值」，同时作为 Phase 4 调色器展示区的占位脚手架

**占位图片（Placeholder Image）**
- 使用项目根目录的 **`output.png`**（真实像素艺术处理结果，102×102 px RGB）
- 通过 Flask `/editor` 路由服务 `editor.html`；`output.png` 由前端 JS 通过 `/api/...` 或直接 `<img>` 标签加载（规划阶段决定具体机制）
- Phase 1 不需要实现完整 sessionStorage 交接（那是 Phase 7 的工作）

### Claude's Discretion
- 左侧面板和右侧工具栏的具体宽度（参考 web_ui.html 的 300px 侧栏比例自行决定）
- 右侧工具条在 Phase 1 的具体占位图标（禁用状态即可）
- 滚动条是否使用自定义样式（建议与深色主题匹配）
- 顶部栏的具体高度和内边距

### Deferred Ideas (OUT OF SCOPE)
- sessionStorage 交接（web_ui.html → editor.html）— Phase 7
- 调色板完整功能（色卡点击、双向同步）— Phase 4
- 工具实际功能（铅笔、橡皮、油漆桶）— Phase 3
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | 编辑器为独立页面（editor.html），4 区布局：左栏 / 中央画布 / 右栏工具箱 / 顶栏参数 | CSS Grid 3-column + top bar row layout; Flask `/editor` route serving single HTML file |
| UI-02 | 左栏包含色卡限制面板（可折叠）、画布编辑器面板（可折叠）、常驻调色盘（左下角固定） | Flex column layout with overflow-y: auto for scroll area + sticky bottom section; Phase 1 delivers structural scaffold only |
| CANVAS-01 | 画布支持缩放（CSS transform），缩放时工具坐标系保持 1:1 像素精度 | CSS transform: scale() on zoom container; `getBoundingClientRect()` for coordinate conversion; no ctx.setTransform |
| CANVAS-02 | 画布以 `image-rendering: pixelated` 渲染，禁止插值模糊 | CSS `image-rendering: pixelated` on all three canvas elements; pixel-canvas sized 1:1 with image (no DPR scaling) |
</phase_requirements>

---

## Summary

Phase 1 builds the structural skeleton of `editor.html`: a 4-panel CSS layout, a 3-canvas stack for rendering, the `EditorState` pixel buffer as the single source of truth, and a zoom/pan system. All of this exists in a single self-contained HTML file (inline CSS + JS), identical in pattern to the existing `web_ui.html`.

The primary technical challenge is the canvas initialization order and DPR handling. Three rules from `CLAUDE.md` must be correct from day one or they will cascade through all subsequent phases: (1) pixel-canvas must NOT be DPR-scaled—it must be exactly `image width × image height` CSS pixels; (2) `willReadFrequently: true` must be set on the very first `getContext('2d')` call and cannot be retroactively applied; (3) all pixel reads must go through `EditorState.pixels`, never `getImageData()` on the pixel canvas (premultiplied alpha corruption).

The zoom system must use CSS `transform: scale(zoom)` on the container div, with mouse-position as the zoom center, and scrollbars (`overflow: auto`) for pan. The checkerboard background (16 canvas-pixels per cell) should be rendered via CSS `background` on the zoom container, so it scales automatically with the CSS transform. The placeholder image is `output.png` (102×102 RGB PNG), already on disk and served by a new `/editor` Flask route added to `web_app.py`.

**Primary recommendation:** Build `editor.html` as a single file following `web_ui.html` patterns exactly. Copy CSS variables verbatim. Use CSS Grid for the 4-panel layout. Initialize canvases in the exact order specified: pixel-canvas (no DPR), then overlay canvases (DPR-scaled).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS + HTML Canvas 2D | Browser-native | Pixel rendering, pointer events, state management | No build step; matches project constraint of zero npm/build tools |
| Flask (Python) | Already installed (project uses it) | Serve `editor.html` at `/editor`; serve `output.png` as placeholder | Already the project web server |
| CSS Grid + Flexbox | Browser-native | 4-panel layout | The only sane layout for fixed-panel editors in pure CSS |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS custom properties (variables) | Browser-native | Dark theme tokens copied from `web_ui.html` | Use for all colors, radii — enables theme consistency |
| Pointer Events API | Browser-native | Mouse/touch/stylus input on canvas | Replaces mouse events; supports `setPointerCapture` |
| `window.devicePixelRatio` | Browser-native | DPR scaling for overlay canvases (cursor, selection) | Apply ONLY to overlay canvases, NOT pixel-canvas |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS `transform: scale()` for zoom | `ctx.setTransform()` | BANNED: `putImageData`/`getImageData` ignore canvas transforms → coordinate mismatch |
| Scrollbars (`overflow: auto`) for pan | Custom drag-to-pan | Scroll is simpler, no Phase 1 dragging logic needed; can add drag-pan later |
| CSS `background` checkerboard | Canvas-drawn checkerboard | CSS approach auto-scales with transform; canvas approach requires redraw on every zoom |
| `fetch('/output.png')` + `createImageBitmap` | `<img>` tag | Either works; fetch gives explicit load control and ImageData access for `EditorState.pixels` |

**Installation:** No installation needed — all browser-native plus Flask already running.

---

## Architecture Patterns

### File Structure
```
perfectPixel_ver1.1/
├── web_app.py          ← Add /editor route (minimal change)
├── editor.html         ← New file: single self-contained editor (inline CSS + JS)
├── web_ui.html         ← Existing; DO NOT TOUCH
└── output.png          ← 102×102 RGB placeholder image (already exists)
```

### Internal editor.html Structure
```
editor.html
├── <style>             ← All CSS inline (dark theme vars + layout + canvas styles)
├── <body>
│   ├── #top-bar        ← Fixed height header; zoom controls + disabled placeholders
│   ├── #layout         ← CSS Grid: [left-panel] [canvas-area] [right-panel]
│   │   ├── #left-panel ← Flex column; scroll area (color card scaffold) + sticky inspector
│   │   ├── #canvas-area← overflow: auto; contains #zoom-container (CSS transform target)
│   │   │   └── #zoom-container
│   │   │       ├── #pixel-canvas     (z-index: 1, exact image size, no DPR)
│   │   │       ├── #selection-canvas (z-index: 2, DPR-scaled overlay)
│   │   │       └── #cursor-canvas    (z-index: 3, DPR-scaled, receives pointer events)
│   │   └── #right-panel← Narrow icon strip; disabled tool placeholders
└── <script>            ← All JS inline; EditorState + init + zoom + pixel inspector
```

### Pattern 1: Three-Canvas Layer Stack Initialization

**What:** Three `<canvas>` elements stacked with `position: absolute` inside a zoom container. Canvas sizes and DPR handling differ per layer.
**When to use:** Always — this is the canonical canvas setup for Phase 1 and all subsequent phases.

```javascript
// Source: CLAUDE.md "Canvas initialization rules"
function initCanvases(width, height) {
  EditorState.width = width;
  EditorState.height = height;

  // ── pixel-canvas: NO DPR. 1:1 with image coordinates. ──────────────────
  pixelCanvas.width = width;
  pixelCanvas.height = height;
  pixelCanvas.style.width  = width  + 'px';
  pixelCanvas.style.height = height + 'px';
  // MUST set willReadFrequently on FIRST getContext call (cannot be set later)
  const pixelCtx = pixelCanvas.getContext('2d', { willReadFrequently: true, alpha: true });

  // ── overlay canvases: DPR-scaled for crisp cursor/selection rendering ───
  const dpr = window.devicePixelRatio || 1;
  [selCanvas, cursorCanvas].forEach(canvas => {
    canvas.width  = width  * dpr;
    canvas.height = height * dpr;
    canvas.style.width  = width  + 'px';
    canvas.style.height = height + 'px';
  });
  const selCtx    = selCanvas.getContext('2d');
  const cursorCtx = cursorCanvas.getContext('2d');
  selCtx.scale(dpr, dpr);
  cursorCtx.scale(dpr, dpr);
}
```

### Pattern 2: Pixel-Position-Centered Zoom

**What:** CSS `transform: scale(zoom)` on the zoom container. Zoom centers on mouse pointer, not canvas center.
**When to use:** All zoom operations (wheel, +/- buttons, keyboard).

```javascript
// Source: CLAUDE.md zoom rules; Figma/Aseprite standard pattern
function applyZoom(newZoom, pivotClientX, pivotClientY) {
  const oldZoom = EditorState.zoom;
  newZoom = Math.max(1, Math.min(64, newZoom));

  // Get canvas area scroll container
  const area = document.getElementById('canvas-area');
  const rect = area.getBoundingClientRect();

  // Pivot in scroll-adjusted coordinates
  const pivotX = pivotClientX - rect.left + area.scrollLeft;
  const pivotY = pivotClientY - rect.top  + area.scrollTop;

  // After scale change, keep pivot point stationary
  area.scrollLeft = pivotX * (newZoom / oldZoom) - (pivotClientX - rect.left);
  area.scrollTop  = pivotY * (newZoom / oldZoom) - (pivotClientY - rect.top);

  EditorState.zoom = newZoom;
  document.getElementById('zoom-container').style.transform = `scale(${newZoom})`;
  document.getElementById('zoom-display').textContent = newZoom + 'x';
}

// Wheel handler (prevent default to stop page scroll)
canvasArea.addEventListener('wheel', e => {
  e.preventDefault();
  const delta = e.deltaY < 0 ? 1 : -1;
  const step = EditorState.zoom < 4 ? 1 : EditorState.zoom < 16 ? 2 : 4;
  applyZoom(EditorState.zoom + delta * step, e.clientX, e.clientY);
}, { passive: false });
```

### Pattern 3: Coordinate Conversion (Viewport → Canvas Pixels)

**What:** Convert browser pointer event coordinates to canvas pixel coordinates, accounting for CSS zoom and scroll.
**When to use:** Every pointer event handler on cursor-canvas.

```javascript
// Source: CLAUDE.md "Coordinate conversion" section
function viewportToCanvas(clientX, clientY) {
  const rect = cursorCanvas.getBoundingClientRect();
  // rect already reflects CSS transform scale in modern browsers
  const scaleX = EditorState.width  / rect.width;
  const scaleY = EditorState.height / rect.height;
  return [
    Math.max(0, Math.min(EditorState.width  - 1, Math.floor((clientX - rect.left) * scaleX))),
    Math.max(0, Math.min(EditorState.height - 1, Math.floor((clientY - rect.top)  * scaleY))),
  ];
}
```

### Pattern 4: EditorState as Single Source of Truth

**What:** All mutable state lives in `EditorState`. DOM is write-only (rendered from state, never read back).
**When to use:** Always — no state stored in DOM attributes or global variables outside EditorState.

```javascript
// Source: CLAUDE.md "EditorState" section
const EditorState = {
  width: 0, height: 0,
  pixels: null,               // Uint8ClampedArray, RGBA, length = w*h*4
  gridW: 0, gridH: 0,
  zoom: 4, panX: 0, panY: 0,
  activeTool: 'pencil',
  foregroundColor: [0, 0, 0, 255],
  toolOptions: {
    brushSize: 1, brushShape: 'round',
    pixelPerfect: false,
    bucketTolerance: 15, wandTolerance: 15,
    contiguous: true,
  },
  selection: null,
  selectionPixels: null,
  transformState: null,
  history: [],
  historyIndex: -1,
  MAX_HISTORY: 50,
  palette: [],
};
```

### Pattern 5: Placeholder Image Loading (output.png)

**What:** Load `output.png` via `fetch`, decode to `ImageData`, store in `EditorState.pixels`, flush to pixel-canvas.
**When to use:** On page load, as the Phase 1 placeholder.

```javascript
// Source: project architecture decision; Canvas 2D API
async function loadPlaceholderImage() {
  const resp = await fetch('/output.png');
  const blob = await resp.blob();
  const bitmap = await createImageBitmap(blob);

  const { width, height } = bitmap;
  initCanvases(width, height);

  // Draw to pixel-canvas once to extract ImageData
  pixelCtx.drawImage(bitmap, 0, 0);
  const imageData = pixelCtx.getImageData(0, 0, width, height);
  EditorState.pixels = imageData.data.slice(); // Uint8ClampedArray copy

  // Flush from EditorState (canonical path used by all subsequent ops)
  flushPixels();
}

function flushPixels() {
  pixelCtx.putImageData(
    new ImageData(EditorState.pixels, EditorState.width, EditorState.height),
    0, 0
  );
}
```

**Note:** The one-time `getImageData` call during initial load is acceptable — we need the raw bytes. After this point, all reads use `EditorState.pixels` exclusively.

### Pattern 6: Checkerboard Background (CSS, scales with zoom)

**What:** CSS `background` property on the zoom container div creates a repeating checkerboard that scales automatically when `transform: scale()` is applied to its parent.
**When to use:** Always — avoids canvas redraw on every zoom change.

```css
/* Source: web_ui.html pattern adapted for editor; 16px = 1 canvas pixel at 1x zoom */
#zoom-outer {
  /* Padding so canvas has breathing room when smaller than viewport */
  padding: 24px;
  min-width: 100%;
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

#zoom-container {
  position: relative;   /* anchor for absolutely-positioned canvases */
  transform-origin: top left;  /* required for pointer-centered zoom math */
}

/* Checkerboard on the scroll area background (outside transform) */
#canvas-area {
  overflow: auto;
  background-color: var(--bg);
  background-image:
    linear-gradient(45deg, var(--surface) 25%, transparent 25%),
    linear-gradient(-45deg, var(--surface) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--surface) 75%),
    linear-gradient(-45deg, transparent 75%, var(--surface) 75%);
  background-size: 32px 32px;  /* fixed CSS px — does NOT scale with zoom */
  background-position: 0 0, 0 16px, 16px -16px, -16px 0px;
}
```

**Important:** Placing the checkerboard on `#canvas-area` (the scroll container, outside the transform) means the cell size stays constant in CSS pixels regardless of zoom. This is intentional — it's the same behavior as Aseprite and Photoshop. If the requirement is that cells should scale with zoom (16 canvas-pixels per cell that grow visually), apply the checkerboard to `#zoom-container` instead at the base size.

Per CONTEXT.md: "棋盘格尺寸：1 格 = 16 画布像素（随缩放等比变化）" — this means the checkerboard MUST scale with zoom. Therefore apply it to `#zoom-container` (inside the transform):

```css
/* Correct: checkerboard on zoom-container so it scales with CSS transform */
#zoom-container {
  /* background-size = 16px * 2 = 32px at zoom=1; at zoom=4 displays as 128 CSS px */
  background-color: var(--surface2);
  background-image:
    linear-gradient(45deg, var(--surface) 25%, transparent 25%),
    linear-gradient(-45deg, var(--surface) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--surface) 75%),
    linear-gradient(-45deg, transparent 75%, var(--surface) 75%);
  background-size: 32px 32px;   /* 2 × 16px cells */
  background-position: 0 0, 0 16px, 16px -16px, -16px 0px;
}
```

### Pattern 7: Pixel Inspector (hover → reads EditorState.pixels)

**What:** `pointermove` on cursor-canvas → convert to canvas coords → read from `EditorState.pixels` → update inspector DOM.
**When to use:** Left panel bottom section, always visible.

```javascript
// Source: CLAUDE.md pixel read pattern
function getPixel(x, y) {
  const i = (y * EditorState.width + x) * 4;
  return [
    EditorState.pixels[i],
    EditorState.pixels[i+1],
    EditorState.pixels[i+2],
    EditorState.pixels[i+3],
  ];
}

cursorCanvas.addEventListener('pointermove', e => {
  const [cx, cy] = viewportToCanvas(e.clientX, e.clientY);
  const [r, g, b, a] = getPixel(cx, cy);
  // Update inspector DOM (write-only)
  document.getElementById('insp-x').textContent = cx;
  document.getElementById('insp-y').textContent = cy;
  document.getElementById('insp-r').textContent = r;
  document.getElementById('insp-g').textContent = g;
  document.getElementById('insp-b').textContent = b;
  document.getElementById('insp-a').textContent = a;
  document.getElementById('insp-swatch').style.background =
    `rgba(${r},${g},${b},${a/255})`;
});
```

### Pattern 8: Flask Route Addition

**What:** Minimal addition to `web_app.py` — one new route before `if __name__ == "__main__"`.
**When to use:** Required to serve editor.html at `/editor`.

```python
# Source: CLAUDE.md "New Flask Routes (Ver 1.2)"
@app.route("/editor")
def editor():
    return send_file(os.path.join(os.path.dirname(__file__), "editor.html"))
```

Also add a route to serve `output.png` as the placeholder:

```python
@app.route("/output.png")
def output_png():
    return send_file(os.path.join(os.path.dirname(__file__), "output.png"))
```

**Note:** `output.png` is already in the project root; Flask's static file serving is not enabled by default with `send_file`, so an explicit route is the cleanest approach.

### 4-Panel CSS Layout

**What:** CSS Grid for the outer 3-column layout (left, canvas, right), with top bar above using flex column on body.
**When to use:** The foundation of the entire editor UI.

```css
/* Source: adapted from web_ui.html layout pattern */
body {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 14px;
}

#top-bar {
  flex-shrink: 0;
  height: 44px;           /* Claude's discretion: ~44px matches Aseprite/Figma */
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

#layout {
  flex: 1;
  display: grid;
  grid-template-columns: 280px 1fr 48px;  /* Claude's discretion: 280px left, 48px right icon strip */
  min-height: 0;
  overflow: hidden;
}

#left-panel {
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;      /* children manage their own scroll */
}

#left-scroll {           /* scrollable area above inspector */
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
#left-scroll > * { flex-shrink: 0; }  /* prevent flex squeeze */

#pixel-inspector {       /* sticky bottom — never scrolls away */
  flex-shrink: 0;
  border-top: 1px solid var(--border);
  padding: 10px 12px;
  background: var(--surface);
}

#canvas-area {
  overflow: auto;
  position: relative;
}

#right-panel {
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  gap: 4px;
  background: var(--surface);
}

/* All three canvas elements: pixel rendering must not blur */
canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;  /* Firefox compat */
  display: block;
}

/* Stacked canvas positioning */
#pixel-canvas, #selection-canvas, #cursor-canvas {
  position: absolute;
  top: 0;
  left: 0;
}
#pixel-canvas     { z-index: 1; }
#selection-canvas { z-index: 2; }
#cursor-canvas    { z-index: 3; cursor: crosshair; }
```

### Anti-Patterns to Avoid

- **DPR scaling pixel-canvas:** Never apply `window.devicePixelRatio` to `pixel-canvas`. Its `.width`/`.height` must equal the image dimensions exactly. DPR on pixel-canvas causes all tool coordinate math to be off by `dpr` factor (typically 2x on Retina).
- **`ctx.setTransform` for zoom:** `putImageData` and `getImageData` ignore canvas transforms. Using `ctx.setTransform` for zoom makes coordinate conversion code wrong in a way that is hard to debug.
- **`getImageData` in tool logic:** After initial image load, never call `getImageData` on pixel-canvas in tool handlers. Always read `EditorState.pixels`. `getImageData` on a canvas with transparent pixels suffers from premultiplied alpha corruption.
- **Setting `willReadFrequently` after first `getContext`:** The hint must be in the very first call. A second `getContext('2d', { willReadFrequently: true })` on an already-initialized canvas is silently ignored by browsers.
- **`transform-origin` not set on zoom container:** Without `transform-origin: top left` (or the equivalent), pointer-centered zoom math requires additional correction for the default `50% 50%` transform origin.
- **Keyboard shortcuts in text inputs:** Always guard `document.keydown` handlers with `if (e.target.matches('input, textarea')) return;`

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dark theme color tokens | Custom color system | Copy `:root` CSS vars from `web_ui.html` verbatim | Already defined, tested, used in production |
| Scrollbar styling | Custom scrollbar component | CSS `::-webkit-scrollbar` pseudo-elements (same pattern as web_ui.html if it has them; otherwise skip) | Browser scrollbars work fine; style is Claude's discretion |
| Image format decoding | Manual PNG parser | `fetch` + `createImageBitmap` or `new Image()` + canvas drawImage | Browser handles all formats natively |
| Zoom math | Custom zoom library | Native CSS transform + scroll position math (Pattern 2 above) | Sufficient for this use case; no library needed |

**Key insight:** This phase is 100% browser-native. No npm, no libraries, no build step. The hard part is getting initialization order right, not finding libraries.

---

## Common Pitfalls

### Pitfall 1: willReadFrequently Set Too Late
**What goes wrong:** `getPixel()` calls are slow (50-100ms per frame) on large canvases, causing pixel inspector lag.
**Why it happens:** Browser allocates GPU-backed canvas texture on first draw. Setting `willReadFrequently` after first draw has no effect — the hint was already processed.
**How to avoid:** Set `willReadFrequently: true` in the very first `getContext('2d', { willReadFrequently: true })` call, before any `drawImage` or `putImageData`.
**Warning signs:** Pixel inspector visibly lags behind mouse movement even at small canvas sizes.

### Pitfall 2: DPR Applied to Pixel-Canvas
**What goes wrong:** Coordinate conversion is off by 2x on Retina displays. Clicking pixel (10, 10) reports (20, 20) or vice versa.
**Why it happens:** Overlay canvases need DPR scaling for crisp rendering. Developers apply it to all three canvases by copy-paste.
**How to avoid:** DPR logic only in overlay canvas init. Pixel-canvas width/height = image dimensions. Full stop.
**Warning signs:** Pixel inspector shows wrong coordinates on MacBook/high-DPI display.

### Pitfall 3: Premultiplied Alpha on Initial Load
**What goes wrong:** Loading a PNG with transparency into canvas and calling `getImageData` returns corrupted alpha values (e.g., a 50% transparent red pixel `rgba(255,0,0,128)` becomes `rgba(128,0,0,128)`).
**Why it happens:** Browsers store canvas pixels in premultiplied alpha internally. `getImageData` unpremultiplies, but precision loss occurs for low-alpha pixels.
**How to avoid:** `output.png` is RGB (no alpha channel) — this pitfall does not apply to Phase 1's placeholder. But the architecture must be correct for future RGBA images. The `EditorState.pixels` must be populated from a fresh `Uint8ClampedArray`, not from repeated `getImageData` round-trips.
**Warning signs:** Pixel colors near transparent edges appear slightly off when checked through inspector.

### Pitfall 4: Zoom Container Transform-Origin Mismatch
**What goes wrong:** Zooming in with mouse at position (x, y) causes canvas to jump/shift rather than staying stationary under the cursor.
**Why it happens:** CSS `transform` default origin is `center center (50% 50%)`. The scroll-based zoom math assumes `top left (0 0)`.
**How to avoid:** Set `transform-origin: top left` on `#zoom-container`. This makes the transform expand rightward/downward from the top-left corner, matching the scroll coordinate system.
**Warning signs:** First zoom-in on a loaded image causes a visible jump.

### Pitfall 5: Canvas area doesn't scroll when canvas is smaller than viewport
**What goes wrong:** At low zoom levels, canvas is smaller than `#canvas-area`. Centering is lost; canvas sticks to top-left.
**Why it happens:** `overflow: auto` scrollbars only appear when content overflows. When content is smaller, no scroll and no centering.
**How to avoid:** Wrap zoom-container in a `#zoom-outer` div that has `min-width: 100%; min-height: 100%; display: flex; align-items: center; justify-content: center`. The scroll container overflows on the outer div, centering works when small, scrolls when large.
**Warning signs:** At zoom=1, 102×102 canvas sticks to top-left corner of the canvas area.

### Pitfall 6: Wheel Event Page Scroll
**What goes wrong:** Scrolling the mouse wheel over the canvas scrolls the entire page instead of zooming.
**Why it happens:** Default wheel event behavior bubbles and scrolls the nearest scrollable ancestor.
**How to avoid:** `e.preventDefault()` in the wheel listener. Must use `{ passive: false }` in `addEventListener` options, otherwise `preventDefault()` is ignored in passive listeners.
**Warning signs:** Page scrolls when hovering canvas and scrolling.

---

## Code Examples

Verified patterns from project sources:

### CSS Variables (copy verbatim from web_ui.html)
```css
/* Source: web_ui.html :root block, lines 10-23 */
:root {
  --bg: #0f0f13;
  --surface: #1a1a22;
  --surface2: #22222e;
  --border: #2e2e3e;
  --accent: #7c6af7;
  --accent-hover: #9080ff;
  --text: #e8e6f0;
  --text-muted: #7a7890;
  --success: #4ade80;
  --error: #f87171;
  --warning: #fbbf24;
  --radius: 10px;
}
```

### Button Styles (reuse from web_ui.html)
```css
/* Source: web_ui.html lines 95-106 */
.btn {
  padding: 8px 12px; border-radius: 7px; border: none; font-size: 13px;
  font-weight: 600; cursor: pointer; transition: background .2s, opacity .2s; white-space: nowrap;
}
.btn:disabled { opacity: .4; cursor: not-allowed; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.btn-secondary { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }
.btn-secondary:hover:not(:disabled) { border-color: var(--accent); }
.btn-ghost { background: transparent; color: var(--text-muted); border: 1px solid var(--border); padding: 5px 9px; font-size: 12px; }
.btn-ghost:hover { color: var(--text); border-color: var(--accent); }
```

### Tool Placeholder (right panel)
```html
<!-- Phase 1: disabled tool slots with Unicode icons -->
<button class="tool-btn" disabled title="Marquee (M)">&#9645;</button>
<button class="tool-btn" disabled title="Wand (W)">&#10022;</button>
<div class="tool-sep"></div>
<button class="tool-btn" disabled title="Move (V)">&#10021;</button>
<div class="tool-sep"></div>
<button class="tool-btn" disabled title="Pencil (B)">&#9998;</button>
<button class="tool-btn" disabled title="Bucket (G)">&#9776;</button>
<div class="tool-sep"></div>
<button class="tool-btn" disabled title="Eraser (E)">&#9633;</button>
```

### Top Bar Chrome (full but disabled)
```html
<header id="top-bar">
  <span id="editor-title" style="font-weight:700; font-size:15px;">PerfectPixel Editor</span>
  <span style="flex:1"></span>
  <!-- Zoom controls (ACTIVE in Phase 1) -->
  <button class="btn btn-ghost" id="btn-zoom-out" title="Zoom out (Ctrl+-)">−</button>
  <span id="zoom-display" style="font-size:13px; min-width:36px; text-align:center; font-variant-numeric:tabular-nums;">4x</span>
  <button class="btn btn-ghost" id="btn-zoom-in"  title="Zoom in (Ctrl+=)">+</button>
  <!-- Disabled placeholders -->
  <button class="btn btn-ghost" disabled title="Undo (Cmd+Z)">↩ Undo</button>
  <button class="btn btn-ghost" disabled title="Redo (Shift+Cmd+Z)">↪ Redo</button>
</header>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mouse events (`mousedown/move/up`) | Pointer Events API (`pointerdown/move/up`) | ~2018, now standard | Handles touch/stylus; `setPointerCapture` prevents losing drag outside canvas |
| `ctx.setTransform` for zoom | CSS `transform: scale()` | Ongoing best practice | `putImageData`/`getImageData` ignore canvas transform — CSS is the only correct approach |
| `getImageData` for pixel reads in tools | Read from `EditorState.pixels` (Uint8ClampedArray) | Premultiplied alpha is a known browser spec behavior | Eliminates alpha corruption in any pixel operation |
| `image-rendering: optimizeSpeed` | `image-rendering: pixelated` | CSS Images Level 4 (widely supported ~2020) | Standard property; `optimizeSpeed` is deprecated |

**Deprecated/outdated:**
- `image-rendering: optimizeSpeed` and `image-rendering: -webkit-optimize-contrast`: Use `pixelated` instead
- `ctx.imageSmoothingEnabled = false`: Still works but only affects `drawImage`, not how `putImageData` renders; `image-rendering: pixelated` on the canvas element is the correct approach

---

## Open Questions

1. **output.png serving: dedicated route vs Flask static folder?**
   - What we know: `web_app.py` uses explicit `send_file` for all routes; no `static_folder` configured
   - What's unclear: Could add Flask `static_folder='.'` to serve root-level files, but this would expose all project files
   - Recommendation: Use explicit `@app.route("/output.png")` route — consistent with existing pattern, no security exposure

2. **Left panel Phase 1 content: what goes in the scrollable area?**
   - What we know: CONTEXT.md says "色卡限制界面 (collapsible/scrollable)" is the full content, but Phase 4 delivers that
   - What's unclear: Should Phase 1 show an empty scrollable area, or a placeholder card?
   - Recommendation: Show a single collapsed placeholder card labeled "色卡限制" with `[Phase 4]` subtitle, and a second placeholder for "画布设置". This preserves the visual layout without false functionality.

3. **Initial zoom level: what's the right default for a 102×102 image?**
   - What we know: EditorState.zoom defaults to 4 (from CLAUDE.md). At 4x, 102×102 canvas = 408×408 CSS px — fits most viewports
   - What's unclear: Should the editor auto-fit zoom to canvas area size on load?
   - Recommendation: Default to zoom=4, which CLAUDE.md specifies. Auto-fit is a later enhancement.

---

## Sources

### Primary (HIGH confidence)
- `CLAUDE.md` (project instructions) — Canvas initialization rules, EditorState structure, all canvas patterns, coordinate conversion, CSS zoom rules, checkerboard spec, premultiplied alpha warning
- `web_ui.html` (existing code) — CSS variables (lines 10-23), button styles (lines 95-106), layout patterns, dark theme
- `web_app.py` (existing code) — Flask route patterns, `send_file` usage, port 5010
- `.planning/phases/01-foundation/01-CONTEXT.md` — All user decisions (layout, zoom, checkerboard, inspector, placeholder)
- `.planning/REQUIREMENTS.md` — UI-01, UI-02, CANVAS-01, CANVAS-02 requirement text

### Secondary (MEDIUM confidence)
- MDN Web Docs (Canvas 2D context `willReadFrequently` hint) — verified behavior: hint is a hint to browser; must be on first `getContext` call; silently ignored if set later
- MDN Web Docs (CSS `image-rendering: pixelated`) — widely supported; `crisp-edges` for Firefox compat

### Tertiary (LOW confidence)
- None — all claims in this research are supported by project documentation or well-established browser specs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — project is browser-native with zero external deps; all patterns from existing code
- Architecture: HIGH — CLAUDE.md specifies canvas setup rules verbatim; layout follows web_ui.html pattern exactly
- Pitfalls: HIGH — pitfalls documented in CLAUDE.md "Known Issues" section and STATE.md "Blockers/Concerns"; all three critical Phase 1 risks explicitly called out

**Research date:** 2026-03-02
**Valid until:** 2026-06-01 (stable browser APIs; CSS/Canvas 2D spec is not fast-moving)
