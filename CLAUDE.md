# PerfectPixel — Project Instructions

## Communication Language

**始终用简体中文与用户沟通。** All responses to the user must be in Simplified Chinese.

## What This Is

PerfectPixel is a Python tool that auto-detects pixel art grids and refines AI-generated pixel images to be perfectly aligned. Ver 1.1 added a local browser-based Web UI. **Ver 1.2 adds a full browser-based pixel art editor (`editor.html`).**

**Run it:**
```bash
pip install flask opencv-python numpy pillow
python3 web_app.py
# Open http://localhost:5010
```

---

## Architecture

```
perfectPixel_ver1.1/
├── src/perfect_pixel/          ← Core algorithm library (published to PyPI)
│   ├── __init__.py             ← Auto-selects CV2 or noCV2 backend
│   ├── perfect_pixel.py        ← OpenCV backend (fast)
│   └── perfect_pixel_noCV2.py  ← NumPy-only backend (lightweight)
├── web_app.py                  ← Flask server, port 5010
├── web_ui.html                 ← Grid-alignment UI (single-file, no build step)
├── editor.html                 ← [Ver 1.2] Pixel art editor (single-file, no build step)
└── integrations/comfyui/       ← ComfyUI node integration
```

Three layers, kept separate:
- **Library layer** (`src/`): pure algorithm, no web dependency
- **Web layer** (`web_app.py` + `web_ui.html`): Flask UI wrapping the library
- **Editor layer** (`editor.html`): browser pixel art editor, talks to Flask via fetch

---

## Critical Rules

### Library layer (DO NOT TOUCH without explicit instruction)
- `src/perfect_pixel/perfect_pixel.py`
- `src/perfect_pixel/perfect_pixel_noCV2.py`

These are the published library. Any change risks breaking grid detection behavior.

- If a bug fix is needed in one backend, **apply it to both**.
- The only public API is `get_perfect_pixel(image, ...)` — signature must not change.
- **Do not add new dependencies** to the library layer. The noCV2 backend needs only NumPy.

### Editor layer (Ver 1.2)
- `editor.html` is a **single self-contained file** — inline CSS and JS, no build step (same pattern as `web_ui.html`)
- **NEVER read pixel data from the canvas element.** Always read from `EditorState.pixels` (a `Uint8ClampedArray`). The canvas is a display surface only. Browsers use premultiplied alpha internally, which corrupts pixel values on round-trips.
- **Zoom via CSS transform only.** Apply `transform: scale(zoom)` to the canvas container div. NEVER use `ctx.setTransform` for zoom — `putImageData`/`getImageData` ignore canvas transforms, causing coordinate mismatches.
- **Push history on `pointerdown` only**, not on `pointermove`. One stroke = one undo step.
- **Flood fill must be iterative BFS** — recursive flood fill stack-overflows on areas > ~4000px.

---

## Editor Architecture (Ver 1.2)

### Layout Overview

```
┌─────────────────────────────────────────────────────┐
│ Top Bar: tool settings (Tolerance / Contiguous / ...) │ [Undo] [Redo] │
├──────────────┬──────────────────────────┬────────────┤
│  Left Panel  │        Canvas            │Right Panel │
│  ─────────── │  (pixel-canvas stack)    │ ────────── │
│  色卡限制界面 │                          │  marquee   │
│  (collapsible│  After palette apply:    │  wand      │
│  scrollable) │  canvas + diff side-by- │  ────────  │
│  ─────────── │  side, both downloadable │  move      │
│  [scrollable │                          │  ────────  │
│   area above]│                          │  pencil    │
│              │                          │  bucket    │
│  ════════════│                          │  ────────  │
│  Permanent   │                          │  eraser    │
│  Palette     │                          │            │
│  (always     │                          │            │
│  bottom-left)│                          │            │
│  色盘/取色   │                          │            │
│  hex / RGB   │                          │            │
└──────────────┴──────────────────────────┴────────────┘
```

**Layout rules:**
- **Right sidebar**: 6 tools only — Marquee (M), Wand (W), Move (V), Pencil (B), Paint Bucket (G), Eraser (E). No color picker tool here.
- **Left sidebar top area**: 色卡限制界面 (ported from web_ui.html as-is, collapsible/scrollable)
- **Left sidebar bottom-left (permanent)**: 常驻调色盘 — color wheel/picker, eyedropper, hex input, RGB inputs. Always visible, not collapsible.
- **Top bar**: context-sensitive tool settings + Undo (Cmd+Z) and Redo (Shift+Cmd+Z) pinned to top-right
- **Center**: canvas + optional side-by-side diff after palette apply; download buttons (precise / N× scaled) below each

