---
phase: quick-6
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - editor.html
autonomous: true
requirements: []
must_haves:
  truths:
    - "拖拽选框时矩形四角无缺口，边框连续"
    - "选区确定后显示静态棋盘格边框（黑白交替像素），无动画"
    - "选区边框颜色在任何背景上均清晰可见"
  artifacts:
    - path: "editor.html"
      provides: "rebuildSelectionBorder + drawSelectionBorder 替代旧 marching ants"
  key_links:
    - from: "setSelection()"
      to: "drawSelectionBorder()"
      via: "scheduleAnts() 改为直接调用 drawSelectionBorder()"
---

<objective>
修复 editor.html 中两个选区视觉 bug：

1. `_marqueeDrawPreview` 使用 `setLineDash([4,4])` + `strokeRect`，在某些尺寸下四角出现缺口
2. Marching ants 动画用 RAF 60fps 驱动，用户反馈不需要动画

修复方案：
- 预览框改为 `fillRect` 四边（上下左右各一像素条），确保角点重叠无缺口
- 选区确定后改为静态棋盘格边框：`(x+y)%2` 决定白/黑像素，无 RAF 循环

Purpose: 消除选区视觉瑕疵，提升编辑精度感
Output: editor.html（单文件，内联 JS 修改）
</objective>

<execution_context>
@/Users/calling/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@/Users/calling/perfectPixel_ver1.1/editor.html
</context>

<tasks>

<task type="auto">
  <name>Task 1: 修复 _marqueeDrawPreview — 用 fillRect 四边替换 setLineDash strokeRect</name>
  <files>editor.html</files>
  <action>
定位 `_marqueeDrawPreview` 函数（约 2388 行），将现有实现替换为 fillRect 四边方案：

```javascript
function _marqueeDrawPreview(rx, ry, rw, rh) {
  selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
  // 两次 fillRect 确保角点重叠：先画白色，再偏移 1px 画黑色形成对比
  // 四边：Top / Bottom / Left / Right（用 fillRect 逐边绘制）
  function drawBorderPass(offset, color) {
    selCtx.fillStyle = color;
    const ox = offset, oy = offset;
    selCtx.fillRect(rx + ox,      ry + oy,       rw + 1, 1);   // Top
    selCtx.fillRect(rx + ox,      ry + rh + oy,  rw + 1, 1);   // Bottom
    selCtx.fillRect(rx + ox,      ry + oy,       1, rh);        // Left
    selCtx.fillRect(rx + rw + ox, ry + oy,       1, rh + 1);   // Right
  }
  drawBorderPass(0, '#ffffff');
  drawBorderPass(1, '#000000');
}
```

注意：selCtx 已是 DPR-scaled 坐标系（quick-5 修复后传入的 rx/ry/rw/rh 是 canvas image 坐标，selCtx 已 scale(dpr,dpr)），无需额外处理。
  </action>
  <verify>
打开 http://localhost:5010/editor，加载图片，用矩形选框工具拖拽选区，拖拽中检查矩形四角是否闭合无缺口。
  </verify>
  <done>任何尺寸的拖拽预览矩形四角均闭合，无 setLineDash 缺口</done>
</task>

<task type="auto">
  <name>Task 2: 用静态棋盘格边框替换 marching ants</name>
  <files>editor.html</files>
  <action>
**Step A: 替换变量声明（约 996-998 行）**

将：
```javascript
let antsRafId = null;
let antsDashOffset = 0;
let _antsPath = null;  // Path2D cache; rebuilt on mask change, only offset animates
```
替换为：
```javascript
let antsRafId = null;         // 保留供 clearSelection 兼容调用
let _borderPixels = null;     // {x,y}[] — 边界像素列表（mask 边缘）
```

**Step B: 替换 rebuildAntsPath（约 1107-1118 行）**

将整个 `rebuildAntsPath` 函数替换为：
```javascript
function rebuildSelectionBorder(mask, W, H) {
  _borderPixels = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[x + y * W]) continue;
      const onEdge = (
        y === 0   || !mask[x + (y-1) * W] ||
        y === H-1 || !mask[x + (y+1) * W] ||
        x === 0   || !mask[(x-1) + y * W] ||
        x === W-1 || !mask[(x+1) + y * W]
      );
      if (onEdge) _borderPixels.push({x, y});
    }
  }
}
```

**Step C: 替换 drawAnts（约 1120-1135 行）**

将整个 `drawAnts` 函数替换为：
```javascript
function drawSelectionBorder() {
  if (!EditorState.selectionMask || !_borderPixels) return;
  selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
  const dpr = window.devicePixelRatio || 1;
  selCtx.save();
  selCtx.scale(dpr, dpr);
  for (const {x, y} of _borderPixels) {
    selCtx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#000000';
    selCtx.fillRect(x, y, 1, 1);
  }
  selCtx.restore();
}
```

**Step D: 替换 scheduleAnts（约 1137-1141 行）**

将整个 `scheduleAnts` 函数替换为：
```javascript
function scheduleAnts() {
  if (antsRafId) { cancelAnimationFrame(antsRafId); antsRafId = null; }
  drawSelectionBorder();
}
```

**Step E: 修改 setSelection 中的调用（约 1037-1042 行）**

将：
```javascript
_antsPath = null;  // force Path2D rebuild
rebuildAntsPath(mask, EditorState.width, EditorState.height);
updateSelectionUI();
scheduleAnts();
```
替换为：
```javascript
_borderPixels = null;  // force rebuild
rebuildSelectionBorder(mask, EditorState.width, EditorState.height);
updateSelectionUI();
scheduleAnts();
```

**Step F: 修改 clearSelection（约 1014-1018 行）**

将：
```javascript
if (antsRafId) { cancelAnimationFrame(antsRafId); antsRafId = null; }
_antsPath = null;
```
替换为：
```javascript
if (antsRafId) { cancelAnimationFrame(antsRafId); antsRafId = null; }
_borderPixels = null;
```
  </action>
  <verify>
打开 http://localhost:5010/editor，加载图片：
1. 用矩形选框或魔棒选取一块区域 → 确认边框为静态黑白棋盘格像素，无滚动动画
2. 检查浏览器控制台无 JS 报错（browser_console_messages level="error"）
3. 按 Cmd+Z 撤销，按 Esc 取消选区 → 边框消失，canvas 清空
  </verify>
  <done>选区边框静态显示黑白交替像素，无 RAF 动画，clearSelection 正常清除边框</done>
</task>

</tasks>

<verification>
- _marqueeDrawPreview 无 setLineDash 调用，拖拽矩形四角闭合
- rebuildAntsPath / drawAnts / antsDashOffset 已从代码中移除
- 选区边框为静态棋盘格（黑白 1px 像素交替），不随时间变化
- clearSelection 正常工作，不产生 JS 错误
- 浏览器控制台无新增错误
</verification>

<success_criteria>
- 拖拽预览矩形无角点缺口
- 魔棒/矩形选框确定后显示静态棋盘格边框
- 取消选区后边框完全清除
- 无 RAF 动画循环残留
</success_criteria>

<output>
完成后创建 `.planning/quick/6-fix-selection-visual-remove-dashes-corne/6-SUMMARY.md`
</output>
