---
phase: quick-8
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [editor.html]
autonomous: true
requirements: [QUICK-8]
must_haves:
  truths:
    - "拖拽选区时，边界像素块显示为画布对应位置的反色块（逐像素，不是线框）"
    - "选区确定后，外包线为白色实线，2屏幕像素宽，位于选区外侧，以500ms间隔闪烁"
    - "外包线不遮挡选区内部任何像素（位于选区外侧）"
    - "clearSelection() 正确取消 RAF，不留残影"
  artifacts:
    - path: "editor.html"
      provides: "重写后的 _marqueeDrawPreview 和 drawAnts 函数"
      contains: "getPixel, 255-r, 255-g, 255-b, Date.now"
  key_links:
    - from: "_marqueeDrawPreview"
      to: "EditorState.pixels"
      via: "getPixel(px, py) 读取边界像素颜色"
      pattern: "getPixel"
    - from: "drawAnts"
      to: "selCtx.strokeRect"
      via: "外侧坐标: x-0.5/dpr, y-0.5/dpr, w+1/dpr, h+1/dpr"
      pattern: "strokeRect"
---

<objective>
重新设计 editor.html 中选区边框的视觉效果，使其更清晰、更美观。

Purpose: 当前蚂蚁线使用 difference compositeOperation，在某些背景色上对比度不足，且拖拽预览框也是线框形式。改为：拖拽时逐像素块反色填充边界，确定后闪烁白色外包线。
Output: editor.html 中 `_marqueeDrawPreview` 和 `drawAnts` 两个函数被替换。
</objective>

<execution_context>
@/Users/calling/.claude/get-shit-done/workflows/execute-plan.md
@/Users/calling/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

关键约束（来自 CLAUDE.md）：
- selCtx 在 initCanvases() 中已经 `selCtx.scale(dpr, dpr)` 一次，之后所有绘制坐标均为逻辑坐标
- clearRect 必须用逻辑坐标：`selCtx.clearRect(0, 0, EditorState.width, EditorState.height)`
- EditorState.selection = {x, y, w, h} 是画布像素坐标（逻辑坐标）
- dpr 变量在 initCanvases 作用域内定义为 `const dpr = window.devicePixelRatio || 1`；drawAnts 和 _marqueeDrawPreview 是闭包，可访问外层 `dpr`（需确认或重新获取）
</context>

<interfaces>
<!-- 现有函数签名，executor 直接替换 -->

现有 _marqueeDrawPreview（在 tools.marquee 闭包内，约第 2550 行）：
```javascript
function _marqueeDrawPreview(rx, ry, rw, rh) {
  selCtx.clearRect(0, 0, EditorState.width, EditorState.height);
  selCtx.lineWidth = 1;
  selCtx.setLineDash([4, 4]);
  selCtx.globalCompositeOperation = 'difference';
  selCtx.strokeStyle = '#ffffff';
  selCtx.lineDashOffset = 0;
  selCtx.strokeRect(rx + 0.5, ry + 0.5, rw, rh);
  selCtx.globalCompositeOperation = 'source-over';
}
```

现有 drawAnts（约第 1237 行）：
```javascript
function drawAnts() {
  if (!EditorState.selectionMask || !_antsPath) { antsRafId = null; return; }
  selCtx.clearRect(0, 0, EditorState.width, EditorState.height);
  selCtx.lineWidth = 1;
  selCtx.setLineDash([4, 4]);
  selCtx.globalCompositeOperation = 'difference';
  selCtx.strokeStyle = '#ffffff';
  selCtx.lineDashOffset = antsDashOffset;
  selCtx.stroke(_antsPath);
  selCtx.globalCompositeOperation = 'source-over';
  antsDashOffset = (antsDashOffset - 1 + 8) % 8;
  antsRafId = requestAnimationFrame(drawAnts);
}
```

辅助函数 getPixel（已存在于代码中）：
```javascript
function getPixel(x, y) {
  const i = (y * EditorState.width + x) * 4;
  return [EditorState.pixels[i], EditorState.pixels[i+1], EditorState.pixels[i+2], EditorState.pixels[i+3]];
}
```

EditorState.selection = { x, y, w, h }（画布像素坐标）
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: 替换 _marqueeDrawPreview — 拖拽边界逐像素块反色</name>
  <files>editor.html</files>
  <action>
找到 `function _marqueeDrawPreview(rx, ry, rw, rh)` 函数（在 tools.marquee 闭包内，约第 2550 行），将其整体替换为以下实现：

```javascript
function _marqueeDrawPreview(rx, ry, rw, rh) {
  selCtx.clearRect(0, 0, EditorState.width, EditorState.height);
  if (rw <= 0 || rh <= 0) return;

  // 边界四条边的像素坐标列表（画布逻辑像素）
  const border = [];
  const x0 = rx, y0 = ry, x1 = rx + rw - 1, y1 = ry + rh - 1;

  // 上边和下边
  for (let px = x0; px <= x1; px++) {
    border.push([px, y0]);
    if (rh > 1) border.push([px, y1]);
  }
  // 左边和右边（不含角落，已由上下边覆盖）
  for (let py = y0 + 1; py <= y1 - 1; py++) {
    border.push([x0, py]);
    if (rw > 1) border.push([x1, py]);
  }

  // 对每个边界像素，读取 EditorState.pixels 的颜色，绘制反色方块
  selCtx.globalCompositeOperation = 'source-over';
  selCtx.setLineDash([]);
  for (const [px, py] of border) {
    // 越界保护
    if (px < 0 || py < 0 || px >= EditorState.width || py >= EditorState.height) continue;
    const [r, g, b] = getPixel(px, py);
    selCtx.fillStyle = `rgb(${255 - r},${255 - g},${255 - b})`;
    selCtx.fillRect(px, py, 1, 1);  // 逻辑坐标 1×1（selCtx 已 scale(dpr,dpr)）
  }
}
```

