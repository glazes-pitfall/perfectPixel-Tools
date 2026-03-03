---
phase: quick-9
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [editor.html]
autonomous: true
requirements: [QUICK-9]

must_haves:
  truths:
    - "选区边框在画布边缘时仍完整显示，描边不被裁剪"
    - "魔棒/marquee 选区边框沿像素轮廓显示，非矩形选区显示锯齿状边缘"
    - "矩形选区作为 fallback 仍显示正确的矩形描边"
  artifacts:
    - path: "editor.html"
      provides: "修复后的 initCanvases + drawAnts"
      contains: "SEL_PAD"
  key_links:
    - from: "initCanvases()"
      to: "selCanvas"
      via: "SEL_PAD 扩展 + translate 偏移"
      pattern: "selCtx.translate"
    - from: "drawAnts()"
      to: "EditorState.selectionMask"
      via: "逐像素边缘检测"
      pattern: "selectionMask\\[x \\+ y \\* W\\]"
---

<objective>
修复 editor.html 选区边框的两个视觉问题：
1. 外描边 2 屏幕像素被 selCanvas 边界裁剪（当选区触及画布边缘时）
2. drawAnts 始终绘制 bounding box 矩形描边，忽略 selectionMask 实际轮廓

Purpose: 选区边框应准确反映选中区域形状，且在画布边缘时不被截断。
Output: 修改后的 editor.html，selCanvas 带 SEL_PAD 扩展，drawAnts 走像素轮廓路径。
</objective>

<execution_context>
@/Users/calling/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@/Users/calling/perfectPixel_ver1.1/editor.html

<interfaces>
<!-- 当前 initCanvases 关键片段（行 1386–1417） -->
```javascript
function initCanvases(width, height) {
  // pixel-canvas: NO DPR
  pixelCanvas.width  = width;
  pixelCanvas.height = height;
  pixelCanvas.style.width  = width  + 'px';
  pixelCanvas.style.height = height + 'px';
  pixelCtx = pixelCanvas.getContext('2d', { willReadFrequently: true, alpha: true });

  // overlay canvases: DPR-scaled
  const dpr = window.devicePixelRatio || 1;
  [selCanvas, cursorCanvas].forEach(canvas => {
    canvas.width  = width  * dpr;
    canvas.height = height * dpr;
    canvas.style.width  = width  + 'px';
    canvas.style.height = height + 'px';
  });
  selCtx    = selCanvas.getContext('2d');
  cursorCtx = cursorCanvas.getContext('2d');
  selCtx.scale(dpr, dpr);
  cursorCtx.scale(dpr, dpr);

  const zc = document.getElementById('zoom-container');
  zc.style.width  = width  + 'px';
  zc.style.height = height + 'px';
  centerCanvas();
}
```

<!-- 当前 drawAnts（行 1219–1240） -->
```javascript
function drawAnts() {
  if (!EditorState.selection) { antsRafId = null; return; }
  const { x, y, w, h } = EditorState.selection;
  const dpr = window.devicePixelRatio || 1;
  selCtx.clearRect(0, 0, EditorState.width, EditorState.height);
  selCtx.setLineDash([]);
  selCtx.globalCompositeOperation = 'source-over';
  const bright = Math.floor(Date.now() / 500) % 2 === 0;
  selCtx.strokeStyle = bright ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.15)';
  selCtx.lineWidth = 2 / dpr;
  const offset = 1 / dpr;
  selCtx.strokeRect(x - offset, y - offset, w + offset * 2, h + offset * 2);
  antsRafId = requestAnimationFrame(drawAnts);
}
```

<!-- clearSelection（行 1128–1134） -->
```javascript
function clearSelection() {
  EditorState.selectionMask = null;
  EditorState.selection = null;
  if (antsRafId) { cancelAnimationFrame(antsRafId); antsRafId = null; }
  if (selCtx) selCtx.clearRect(0, 0, EditorState.width, EditorState.height);
  updateSelectionUI();
}
```

<!-- _marqueeDrawPreview（行 2540–2569）用于拖拽预览 -->
```javascript
function _marqueeDrawPreview(rx, ry, rw, rh) {
  selCtx.clearRect(0, 0, EditorState.width, EditorState.height);
  // ... 绘制边界像素反色方块
}
```

