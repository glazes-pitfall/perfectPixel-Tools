---
phase: quick-2-fix-zoom-center-pan-bounds-sensitivity
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - editor.html
autonomous: true
requirements: []

must_haves:
  truths:
    - "缩放以视口中心（或指针位置）为中心，画布填满视口后不发生偏移"
    - "小画布（未填满视口）可以通过双指滑动平移"
    - "平移有边界：画布至少 100px 可见，不会出现全空白区域"
    - "触控板捏合灵敏度降低为原来的 1/4（factor 1.025 代替 1.1）"
    - "#zoom-outer flexbox 居中已移除，改用统一的 padding 滚动方案"
  artifacts:
    - path: "editor.html"
      provides: "修复后的 zoom/pan 系统"
      contains: "PAD=2000 滚动容器 + clampScroll + centerCanvas + 修正的 applyZoom"
---

<objective>
统一 editor.html 的缩放/平移系统。移除 #zoom-outer 的 flexbox 居中，改用大 padding 滚动容器，
修正 applyZoom 的 pivot 数学，使缩放中心始终正确；添加 clampScroll 防止滚动到纯空白区域；
降低触控板捏合灵敏度。

Purpose: 让触控板用户和鼠标用户都有符合直觉的缩放/平移体验（类似 Figma）。
</objective>

<execution_context>
@/Users/calling/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@/Users/calling/perfectPixel_ver1.1/CLAUDE.md
@/Users/calling/perfectPixel_ver1.1/editor.html

<!-- 当前关键实现位置：
  #zoom-outer CSS: 行 124-133 (flexbox centering — 需删除)
  #zoom-container CSS: 行 135-148 (transform-origin: top left — 保留)
  HTML #canvas-area 区域: 行 247-256 (zoom-outer wrapper — 需重构)
  initCanvases(): 行 319-353 (需在末尾调用 centerCanvas())
  applyZoom(): 行 400-415 (pivot 数学需修正)
  wheel handler: 行 477-499 (pan 分支需加 clampScroll; 捏合 factor 1.1→1.025)
  按钮/键盘 zoom: 行 501-522 (以视口中心为 pivot — 已正确，保留)

架构变更：
  移除: #zoom-outer (div + CSS)
  新增: #zoom-scroll-content (position:relative, 尺寸由 JS 控制)
  修改: #zoom-container → position:absolute; left:PAD px; top:PAD px
  常量: const PAD = 2000
  新函数: centerCanvas() — 设置 scroll-content 尺寸 + 居中滚动
  新函数: clampScroll(area) — 限制滚动范围
  修改: applyZoom() — 更新 scroll-content 尺寸 + 修正 pivot 公式
-->
</context>

<tasks>

<task type="auto">
  <name>Task 1: 重构 HTML + CSS — 移除 zoom-outer，建立 PAD 滚动容器</name>
  <files>editor.html</files>
  <action>
**Step A — 删除 #zoom-outer CSS 规则（行 124-133）：**

将以下内容完整删除：
```css
    /* ── Zoom outer wrapper (centers canvas when smaller than viewport) ────── */
    #zoom-outer {
      min-width: 100%;
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
    }
```

替换为 #zoom-scroll-content 的 CSS 规则：
```css
    /* ── Zoom scroll content (PAD-padded scroll space for pan + zoom) ──────── */
    #zoom-scroll-content {
      position: relative;
    }
```

**Step B — 修改 #zoom-container CSS（行 136-148 区域）：**

在 `#zoom-container` 的 CSS 中添加 `position: absolute;`（`transform-origin: top left` 已有，保留）：
```css
    #zoom-container {
      position: absolute;
      transform-origin: top left;
      /* Checkerboard ... (保持原有 background 规则不变) */
    }
```

**Step C — 修改 HTML 结构（行 247-256）：**

将：
```html
    <div id="canvas-area">
      <div id="zoom-outer">
        <div id="zoom-container">
```

替换为：
```html
    <div id="canvas-area">
      <div id="zoom-scroll-content">
        <div id="zoom-container">
```

（闭合 `</div>` 行保持不变 — 层级不变，只是替换 id）
  </action>
  <verify>在浏览器中打开 /editor，画布应出现（可能不在中心，下一步修正）</verify>
  <done>#zoom-outer 已移除，#zoom-scroll-content 替代</done>
</task>

<task type="auto">
  <name>Task 2: 修复 JS — PAD 常量 + centerCanvas + clampScroll + applyZoom 修正</name>
  <files>editor.html</files>
  <action>
**Step A — 在 applyZoom 函数前，添加 PAD 常量和两个辅助函数：**

在 `function applyZoom(...)` 定义之前（行 396-400 前），插入：