注意：
- `selCtx` 已在 `initCanvases()` 中 `scale(dpr, dpr)` 一次，因此 `fillRect(px, py, 1, 1)` 的 1×1 是逻辑像素，屏幕上刚好对应一个画布像素块
- `getPixel` 是已有函数，直接调用
- 不使用 difference compositeOperation，完全删除
  </action>
  <verify>
在浏览器中打开 editor.html，加载图片后用矩形选框工具拖拽选区。拖拽过程中，选区边界的每个像素块应显示该位置画布颜色的反色（例如白色背景上边界显示黑色块，红色背景上显示青色块）。不应出现虚线框。
  </verify>
  <done>拖拽预览框为逐像素块反色填充，无线框，无 difference 合成操作</done>
</task>

<task type="auto">
  <name>Task 2: 替换 drawAnts — 闪烁白色外包线（选区外侧，2屏幕像素宽）</name>
  <files>editor.html</files>
  <action>
找到 `function drawAnts()` 函数（约第 1237 行），将其整体替换为以下实现：

```javascript
function drawAnts() {
  if (!EditorState.selection) { antsRafId = null; return; }
  const { x, y, w, h } = EditorState.selection;
  const dpr = window.devicePixelRatio || 1;

  selCtx.clearRect(0, 0, EditorState.width, EditorState.height);
  selCtx.setLineDash([]);
  selCtx.globalCompositeOperation = 'source-over';

  // 500ms 间隔闪烁：亮 / 暗交替
  const bright = Math.floor(Date.now() / 500) % 2 === 0;
  selCtx.strokeStyle = bright ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.15)';

  // 线宽：2 屏幕像素 = 2/dpr 逻辑坐标（selCtx 已 scale(dpr,dpr)）
  selCtx.lineWidth = 2 / dpr;

  // 外包线位置：选区外侧，向外扩展 0.5/dpr 个逻辑像素（线宽 1/dpr 各朝一侧）
  const offset = 1 / dpr;
  selCtx.strokeRect(x - offset, y - offset, w + offset * 2, h + offset * 2);

  antsRafId = requestAnimationFrame(drawAnts);
}
```

同时：
1. 找到 `let antsDashOffset = 0;` 和 `let _antsPath = null;` 这两个变量声明 — **保留** `antsRafId`，**删除** `antsDashOffset` 和 `_antsPath` 这两行（它们不再使用）
2. 找到 `scheduleAnts()` 函数，保留其结构但移除 `antsDashOffset = 0;` 这一行：

```javascript
function scheduleAnts() {
  if (antsRafId) { cancelAnimationFrame(antsRafId); antsRafId = null; }
  antsRafId = requestAnimationFrame(drawAnts);
}
```

3. 找到 `function setSelection(mask)` 或 `rebuildAntsPath`，删除所有 `_antsPath` 相关赋值语句（Path2D 不再使用）
4. 确认 `clearSelection()` 中 `selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height)` — 改为 `selCtx.clearRect(0, 0, EditorState.width, EditorState.height)`（逻辑坐标）

注意：
- 新 drawAnts 直接从 `EditorState.selection` 读取 {x,y,w,h}，不再依赖 `_antsPath` 或 `selectionMask`
- 如果 `EditorState.selection` 为 null，立即退出并清空 rafId
- 闪烁靠 Date.now() 驱动，RAF 持续运行但每帧重绘是廉价操作（单个 strokeRect）
  </action>
  <verify>
在浏览器中选中一个区域后，选区应显示：白色外包线（2屏幕像素宽），位于选区外侧，以约500ms间隔在亮白色和极淡白色之间切换。无虚线、无蚂蚁线动画、无 difference compositeOperation。取消选区后线框完全消失。
  </verify>
  <done>
- 确定选区后显示闪烁白色外包线，线在选区外侧（选区内像素不被遮挡）
- 无蚂蚁线，无 difference compositeOperation
- clearSelection() 正确取消 RAF
- 控制台无报错
  </done>
</task>

</tasks>

<verification>
```
1. 启动 Flask: python3 web_app.py
2. 打开 http://localhost:5010/editor
3. 加载图片
4. 拖拽矩形选框 → 边界显示逐像素反色块（无线框）
5. 松开鼠标 → 选区确定后显示白色外包线，外侧，2px宽，500ms闪烁
6. 按 Esc 或点击空白处取消选区 → 线框消失，无残影
7. 浏览器控制台无 JS 报错
```
</verification>

<success_criteria>
- 拖拽时：边界逐像素块反色，无任何线框
- 确定后：白色外包线，2屏幕像素，位于选区外侧（不遮挡内部），500ms闪烁
- 无 difference compositeOperation（全部移除）
- clearSelection() 无残影，RAF 正确取消
</success_criteria>

<output>
完成后创建 `.planning/quick/8-selection-border-visual-redesign-inverse/8-SUMMARY.md`
</output>
