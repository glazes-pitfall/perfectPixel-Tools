---
phase: quick-5
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [editor.html]
autonomous: true
requirements: [QUICK-5]

must_haves:
  truths:
    - "选框（marching ants）在 Retina (dpr=2) 显示器上与像素完全对齐，不偏移、不放大"
    - "marquee 拖拽预览矩形与鼠标覆盖的像素区域完全重叠"
    - "dpr=1 的普通屏幕行为不变"
  artifacts:
    - path: "editor.html"
      provides: "修复后的 drawAnts 和 _marqueeDrawPreview，去除重复 scale"
      contains: "selCtx.save(); selCtx.setLineDash"
  key_links:
    - from: "initCanvases() line ~1306"
      to: "selCtx"
      via: "selCtx.scale(dpr, dpr) — 唯一一次永久缩放"
      pattern: "selCtx\\.scale\\(dpr"
---

<objective>
修复 editor.html 中选区画布（selection canvas）的 DPR 双重缩放 bug。

Purpose: initCanvases() 已对 selCtx 应用一次 scale(dpr, dpr)，但 drawAnts() 和 _marqueeDrawPreview() 在每次绘制时又额外调用 scale(dpr, dpr)，导致实际变换为 scale(dpr², dpr²)。在 Retina 屏（dpr=2）上选框会出现 2× 偏移并超出画布范围。

Output: 修改后的 editor.html，drawAnts 和 _marqueeDrawPreview 中去除多余的 dpr scale 调用，仅保留 save()/restore() 用于 lineDash/strokeStyle 状态隔离。
</objective>

<execution_context>
@/Users/calling/.claude/get-shit-done/workflows/execute-plan.md
@/Users/calling/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

<interfaces>
<!-- 受影响的三处代码位置 -->

editor.html line ~1120 — drawAnts():
```javascript
function drawAnts() {
  if (!EditorState.selectionMask || !_antsPath) { antsRafId = null; return; }
  const dpr = window.devicePixelRatio || 1;          // <- 删除此行（或仅在需要 clearRect 计算时保留）
  selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
  selCtx.save();
  selCtx.scale(dpr, dpr);                            // <- 删除此行
  selCtx.lineWidth = 1;
  selCtx.setLineDash([4, 4]);
  ...
  selCtx.restore();
}
```

editor.html line ~1390 — _marqueeDrawPreview():
```javascript
function _marqueeDrawPreview(rx, ry, rw, rh) {
  const dpr = window.devicePixelRatio || 1;          // <- 删除此行
  selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
  selCtx.save();
  selCtx.scale(dpr, dpr);                            // <- 删除此行
  selCtx.lineWidth = 1;
  selCtx.setLineDash([4, 4]);
  ...
  selCtx.restore();
}
```

editor.html line ~1306 — initCanvases() (不改动):
```javascript
selCtx.scale(dpr, dpr);   // 永久缩放，已正确设置，保持不变
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: 删除 drawAnts 和 _marqueeDrawPreview 中的重复 DPR scale</name>
  <files>editor.html</files>
  <action>
在 editor.html 中精确删除以下两处重复的 DPR 缩放代码：

**位置 1 — drawAnts()（约第 1122–1125 行）：**
- 删除 `const dpr = window.devicePixelRatio || 1;`（第 1122 行）
- 删除 `selCtx.scale(dpr, dpr);`（第 1125 行）
- 保留 `selCtx.save();`、`selCtx.restore();` 及其间所有 lineWidth/setLineDash/strokeStyle/lineDashOffset/stroke 调用
- `selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);` 使用的是 selCanvas.width（物理像素单位），不依赖 dpr 变量，保持不变

**位置 2 — _marqueeDrawPreview()（约第 2391–2394 行）：**
- 删除 `const dpr = window.devicePixelRatio || 1;`（第 2391 行）
- 删除 `selCtx.scale(dpr, dpr);`（第 2394 行）
- 保留 `selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);`、`selCtx.save();`、`selCtx.restore();` 及其间所有绘图调用
- `selCtx.clearRect` 同样使用 selCanvas.width/height（物理像素），无需 dpr

**不改动：**
- initCanvases() 中的 `selCtx.scale(dpr, dpr);`（第 1306 行）— 这是唯一正确的缩放点
- cursorCtx 相关的任何代码
- drawAnts 和 _marqueeDrawPreview 中所有绘图逻辑本身

修改原则：仅删除行，不重写逻辑。
  </action>
  <verify>
    <automated>grep -n "selCtx.scale" /Users/calling/perfectPixel_ver1.1/editor.html</automated>
  </verify>
  <done>
grep 结果只剩一行（initCanvases 中第 ~1306 行），drawAnts 和 _marqueeDrawPreview 内不再有 selCtx.scale 调用。
  </done>
</task>

</tasks>

<verification>
执行后验证：

```bash
# 1. 确认只剩一处 selCtx.scale
grep -n "selCtx.scale" editor.html
# 预期：仅输出 initCanvases 内的那一行

# 2. 确认 drawAnts 结构完整（save/restore 仍在）
grep -n "selCtx.save\|selCtx.restore\|selCtx.setLineDash" editor.html

# 3. 确认 _marqueeDrawPreview 结构完整
grep -n "_marqueeDrawPreview" editor.html
```

手动验证（在 Retina 屏上）：
- 用矩形选框工具拖拽 → 白/黑虚线框应与拖拽像素完全对齐，无偏移
- 松开鼠标后 marching ants 动画应在选区边缘精确流动
</verification>

<success_criteria>
- editor.html 中 selCtx.scale(dpr, dpr) 仅出现一次（initCanvases 内）
- drawAnts 和 _marqueeDrawPreview 保留 save()/restore() 状态隔离
- dpr=1 屏幕行为不变，Retina 屏选框不再偏移或超出画布
</success_criteria>

<output>
完成后在 .planning/quick/5-fix-double-dpr-scaling-in-selection-canv/ 目录下创建 5-SUMMARY.md，记录修改的行号和验证结果。
</output>