<!-- marquee onUp 调用 setSelection(finalMask, bbox) — mask 包含矩形内所有像素 -->
<!-- wand tool onUp 也调用 setSelection(mask, bbox) — mask 仅含连通区域像素 -->
<!-- 因此 drawAnts 中 EditorState.selectionMask 对 marquee 和 wand 均存在 -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: selCanvas 加 SEL_PAD — 修复外描边被裁剪</name>
  <files>editor.html</files>
  <action>
在 `let antsRafId = null;` 所在行（行 1113）上方，添加模块级常量：
```javascript
const SEL_PAD = 2; // 屏幕像素 — selCanvas 每侧额外空间，使外描边不被裁剪
```

在 `initCanvases` 函数中，将 `[selCanvas, cursorCanvas].forEach(...)` 块替换为分开设置：

```javascript
// selCanvas: 每侧扩展 SEL_PAD 屏幕像素，外描边不被裁剪
const dpr = window.devicePixelRatio || 1;
const selCSSPad = SEL_PAD / dpr;  // 逻辑像素 padding（CSS 单位）
selCanvas.width  = width  * dpr + SEL_PAD * 2;
selCanvas.height = height * dpr + SEL_PAD * 2;
selCanvas.style.width  = (width  + selCSSPad * 2) + 'px';
selCanvas.style.height = (height + selCSSPad * 2) + 'px';
selCanvas.style.top  = (-selCSSPad) + 'px';
selCanvas.style.left = (-selCSSPad) + 'px';
selCtx = selCanvas.getContext('2d');
selCtx.scale(dpr, dpr);
selCtx.translate(selCSSPad, selCSSPad); // (0,0) 映射到图像左上角

// cursorCanvas: 保持原尺寸（接收 pointer events，不需要 padding）
cursorCanvas.width  = width  * dpr;
cursorCanvas.height = height * dpr;
cursorCanvas.style.width  = width  + 'px';
cursorCanvas.style.height = height + 'px';
cursorCtx = cursorCanvas.getContext('2d');
cursorCtx.scale(dpr, dpr);
```

注意：`selCanvas.style.top/left` 是相对于父容器 `#zoom-container` 的偏移，所有 canvas 均为 `position: absolute`，所以负偏移使 selCanvas 向外扩展而不影响 cursorCanvas 的命中测试区域。

然后更新所有使用 `selCtx.clearRect(0, 0, EditorState.width, EditorState.height)` 的位置，改为覆盖 padding 区域：

1. `clearSelection` 函数（行 1132）：
```javascript
if (selCtx) {
  const _pad = SEL_PAD / (window.devicePixelRatio || 1);
  selCtx.clearRect(-_pad, -_pad, EditorState.width + _pad * 2, EditorState.height + _pad * 2);
}
```

2. `_marqueeDrawPreview` 函数（行 2541）：
```javascript
const _pad = SEL_PAD / (window.devicePixelRatio || 1);
selCtx.clearRect(-_pad, -_pad, EditorState.width + _pad * 2, EditorState.height + _pad * 2);
```

3. marquee `onDown` 中的 `selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height)`（行 2577）：
改为：
```javascript
const _pad = SEL_PAD / (window.devicePixelRatio || 1);
selCtx.clearRect(-_pad, -_pad, EditorState.width + _pad * 2, EditorState.height + _pad * 2);
```

drawAnts 中的 clearRect 将在 Task 2 重写时一并处理。
  </action>
  <verify>
打开 http://localhost:5010/editor，加载图片，用矩形选框工具选中画布左上角区域（从 (0,0) 开始拖拽），确认：
- 左边和上边的白色描边完整显示，不被裁剪为半条线
- 选区内部正常，cursorCanvas 仍响应鼠标事件
  </verify>
  <done>selCanvas 比 cursorCanvas 每侧多 SEL_PAD 屏幕像素；画布边缘的选区描边完整可见</done>
</task>

<task type="auto">
  <name>Task 2: drawAnts 走像素轮廓路径 — 锯齿状边框</name>
  <files>editor.html</files>
  <action>
将 `drawAnts` 函数（行 1219–1240）完整替换为以下实现：