**Eyedropper (取色) belongs in the permanent palette panel, NOT in the right tool sidebar.**

**Color card ↔ palette sync (Phase 4):**
- Clicking a swatch in 色卡限制界面 → auto-syncs that color to 常驻调色盘 (sets as foreground color)
- When eyedropper/picker lands on a color that matches a swatch → highlight that swatch with a selection border

---

### Three-Canvas Layer Stack

Three `<canvas>` elements stacked with `position: absolute` inside a zoom container div:

```
cursor-canvas    (z-index: 3) ← brush preview; receives all pointer events
selection-canvas (z-index: 2) ← animated marching-ants marquee + transform handles
pixel-canvas     (z-index: 1) ← canonical ImageData (the actual pixels)
```

**Canvas initialization rules (must be correct from day one):**
```javascript
// pixel-canvas: NO DPR. 1:1 with image coordinates. Zoom via CSS only.
pixelCanvas.width = EditorState.width;
pixelCanvas.height = EditorState.height;
pixelCanvas.style.width = EditorState.width + 'px';
pixelCanvas.style.height = EditorState.height + 'px';
// MUST set willReadFrequently on first getContext call (cannot be set later)
const pixelCtx = pixelCanvas.getContext('2d', { willReadFrequently: true, alpha: true });

// overlay canvases: DPR-scaled for crisp rendering
const dpr = window.devicePixelRatio || 1;
cursorCanvas.width = EditorState.width * dpr;
cursorCanvas.height = EditorState.height * dpr;
cursorCanvas.style.width = EditorState.width + 'px';
cursorCtx.scale(dpr, dpr);
// image-rendering: pixelated on all three canvases via CSS
```

### EditorState (Single Source of Truth)

All state lives here. Components read/write through `EditorState` only — never store copies.

```javascript
const EditorState = {
  width: 0, height: 0,
  pixels: null,               // Uint8ClampedArray, RGBA, length = w*h*4
  gridW: 0, gridH: 0,         // pixel art grid cell size (from Ver 1.1)
  zoom: 4, panX: 0, panY: 0,
  activeTool: 'pencil',       // 'pencil'|'eraser'|'bucket'|'wand'|'marquee'|'move'
  foregroundColor: [0,0,0,255],
  toolOptions: {
    brushSize: 1, brushShape: 'round',
    pixelPerfect: false,
    bucketTolerance: 15, wandTolerance: 15,
    contiguous: true,
  },
  selection: null,            // null | {x, y, w, h} in canvas pixels
  selectionPixels: null,      // Uint8ClampedArray for move/transform
  transformState: null,
  history: [],                // Uint8ClampedArray snapshots
  historyIndex: -1,
  MAX_HISTORY: 50,
  palette: [],                // [[r,g,b], ...] — same format as web_ui.html
};
// Minimal pub/sub (no library needed):
// EditorState.on('pixels-changed', fn) / EditorState.emit('pixels-changed')
```

### Key Patterns

**Pixel read/write (always through EditorState.pixels):**
```javascript
function getPixel(x, y) {
  const i = (y * EditorState.width + x) * 4;
  return [EditorState.pixels[i], EditorState.pixels[i+1], EditorState.pixels[i+2], EditorState.pixels[i+3]];
}
function setPixel(x, y, [r,g,b,a]) {
  const i = (y * EditorState.width + x) * 4;
  EditorState.pixels[i]=r; EditorState.pixels[i+1]=g; EditorState.pixels[i+2]=b; EditorState.pixels[i+3]=a;
}
function flushPixels() {
  pixelCtx.putImageData(new ImageData(EditorState.pixels, EditorState.width, EditorState.height), 0, 0);
}
```

**Coordinate conversion (viewport → canvas pixels):**
```javascript
function viewportToCanvas(clientX, clientY) {
  const rect = cursorCanvas.getBoundingClientRect();
  // rect already reflects CSS transform scale in modern browsers
  const scaleX = EditorState.width / rect.width;
  const scaleY = EditorState.height / rect.height;
  return [
    Math.max(0, Math.min(EditorState.width - 1,  Math.floor((clientX - rect.left) * scaleX))),
    Math.max(0, Math.min(EditorState.height - 1, Math.floor((clientY - rect.top)  * scaleY))),
  ];
}
```

