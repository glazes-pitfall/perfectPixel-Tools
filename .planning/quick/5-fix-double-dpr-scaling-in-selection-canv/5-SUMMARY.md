---
phase: quick-5
plan: "01"
subsystem: editor
tags: [bugfix, dpr, selection, marching-ants, retina]
dependency_graph:
  requires: []
  provides: [correct-retina-selection-rendering]
  affects: [editor.html]
tech_stack:
  added: []
  patterns: [DPR-scale-once-in-initCanvases]
key_files:
  created: []
  modified:
    - editor.html
decisions:
  - "DPR scale applied exactly once (initCanvases), not per-draw — matches CLAUDE.md canvas init rules"
metrics:
  duration: "3 minutes"
  completed: "2026-03-03"
---

# Quick Task 5: Fix Double DPR Scaling in Selection Canvas Summary

**One-liner:** Removed duplicate `selCtx.scale(dpr, dpr)` from `drawAnts` and `_marqueeDrawPreview`, fixing Retina (dpr=2) marching-ants 2x offset/overflow.

## What Was Done

`initCanvases()` already applies a permanent `selCtx.scale(dpr, dpr)` once when the selection canvas context is created. Both `drawAnts()` and `_marqueeDrawPreview()` were each calling `selCtx.scale(dpr, dpr)` again inside their draw loop, causing the effective transform to be `scale(dpr², dpr²)`. On Retina displays (dpr=2) this produced a 4x scale, making the marching-ants border appear at 2x offset and overflow the canvas boundary.

## Changes Made

| Function | File | Lines Removed | Lines Affected |
|----------|------|---------------|---------------|
| `drawAnts()` | editor.html | `const dpr = window.devicePixelRatio \|\| 1;` (was ~1122) and `selCtx.scale(dpr, dpr);` (was ~1125) | ~1120–1136 |
| `_marqueeDrawPreview()` | editor.html | `const dpr = window.devicePixelRatio \|\| 1;` (was ~2391) and `selCtx.scale(dpr, dpr);` (was ~2394) | ~2390–2404 |

**Not changed:** `selCtx.scale(dpr, dpr)` in `initCanvases()` (line ~1304) — this is the single correct scaling point.

**Preserved in both functions:** `selCtx.save()` / `selCtx.restore()` for lineDash/strokeStyle state isolation.

## Verification Results

```
$ grep -n "selCtx.scale" editor.html
1304:      selCtx.scale(dpr, dpr);
```
Only one occurrence remains (initCanvases). Done criteria met.

```
$ grep -n "selCtx.save\|selCtx.restore\|selCtx.setLineDash" editor.html
1123:      selCtx.save();
1125:      selCtx.setLineDash([4, 4]);
1132:      selCtx.restore();
2390:        selCtx.save();
2392:        selCtx.setLineDash([4, 4]);
2399:        selCtx.restore();
```
Both functions retain correct save/restore structure.

## Commit

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | d764c87 | fix(quick-5): remove duplicate DPR scale in drawAnts and _marqueeDrawPreview |

## Deviations from Plan

None — plan executed exactly as written. Deleted exactly the 4 lines specified (2 per function), no logic changes.

## Self-Check: PASSED

- [x] editor.html modified and committed (d764c87)
- [x] `selCtx.scale` appears exactly once in editor.html (line 1304)
- [x] `drawAnts` and `_marqueeDrawPreview` retain save()/restore() blocks
- [x] 4 lines removed (2 `const dpr` declarations + 2 `selCtx.scale` calls)