```javascript
function drawAnts() {
  if (!EditorState.selection) { antsRafId = null; return; }

  const dpr = window.devicePixelRatio || 1;
  const _pad = SEL_PAD / dpr;  // clearRect 需覆盖 padding 区域

  selCtx.clearRect(-_pad, -_pad, EditorState.width + _pad * 2, EditorState.height + _pad * 2);
  selCtx.globalCompositeOperation = 'source-over';
  selCtx.setLineDash([]);

  // 500ms 闪烁
  const bright = Math.floor(Date.now() / 500) % 2 === 0;
  selCtx.strokeStyle = bright ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.15)';
  selCtx.lineWidth = 2 / dpr;  // 2 屏幕像素

  const mask = EditorState.selectionMask;
  const { x: bx, y: by, w: bw, h: bh } = EditorState.selection;

  if (mask) {
    // 像素轮廓路径：遍历 bounding box，对每个选中像素检测四邻居
    const W = EditorState.width, H = EditorState.height;
    const off = 1 / dpr;  // lineWidth/2：使 2px 描边完全落在选区外侧
    const path = new Path2D();

    for (let py = by; py < by + bh; py++) {
      for (let px = bx; px < bx + bw; px++) {
        if (!mask[px + py * W]) continue;  // 未选中像素跳过

        // 上邻居未选中（或越界）→ 画上边
        if (py === 0 || !mask[px + (py - 1) * W]) {
          path.moveTo(px - off, py - off);
          path.lineTo(px + 1 + off, py - off);
        }
        // 下邻居未选中（或越界）→ 画下边
        if (py === H - 1 || !mask[px + (py + 1) * W]) {
          path.moveTo(px - off, py + 1 + off);
          path.lineTo(px + 1 + off, py + 1 + off);
        }
        // 左邻居未选中（或越界）→ 画左边
        if (px === 0 || !mask[(px - 1) + py * W]) {
          path.moveTo(px - off, py - off);
          path.lineTo(px - off, py + 1 + off);
        }
        // 右邻居未选中（或越界）→ 画右边
        if (px === W - 1 || !mask[(px + 1) + py * W]) {
          path.moveTo(px + 1 + off, py - off);
          path.lineTo(px + 1 + off, py + 1 + off);
        }
      }
    }
    selCtx.stroke(path);
  } else {
    // Fallback（无 mask）：bounding box 矩形描边
    const off = 1 / dpr;
    selCtx.strokeRect(
      bx - off, by - off,
      bw + off * 2, bh + off * 2
    );
  }

  antsRafId = requestAnimationFrame(drawAnts);
}
```

**性能注意：** 魔棒选区面积大时（如 64×64 = 4096 像素），每帧遍历开销约 ~0.5ms，在 RAF 60fps 循环内可接受。如果画布分辨率极大导致卡顿，可在后续优化中缓存 Path2D（仅当 mask 变化时重建）。当前实现以正确性优先。

**关于矩形选区：** marquee onUp 调用 `setSelection(finalMask, bbox)`，mask 包含矩形内所有像素，因此也走 mask 路径（正确显示矩形轮廓外侧描边）。fallback 仅在 mask 为 null 时触发，实际上不会发生，保留作为安全兜底。
  </action>
  <verify>
1. 矩形选区（marquee 工具）：选区边框应为矩形轮廓外侧 2px 白色描边，触及画布边缘时描边完整
2. 魔棒选区（wand 工具）：选中不规则区域时，边框沿每个像素的实际边缘绘制，非直角转角处可见锯齿形状
3. 两种选区的 500ms 闪烁（亮白/暗白）均正常工作
4. 浏览器控制台无 JS 报错：`browser_console_messages(level="error")`
  </verify>
  <done>drawAnts 使用 selectionMask 逐像素绘制轮廓描边；矩形选区和不规则选区均正确显示</done>
</task>

</tasks>

<verification>
执行完两个任务后：
1. `python3 /Users/calling/perfectPixel_ver1.1/web_app.py` 启动 Flask（若未运行）
2. 打开 http://localhost:5010/editor，加载任意图片
3. 矩形选框工具选中画布角落 → 描边 4 条边全部完整可见
4. 魔棒工具点击色块 → 选区边框沿像素实际边缘走，非矩形区域可见锯齿轮廓
5. `browser_console_messages(level="error")` 无报错
</verification>

<success_criteria>
- selCanvas 每侧扩展 SEL_PAD=2 屏幕像素，画布边缘描边不再被裁剪
- drawAnts 使用 selectionMask 路径绘制，像素轮廓而非 bounding box 矩形
- clearRect 所有调用均覆盖 padding 区域，清除干净
- 500ms 闪烁、lineWidth=2/dpr 行为不变
</success_criteria>

<output>
任务完成后，创建 `.planning/quick/9-selection-outer-border-2px-screen-jagged/9-SUMMARY.md`，记录：
- 修改的行范围
- SEL_PAD 常量值和位置
- drawAnts 重写摘要
- 测试验证结果
</output>