**History (push once per action, not per pixel):**
```javascript
function pushHistory() {
  EditorState.history.splice(EditorState.historyIndex + 1);
  EditorState.history.push(EditorState.pixels.slice());
  if (EditorState.history.length > EditorState.MAX_HISTORY) EditorState.history.shift();
  else EditorState.historyIndex++;
}
// Push in pointerdown, NOT pointermove
```

**Flood fill (iterative BFS with visited bitmap):**
```javascript
// Mark pixel as visited BEFORE pushing to stack — prevents exponential revisits
const visited = new Uint8Array(EditorState.width * EditorState.height);
visited[startX + startY * EditorState.width] = 1;
const stack = [startX + startY * EditorState.width];
while (stack.length) { /* pop, check color, setPixel, push unvisited neighbors */ }
```

**Pointer events (use capture so pointerup fires outside canvas):**
```javascript
cursorCanvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  cursorCanvas.setPointerCapture(e.pointerId);
  // ...
});
// Guard keyboard shortcuts against text inputs:
document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea')) return;
  // handle shortcuts
});
```

**Marching ants RAF (always cancel on deselect):**
```javascript
let antsRafId = null;
function clearSelection() {
  EditorState.selection = null;
  if (antsRafId) { cancelAnimationFrame(antsRafId); antsRafId = null; }
  selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
}
```

**RotSprite size limit (prevent multi-second freeze):**
```javascript
if (sel.w * sel.h > 128 * 128) {
  showStatus('Selection too large for rotation — max 128×128px');
  return;
}
```

**Scale2x color equality (must include alpha):**
```javascript
function colorEq(a, b) {
  if (a[3] === 0 && b[3] === 0) return true;
  if (a[3] === 0 || b[3] === 0) return false;
  return a[0]===b[0] && a[1]===b[1] && a[2]===b[2] && a[3]===b[3];
}
```

**sessionStorage handoff (web_ui.html → editor.html):**
```javascript
try {
  sessionStorage.setItem('editorImage', imageB64);
  window.location.href = '/editor';
} catch (e) {
  if (e.name === 'QuotaExceededError') postImageToFlaskAndRedirect(imageB64);
}
```

### New Flask Routes (Ver 1.2)

```python
@app.route("/editor")
def editor():
    return send_file(os.path.join(os.path.dirname(__file__), "editor.html"))

# Download via client-side canvas.toBlob() is preferred for exact download;
# use Flask only if server-side scale/palette-apply is needed on save.
```

Existing routes reused as-is: `/api/apply-palette`, `/api/export-palette`, `/api/generate-palette`.

---

## Code Conventions

### Python (library + Flask)
- 4-space indentation, no tabs
- `snake_case` for functions and variables; `_` prefix for private helpers
- Short math variable names OK: `H`, `W`, `C`, `mx`, `mn`, `thr`
- Imports: stdlib → third-party → project
- HTTP status codes: `400` (bad input), `422` (validation fail), `500` (server error)
- Section headers: `# ── Palette file parsers ──────────────────────────────────────────`
- No docstrings on new helpers unless public API

### JavaScript (editor.html / web_ui.html)
- Single HTML file with inline `<style>` and `<script>` — no build tools, no npm
- All state in `EditorState` — DOM is write-only (rendered from state, never read back)
- Tool objects expose `onDown(x,y,e)`, `onMove(x,y,e)`, `onUp(x,y,e)`, `onCursor(x,y)` methods
- Pixel buffer ops: always `EditorState.pixels` — never `getImageData()` on pixel-canvas for tool logic
- Use Pointer Events API (`pointerdown/move/up`), not mouse events
- Tolerance comparisons: per-channel axis-aligned box (`abs(src.ch - target.ch) <= tolerance`), NOT Euclidean distance

---

## Known Issues — Don't Make Worse

**Ver 1.1 (library/backend):**
- `refine_grids()` has potential infinite loop on certain inputs (floating-point boundary)
- Peak detection is sensitive to magic-number thresholds — don't change defaults
- `print()` statements used instead of logging — leave as-is unless task targets logging
- File upload endpoints lack magic-byte validation — known security gap

