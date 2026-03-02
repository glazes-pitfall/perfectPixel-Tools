---
phase: quick-2-fix-zoom-center-pan-bounds-sensitivity
plan: 02
subsystem: editor-zoom-pan
tags: [zoom, pan, scroll, trackpad, ux]
dependency_graph:
  requires: []
  provides: [correct-zoom-pivot, pan-bounds, pad-scroll-system]
  affects: [editor.html]
tech_stack:
  added: []
  patterns: [PAD-scroll-container, scroll-content-sizing, clamp-scroll-bounds]
key_files:
  modified:
    - editor.html
decisions:
  - "[Zoom] PAD=2000 approach: scroll-content vastly oversized to give pan headroom at all zoom levels"
  - "[Zoom] applyZoom pivot math: pivot in scroll-content coords = scrollLeft+pxInArea, ratio scale, then subtract pxInArea"
  - "[Zoom] clampScroll enforces 100px minimum canvas visibility on all 4 sides"
  - "[Zoom] Pinch factor reduced 1.1→1.025 (~75% sensitivity reduction per gesture tick)"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-03-02T15:10:44Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
---

# Quick Task 2: Fix Zoom Center, Pan Bounds, Sensitivity — Summary

**One-liner:** PAD=2000 scroll-content replaces flexbox centering; applyZoom pivot math corrected to scroll-content coordinates; clampScroll prevents blank-canvas pan; trackpad pinch reduced from 1.1 to 1.025 factor.

## What Was Done

Unified the zoom/pan system in `editor.html` around a PAD-based scroll container approach (similar to Figma's infinite canvas pattern). The old `#zoom-outer` flexbox centering caused a fundamental conflict: flexbox can't center an element that's also a scrollable content region.

### Architecture Change

Before:
```
#canvas-area (overflow:auto)
  └── #zoom-outer (display:flex; align-items:center; justify-content:center)
       └── #zoom-container (position:relative; transform-origin:top left)
```

After:
```
#canvas-area (overflow:auto)
  └── #zoom-scroll-content (position:relative; width/height set by JS to 2*PAD+canvas)
       └── #zoom-container (position:absolute; left:PAD; top:PAD)
```

### Key Functions Added

**`centerCanvas()`** — Called after `initCanvases()`. Sets scroll-content dimensions to `2*PAD + canvas*zoom` in both axes, positions zoom-container at `(PAD, PAD)`, then scrolls the area so the canvas center aligns with the viewport center.

**`clampScroll(area)`** — Enforces a minimum of 100px canvas visibility on all sides. Computed as: `minX = PAD - viewportW + min(canvasW, 100)`. Prevents the user from scrolling to pure white/empty space.

**`applyZoom()` (rewritten)** — Correct pivot math:
1. Resize scroll-content for new zoom level
2. Compute pivot position in scroll-content coords: `px = scrollLeft + pxInArea`
3. Map to canvas coords: `canvas_x = (px - PAD) / oldZoom`
4. Compute new scroll: `new_scrollLeft = canvas_x * newZoom + PAD - pxInArea`
5. Apply `clampScroll` after

**Wheel handler** — Pinch sensitivity: `factor = 1.025` (was `1.1`). Pan branch now calls `clampScroll` after updating scroll position.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | 重构 HTML + CSS — 移除 zoom-outer，建立 PAD 滚动容器 | 43e97ae | editor.html (CSS + HTML) |
| 2 | 修复 JS — PAD 常量 + centerCanvas + clampScroll + applyZoom 修正 | f10ea8c | editor.html (JS) |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `#zoom-scroll-content` exists in HTML: `grep -n "zoom-scroll-content" editor.html` returns 3 lines
- [x] `#zoom-outer` fully removed: `grep -n "zoom-outer" editor.html` returns empty
- [x] `PAD = 2000` defined before `applyZoom`
- [x] `clampScroll` called in both `applyZoom` and wheel pan handler
- [x] `centerCanvas()` called at end of `initCanvases()`
- [x] Commits verified: `43e97ae` (Task 1), `f10ea8c` (Task 2)

## Self-Check: PASSED
