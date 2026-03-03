---
phase: quick-8
plan: 01
subsystem: editor-selection
tags: [selection, canvas, visual, marching-ants, inverse-color]
dependency_graph:
  requires: [editor.html selection tools from Phase 5]
  provides: [inverse-color drag preview, flashing white bounding-box outline]
  affects: [editor.html selection UX]
tech_stack:
  added: []
  patterns: [Date.now() blink loop, EditorState.pixels inverse-color read, strokeRect external offset]
key_files:
  created: []
  modified: [editor.html]
decisions:
  - "drawAnts now reads EditorState.selection bbox directly — no Path2D, no mask traversal"
  - "Blink driven by Date.now()/500 inside RAF loop — cheap single strokeRect per frame"
  - "clearRect uses EditorState.width/height (logical) not selCanvas physical dimensions"
metrics:
  duration: 87s
  completed_date: "2026-03-04"
---

# Quick Task 8: Selection Border Visual Redesign — Inverse Color Preview Summary

**One-liner:** 拖拽选框边界显示逐像素反色块，确定选区后以 500ms 间隔闪烁的 2px 白色外包线替代蚂蚁线。

## What Was Built

完整替换了 editor.html 中选区边框的两种视觉表现：

1. **拖拽预览（`_marqueeDrawPreview`）**：从 difference compositeOperation 线框改为逐像素块反色填充。对每个边界像素调用 `getPixel()` 读取 `EditorState.pixels` 中的原始 RGBA 值，计算反色 `rgb(255-r, 255-g, 255-b)` 后用 `fillRect(px, py, 1, 1)` 绘制到 selCtx。

2. **确定选区边框（`drawAnts`）**：从 Path2D 蚂蚁线（每帧更新 dashOffset）改为单次 `strokeRect` 闪烁。使用 `Math.floor(Date.now() / 500) % 2` 驱动亮/暗交替，线宽 `2/dpr` 逻辑坐标（等于 2 屏幕像素），位置向外扩展 `1/dpr` 确保在选区外侧。

## Commits

| Task | Hash | Description |
|------|------|-------------|
| 1 | aea1c5c | feat(quick-8): replace _marqueeDrawPreview with per-pixel inverse-color border |
| 2 | 8e5d242 | feat(quick-8): replace marching ants with flashing white bounding-box outline |

## Files Modified

- `/Users/calling/perfectPixel_ver1.1/editor.html`
  - `_marqueeDrawPreview`: 10 lines → 30 lines (full rewrite)
  - `drawAnts`: rewritten, simplified, no Path2D dependency
  - `scheduleAnts`: removed `antsDashOffset = 0`
  - `setSelection`: removed `_antsPath = null` + `rebuildAntsPath()` call
  - `clearSelection`: fixed clearRect to use logical coords; removed `_antsPath = null`
  - `rebuildAntsPath`: deleted entirely (18 lines removed)
  - Variables: deleted `antsDashOffset` and `_antsPath` declarations

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

- **Date.now() blink vs interval**: RAF 持续运行，每帧检查 `Date.now()/500` 相位即可，无需 setInterval，也无 RAF/interval 双重计时器冲突风险。
- **rebuildAntsPath 完全删除**: 新 drawAnts 直接从 `EditorState.selection` 读取 bbox，不需要 mask 遍历也不需要 Path2D 缓存。
- **clearRect 坐标修正**: 从 `selCanvas.width/height`（物理像素）改为 `EditorState.width/height`（逻辑坐标），与 selCtx 已 scale(dpr,dpr) 一致。

## Self-Check: PASSED

- FOUND: 8-SUMMARY.md
- FOUND: commit aea1c5c (Task 1)
- FOUND: commit 8e5d242 (Task 2)