```javascript
    /**
     * PAD: virtual scroll padding (px) around canvas in scroll-content.
     * Ensures scroll headroom exists even when canvas is smaller than viewport.
     * Must match the left/top set in centerCanvas().
     */
    const PAD = 2000;

    /**
     * Clamp scroll position so canvas is never fully off-screen.
     * At least Math.min(canvas_dim * zoom, 100) px of canvas remain visible.
     */
    function clampScroll(area) {
      const zoom = EditorState.zoom;
      const W = EditorState.width  * zoom;
      const H = EditorState.height * zoom;
      const minVisible = 100; // px of canvas that must stay on screen
      const minX = PAD - area.clientWidth  + Math.min(W, minVisible);
      const maxX = PAD + W - Math.min(W, minVisible);
      const minY = PAD - area.clientHeight + Math.min(H, minVisible);
      const maxY = PAD + H - Math.min(H, minVisible);
      area.scrollLeft = Math.max(minX, Math.min(maxX, area.scrollLeft));
      area.scrollTop  = Math.max(minY, Math.min(maxY, area.scrollTop));
    }

    /**
     * Set scroll-content dimensions and center the canvas in the viewport.
     * Call after initCanvases() and after loading a new image.
     */
    function centerCanvas() {
      const area = document.getElementById('canvas-area');
      const sc   = document.getElementById('zoom-scroll-content');
      const zoom = EditorState.zoom;
      const W = EditorState.width  * zoom;
      const H = EditorState.height * zoom;
      // Scroll content must be large enough to hold canvas + PAD on all sides
      sc.style.width  = (2 * PAD + W) + 'px';
      sc.style.height = (2 * PAD + H) + 'px';
      // Position zoom-container at (PAD, PAD) in scroll-content
      const zc = document.getElementById('zoom-container');
      zc.style.left = PAD + 'px';
      zc.style.top  = PAD + 'px';
      // Center scroll: pivot = canvas center → align to viewport center
      area.scrollLeft = PAD + W / 2 - area.clientWidth  / 2;
      area.scrollTop  = PAD + H / 2 - area.clientHeight / 2;
      clampScroll(area);
    }
```

**Step B — 替换整个 applyZoom 函数（行 400-415）：**

将现有 applyZoom 完整替换为：

```javascript
    function applyZoom(newZoom, pivotClientX, pivotClientY) {
      const oldZoom = EditorState.zoom;
      newZoom = Math.max(0.25, Math.min(64, newZoom));
      const area = document.getElementById('canvas-area');
      const sc   = document.getElementById('zoom-scroll-content');
      // Update scroll-content size for new zoom (must happen BEFORE adjusting scroll)
      const newW = EditorState.width  * newZoom;
      const newH = EditorState.height * newZoom;
      sc.style.width  = (2 * PAD + newW) + 'px';
      sc.style.height = (2 * PAD + newH) + 'px';
      // Pivot in scroll-content coordinates
      const areaRect = area.getBoundingClientRect();
      const pxInArea = pivotClientX - areaRect.left;
      const pyInArea = pivotClientY - areaRect.top;
      const px = area.scrollLeft + pxInArea;  // position in scroll-content
      const py = area.scrollTop  + pyInArea;
      // Keep canvas pixel under pivot stationary:
      // canvas_x = (px - PAD) / oldZoom  →  new_scroll = canvas_x * newZoom + PAD - pxInArea
      area.scrollLeft = (px - PAD) * (newZoom / oldZoom) + PAD - pxInArea;
      area.scrollTop  = (py - PAD) * (newZoom / oldZoom) + PAD - pyInArea;
      EditorState.zoom = newZoom;
      document.getElementById('zoom-container').style.transform = `scale(${newZoom})`;
      clampScroll(area);
      const display = Number.isInteger(newZoom) ? newZoom + 'x' : newZoom.toFixed(1) + 'x';
      document.getElementById('zoom-display').textContent = display;
    }
```

**Step C — 修改 wheel 事件处理器（行 477-499 区域）：**

将捏合 factor 从 `1.1` 改为 `1.025`，并在 pan 分支末尾加 clampScroll：

```javascript
      canvasArea.addEventListener('wheel', e => {
        e.preventDefault();
        if (e.ctrlKey) {
          // Trackpad pinch — sensitivity ≈ 1/4 of previous (1.025 vs 1.1)
          const factor = e.deltaY < 0 ? 1.025 : 1 / 1.025;
          applyZoom(EditorState.zoom * factor, e.clientX, e.clientY);
          return;
        }
        // Two-finger scroll → pan
        const pixelDeltaX = e.deltaMode === 0 ? e.deltaX : e.deltaX * 20;
        const pixelDeltaY = e.deltaMode === 0 ? e.deltaY : e.deltaY * 20;
        canvasArea.scrollLeft += pixelDeltaX;
        canvasArea.scrollTop  += pixelDeltaY;
        clampScroll(canvasArea);
      }, { passive: false });
```

**Step D — 在 initCanvases() 末尾调用 centerCanvas()：**

在 `initCanvases` 函数结尾（`zc.style.height = height + 'px';` 之后）添加：
```javascript
      // Center canvas in scroll space
      centerCanvas();
```
  </action>
  <verify>
1. 打开 /editor，画布居中显示
2. 触控板双指滚动：画布平移，不超出边界（不出现全空白）
3. 触控板捏合：比之前更慢，灵敏度约 1/4
4. 缩放到 canvas 填满视口后继续缩放：缩放中心保持稳定
5. 控制台无 JS 错误
  </verify>
  <done>PAD 系统就位，applyZoom/clampScroll/centerCanvas 均已修正</done>
</task>

</tasks>

<success_criteria>
- 缩放中心始终正确（按钮/键盘=视口中心，捏合=指针下方）
- 画布在视口内时仍可双指平移
- 平移有边界，不会滚到纯空白
- 触控板捏合比之前灵敏度低约 75%
- 控制台无新增错误
</success_criteria>
