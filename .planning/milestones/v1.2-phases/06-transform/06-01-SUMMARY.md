---
phase: 06-transform
plan: 01
subsystem: editor
tags: [transform, move-tool, selection, floating-model]
dependency_graph:
  requires: [phase-05-selection-tools]
  provides: [transformState-infrastructure, activateTransform, applyTransform, cancelTransform, tools.move]
  affects: [editor.html]
tech_stack:
  added: []
  patterns: [floating-model, offscreen-canvas-preview, iterative-pixel-write, distance-overlay]
key_files:
  modified: [editor.html]
decisions:
  - "[06-01]: tools.move assigned after tools dict init (inside DOMContentLoaded) — avoids hoisting issues"
  - "[06-01]: _drawTransformUI uses offscreen canvas + drawImage for float preview — safe (not getImageData read-back)"
  - "[06-01]: activateTransform snapshots originalPixels BEFORE erasing — required for ESC restore correctness"
  - "[06-01]: applyTransform calls pushHistory() once for entire compound transform — one undo step"
  - "[06-01]: cancelTransform restores originalPixels directly (no history push)"
  - "[06-01]: Escape key cancels transform only when activeTool !== eyedropper — avoids conflict"
metrics:
  duration: 4 minutes
  completed_date: "2026-03-03"
  tasks_completed: 1
  files_modified: 1
---

# Phase 6 Plan 01: Move Tool + Transform Infrastructure Summary

Move(V) tool with full floating model: selection content lifted on pointerdown, follows mouse in selCanvas preview, Apply writes to EditorState.pixels once, Cancel restores originalPixels without history.

## What Was Built

### New Functions (all in editor.html, inside DOMContentLoaded)

| Function | Location (approx) | Purpose |
|----------|-------------------|---------|
| `_getSelCanvasCoords()` | ~2803 | Returns `{originX, originY, ps}` for selCanvas CSS coordinates |
| `activateTransform()` | ~2808 | Snapshots pixels, extracts floatPixels, erases selection, inits transformState |
| `_drawTransformUI()` | ~2868 | Clears selCanvas, renders float preview, draws static dashed border |
| `_showTransformTopBar()` | ~2899 | Shows #tool-settings-move panel, syncs input values |
| `_hideTransformTopBar()` | ~2913 | Hides #tool-settings-move panel |
| `_hideDistanceLabel()` | ~2918 | Hides #transform-distance-label overlay |
| `_updateDistanceLabel()` | ~2923 | Computes left/top/right/bottom distances, positions overlay |
| `applyTransform()` | ~2944 | pushHistory + write floatPixels to EditorState.pixels + clearSelection |
| `cancelTransform()` | ~2969 | Restore originalPixels + clearSelection (no history push) |
| `tools.move` | ~2983 | onDown/onMove/onUp handlers for floating model drag |

### HTML Changes

1. **#tool-settings-move panel** (line ~637): X%/Y% scale inputs, Lock checkbox, Angle° input, Apply/Cancel buttons
2. **Move button** (line ~838): removed `disabled`, added `data-tool="move"`
3. **#transform-distance-label** (line ~884): `position:fixed` overlay before `<script>` tag
4. **setActiveTool panelIds**: added `'tool-settings-move'` to show/hide array
5. **setActiveTool cursor**: added `move` branch → `cursorCanvas.style.cursor = 'move'`
6. **Keyboard shortcuts**: added `V` for Move tool, `Enter` for applyTransform, `Escape` for cancelTransform
7. **Shortcut modal**: added "移动 V" row to tool section

## Implementation Details

### Floating Model Flow

1. `tools.move.onDown` → `activateTransform()` → snapshot `originalPixels`, extract `floatPixels` (masked copy), erase selected pixels, stop ants RAF, set `transformState`
2. `_drawTransformUI()` → clear selCanvas, drawImage float content preview (via offscreen canvas), draw dashed border
3. `tools.move.onMove` → compute `dx/dy` from `(e.clientX - _dragStartClientX) / ps`, set `floatX/floatY`, redraw UI + distance label
4. `Enter` / Apply button → `applyTransform()` → pushHistory, pixel loop with bounds clip, flushPixels, clearSelection
5. `Escape` / Cancel button → `cancelTransform()` → restore originalPixels, flushPixels, clearSelection (no history)

### selCanvas Coordinate System

selCanvas covers the entire canvas-area (not inside zoom-container). Drawing uses CSS coordinates:
```
originX = pixelCanvas.getBoundingClientRect().left - canvas-area.getBoundingClientRect().left
ps      = pixelCanvas.getBoundingClientRect().width / EditorState.width
// canvas coord (cx,cy) → CSS coord: originX + cx*ps
```

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

- FOUND: editor.html (modified, 3492 lines)
- FOUND: commit 2376ffc (feat(06-01): Move(V) tool + transform infrastructure + distance label)
- FOUND: tools.move (2 occurrences), activateTransform (2), applyTransform (3), cancelTransform (3)
- FOUND: transform-distance-label (3 occurrences), data-tool="move" (1 occurrence)

## Self-Check: PASSED