**Ver 1.2 (editor) — watch out for:**
- Premultiplied alpha: NEVER read from canvas; always from `EditorState.pixels`
- DPR applied to wrong canvas breaks coordinate math on Retina displays
- `willReadFrequently` must be set on the FIRST `getContext('2d')` call — cannot be set retroactively
- Pushing history on `pointermove` fills entire undo stack in one stroke
- Recursive flood fill stack-overflows on any area > ~4000px
- Marching ants RAF loop keeps running after selection is cleared if not cancelled
- RotSprite on selections > 128×128 allocates ~36MB intermediate buffers and freezes the tab
- sessionStorage quota (~5MB) can be exceeded for large PNG outputs — always wrap in try-catch

---

## Web App Notes

- Flask port: **5010** (not 5000, not 5001)
- Max upload: 32 MB (`MAX_CONTENT_LENGTH`)
- All image data exchanged as base64 JSON between frontend and backend
- Both `web_ui.html` and `editor.html` are single self-contained files — inline CSS + JS, no build step
- Color/palette state in browser `localStorage`; editor pixel state in `sessionStorage` for handoff
- Dark theme CSS variables from `web_ui.html` should be copied (not reimplemented) in `editor.html`

---

## Available MCP Plugins

### Playwright — 浏览器测试与 UI 验证

用于在真实浏览器中测试 `http://localhost:5010`（先确保 Flask 已启动）。

**核心工作流：**

```
# 1. 打开页面
browser_navigate(url="http://localhost:5010")

# 2. 检查 UI 结构（推荐，比截图更适合后续操作）
browser_snapshot()

# 3. 视觉截图
browser_take_screenshot(type="png")

# 4. 点击元素（ref 来自 snapshot 的引用 ID）
browser_click(ref="...", element="按钮描述")

# 5. 输入文字
browser_type(ref="...", text="内容")

# 6. 查看控制台报错（level="error" 过滤 JS 错误）
browser_console_messages(level="error")

# 7. 查看 API 请求
browser_network_requests(includeStatic=False)

# 8. 在页面上执行 JS（调试 EditorState 等）
browser_evaluate(function="() => JSON.stringify(EditorState.activeTool)")
```

**测试 editor.html 的常用操作：**

| 目的 | 工具 |
|------|------|
| 打开编辑器页面 | `browser_navigate(url="http://localhost:5010/editor")` |
| 检查 canvas 是否渲染 | `browser_snapshot()` 确认三个 canvas 元素存在 |
| 模拟绘制（点击 canvas） | `browser_click(ref="cursor-canvas ref")` |
| 检查 JS 报错 | `browser_console_messages(level="error")` |
| 读取 EditorState | `browser_evaluate(function="() => EditorState.width + 'x' + EditorState.height")` |
| 调整窗口大小测试响应式 | `browser_resize(width=1280, height=800)` |
| 测试文件上传 | `browser_file_upload(paths=["/path/to/test.png"])` |
| 等待异步操作完成 | `browser_wait_for(text="Ready")` |
| 处理弹窗 | `browser_handle_dialog(accept=True)` |

**注意事项：**
- 优先用 `browser_snapshot()` 而非截图——快照返回可操作的 ref ID
- 测试前确认 Flask 运行在 5010 端口：`python3 web_app.py`
- `browser_evaluate` 可直接读取 `EditorState` 验证内部状态，无需 UI 操作

---

### Context7 — 库文档查询

用于查询 Flask、OpenCV、Pillow 等依赖的最新 API 文档。

```
# 步骤 1：解析库名获取 library ID
mcp__plugin_context7_context7__resolve-library-id(
  libraryName="flask",
  query="file upload route"
)

# 步骤 2：查询具体文档
mcp__plugin_context7_context7__query-docs(
  libraryId="/pallets/flask",
  query="send_file usage"
)
```

---

## Ver 1.2 Roadmap Summary

7 phases, all targeting `editor.html`. See `.planning/ROADMAP.md` for full details.

| Phase | Goal |
|-------|------|
| 1: Foundation | editor.html loads, 3-canvas setup, coordinate system, zoom |
| 2: History | pushHistory / undo / redo infrastructure |
| 3: Core Tools | Pencil (B), Eraser (E), Paint Bucket (G) |
| 4: Palette Panel ∥ | Port 色卡限制界面 + 常驻调色盘 (hex/RGB/eyedropper) from web_ui.html; swatch click → sync to palette; picked color highlights matching swatch |
| 5: Selection Tools ∥ | Rectangle Marquee (M), Magic Wand (W), marching ants |
| 6: Transform | Move (V), 8-handle scale, RotSprite rotation |
| 7: Integration | "Open in Editor" entry point, Canvas Size (S), downloads |

Phases 4 and 5 run in parallel after Phase 3. Phase 6 requires both 4 and 5.
