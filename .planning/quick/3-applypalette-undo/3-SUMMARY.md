---
phase: quick-3
plan: "01"
subsystem: editor
tags: [undo, history, palette, bugfix]
dependency_graph:
  requires: []
  provides: [applyPalette-independent-undo]
  affects: [editor.html]
tech_stack:
  added: []
  patterns: [save-after history model]
key_files:
  created: []
  modified:
    - editor.html
decisions:
  - "applyPalette 改为 save-after 模型：flushPixels() 之后 pushHistory()，与铅笔保持一致，每次操作独立占一个 undo 步骤"
metrics:
  duration: "5min"
  completed_date: "2026-03-03"
---

# Quick Task 3: applyPalette Undo 修复 Summary

**One-liner:** applyPalette 从 save-before 改为 save-after 模型，保证色卡应用与铅笔各占独立的 undo 步骤

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | 修复 applyPalette 的 pushHistory 时序 | 350f218 | editor.html |

## What Was Done

### Root Cause

applyPalette 原来使用 save-before 模型：先 `pushHistory()`（存初始状态），再修改像素，但从不把应用后的状态压入历史。

铅笔 `onUp` 调用 `pushHistory()` 时，把"色卡应用后+铅笔完成"的状态写入 history，而上一个条目仍是初始状态。一次 Cmd+Z 跳回初始状态，两次操作被合并撤销。

### Fix Applied

**文件：** `editor.html`，第 1820 行 `applyPalette()` 函数

**改动（2 行）：**
- 删除：函数开头的 `pushHistory();  // save-before（瞬时操作，参照 paint bucket 模式）`
- 添加：`flushPixels()` 之后 `pushHistory();  // save-after: 应用后压入，保证与铅笔各占独立 undo 步骤`

**修改后历史栈：** `[初始, 色卡应用后, 铅笔完成后]`，每步独立可撤销。

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- editor.html modified: confirmed (1 file changed, 1 insertion, 1 deletion)
- commit 350f218 exists: confirmed
- applyPalette 开头无 pushHistory(): confirmed (line 1821 is `const px = ...`)
- flushPixels() 之后有 pushHistory(): confirmed (line 1836)
