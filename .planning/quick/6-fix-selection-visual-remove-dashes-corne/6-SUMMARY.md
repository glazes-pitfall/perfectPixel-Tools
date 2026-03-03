---
phase: quick-6
plan: "01"
subsystem: editor-selection
tags: [selection, visual, marquee, ants, checkerboard, editor]
dependency_graph:
  requires: []
  provides: [static-selection-border, gapless-marquee-preview]
  affects: [editor.html]
tech_stack:
  added: []
  patterns: [fillRect-four-sides, checkerboard-border-pixels, mask-edge-detection]
key_files:
  created: []
  modified:
    - editor.html
decisions:
  - "fillRect 四边方案替代 setLineDash + strokeRect — 通过角点重叠消除缺口"
  - "静态棋盘格边框 (x+y)%2 替代 RAF 60fps marching ants — 无动画，清晰度高"
  - "保留 antsRafId 变量名和 scheduleAnts() 函数名以减少调用方修改"
metrics:
  duration: "103s"
  completed_date: "2026-03-03"
  tasks_completed: 2
  files_modified: 1
---

# Quick Task 6: Fix Selection Visual — Remove Dashes Corner Gaps Summary

**One-liner:** fillRect 四边框替代 setLineDash 解决角点缺口；静态棋盘格像素边框替代 RAF marching ants 动画。

## What Was Built

修复了 `editor.html` 中两个选区视觉 bug：

1. **矩形预览框角点缺口（Task 1）** — `_marqueeDrawPreview` 改用 `drawBorderPass()` 函数，通过 `fillRect` 分别绘制上下左右四条边，白色在偏移 0 先绘制，黑色在偏移 1 后绘制，确保角点有像素重叠，彻底消除 `setLineDash` 的角点缺口问题。

2. **Marching ants RAF 动画替换为静态棋盘格（Task 2）** — 移除了 `antsDashOffset`、`_antsPath`、`rebuildAntsPath()`、`drawAnts()` 以及 `requestAnimationFrame` 循环。新增 `rebuildSelectionBorder()` 收集 mask 边缘像素列表，`drawSelectionBorder()` 以 `(x+y)%2` 决定每个边界像素黑白色并通过 `fillRect(x, y, 1, 1)` 逐像素绘制，无 RAF 循环。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | 修复 _marqueeDrawPreview — fillRect 四边替换 setLineDash strokeRect | 12e3139 | editor.html |
| 2 | 用静态棋盘格边框替换 marching ants | eb2675d | editor.html |

## Verification

- `setLineDash` 无实际调用（仅剩注释描述）
- `requestAnimationFrame`、`antsDashOffset`、`_antsPath`、`rebuildAntsPath`、`drawAnts` 已全部从代码中移除
- `rebuildSelectionBorder()` / `drawSelectionBorder()` / `scheduleAnts()` 调用链完整
- `clearSelection()` 正确清除 `_borderPixels` 并清空 selCanvas

## Deviations from Plan

None — 计划完全按原设计执行。

## Self-Check: PASSED

- editor.html 修改已提交（12e3139, eb2675d）
- 旧 marching ants 代码已完全清除（grep 确认无 requestAnimationFrame/antsDashOffset/_antsPath）
- 新静态棋盘格实现存在于正确位置（行 1106-1138）
- `_marqueeDrawPreview` 无 setLineDash 调用（行 2388-2402）
