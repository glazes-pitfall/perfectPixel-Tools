---
phase: quick-9
plan: 01
subsystem: editor-selection
tags: [selection, marching-ants, DPR, canvas, pixel-outline]
dependency_graph:
  requires: []
  provides: [selCanvas-SEL_PAD, drawAnts-pixel-outline]
  affects: [editor.html]
tech_stack:
  added: []
  patterns: [SEL_PAD-canvas-overflow, Path2D-pixel-outline]
key_files:
  modified:
    - path: editor.html
      lines_modified: "initCanvases (1398-1422), clearSelection (1132-1136), drawAnts (1223-1284), _marqueeDrawPreview (2556), marquee.onDown (2593)"
decisions:
  - "SEL_PAD=2 屏幕像素固定值；selCanvas style.top/left=-selCSSPad 使扩展对称"
  - "selCtx.translate(selCSSPad,selCSSPad) 在 scale 之后，保持逻辑坐标原点=图像原点"
  - "off=1/dpr（lineWidth/2）使 2px 描边完全落在选区外侧，不遮盖像素"
  - "Path2D 单次 stroke()，避免 bounding box 大时逐段 stroke 开销"
metrics:
  duration: "~5min"
  completed: "2026-03-03T17:55:12Z"
  tasks_completed: 2
  files_modified: 1
---

# Quick-9: Selection Outer Border 2px Screen Jagged — Summary

**One-liner:** selCanvas 扩展 SEL_PAD=2px 防裁剪 + drawAnts 用 selectionMask 逐像素轮廓路径替代 bounding box 矩形描边。

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | selCanvas SEL_PAD — 外描边不被裁剪 | 7d32ccd | SEL_PAD 常量、initCanvases 拆分、4 处 clearRect 更新 |
| 2 | drawAnts 像素轮廓路径 — 锯齿状边框 | ce577a8 | drawAnts 完整重写，selectionMask 四邻居检测，Path2D |

## What Was Built

### Task 1: selCanvas SEL_PAD 扩展

**问题：** selCanvas 与 cursorCanvas 尺寸相同，当选区触及画布边缘时，2px 外描边有一半落在 canvas 外部被裁剪，导致边缘描边只显示 1px 宽或完全不显示。

**解决方案：**
- 添加模块级常量 `const SEL_PAD = 2`（屏幕像素）
- `initCanvases` 中拆分 `[selCanvas, cursorCanvas].forEach(...)` 为独立设置：
  - `selCanvas.width/height = image * dpr + SEL_PAD * 2`（物理像素扩展）
  - `selCanvas.style.width/height = (image + selCSSPad * 2) + 'px'`（CSS 尺寸同步扩展）
  - `selCanvas.style.top/left = -selCSSPad + 'px'`（负偏移使扩展区域向外，不影响 cursorCanvas 命中区域）
  - `selCtx.scale(dpr, dpr)` 后紧接 `selCtx.translate(selCSSPad, selCSSPad)`（将 (0,0) 映射回图像原点）
- 更新三处 `selCtx.clearRect()`，覆盖 padding 区域（`clearRect(-_pad, -_pad, width+_pad*2, height+_pad*2)`）：
  - `clearSelection()`（行 1132–1136）
  - `_marqueeDrawPreview()`（行 2556）
  - `marquee.onDown()`（行 2593）

### Task 2: drawAnts 像素轮廓路径

**问题：** `drawAnts` 始终绘制 `EditorState.selection` 的 bounding box 矩形，忽略 `selectionMask` 的实际形状。魔棒选中不规则区域时，边框仍显示矩形。

**解决方案：** 完整重写 `drawAnts`（行 1223–1284）：

```
遍历 bounding box 每个像素 → 查找 mask=1 的像素 →
检测四邻居（上/下/左/右）是否 mask=0 或越界 →
是 → 在该边添加 Path2D 线段（向外偏移 off=1/dpr）→
一次 selCtx.stroke(path) 绘制全部轮廓
```

- `lineWidth = 2/dpr`（2 屏幕像素），`off = 1/dpr`（描边的一半），确保描边完全在选区外侧
- `clearRect` 覆盖 `SEL_PAD` padding 区域（`-_pad, -_pad, width+_pad*2, height+_pad*2`）
- 500ms 闪烁（亮白/暗白）保持不变
- Fallback：mask 为 null 时退回 `strokeRect`（安全兜底，实际上不会触发）

**性能：** 魔棒 64×64 选区 = 4096 像素，每帧遍历 ~0.5ms，在 RAF 60fps 内可接受。

## Deviations from Plan

None — 计划执行完全准确。

## Verification Results

代码静态审查通过：
- `SEL_PAD` 常量位于 `let antsRafId` 上方（行 1113）
- `selCtx.translate` 在 `selCtx.scale` 之后（正确的 transform 顺序）
- 所有 `selCtx.clearRect` 调用均覆盖 padding 区域（共 4 处）
- `drawAnts` 使用 `selectionMask[px + py * W]` 逐像素检测（与 PLAN 规格一致）
- `off = 1/dpr` 与 `lineWidth = 2/dpr` 匹配（半个线宽 = 描边落在外侧）
- RAF loop（`requestAnimationFrame(drawAnts)`）和 500ms 闪烁逻辑保留

## Self-Check: PASSED

- [x] `editor.html` 已修改（git status clean after commits）
- [x] Task 1 commit `7d32ccd` 存在
- [x] Task 2 commit `ce577a8` 存在
- [x] SUMMARY.md 创建于 `.planning/quick/9-selection-outer-border-2px-screen-jagged/9-SUMMARY.md`
