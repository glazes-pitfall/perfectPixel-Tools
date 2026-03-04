---
phase: 06-transform
plan: 02
subsystem: ui
tags: [canvas, transform, scale, nearest-neighbor, handle-drag]

# Dependency graph
requires:
  - phase: 06-transform plan 01
    provides: transformState infrastructure, _drawTransformUI, activateTransform, Move(V) tool
provides:
  - scaleNearestNeighbor(pixels, srcW, srcH, dstW, dstH) — NN resample with no quality degradation on repeated calls
  - hitTestHandle(clientX, clientY) — returns 0-7 handle index or null (12px hit zone)
  - 8-handle drawing in _drawTransformUI — TL/TC/TR/ML/MR/BL/BC/BR gray-purple 8x8px squares
  - tools.move handle drag — scales floatPixels via scaleNearestNeighbor, syncs top-bar
  - _applyScaleFromInputs — debounced 300ms input handler for opt-scale-x/y
  - Lock checkbox sync — modifying X auto-updates Y and vice versa
affects: [06-transform plan 03, phase 7 integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - _origFloatPixels snapshot at drag start — resample always from original, never from accumulated scaled result
    - hitTestHandle uses canvas-area relative coords, not viewport coords — consistent with _getSelCanvasCoords pattern
    - lockAspect: larger relative delta axis dominates for corner handles
    - Min scale 0.0625 (1/16) prevents dstW/dstH = 0 in scaleNearestNeighbor

key-files:
  created: []
  modified:
    - editor.html

key-decisions:
  - "_origFloatPixels captured at handle drag start (not at activation) — avoids quality degradation on repeated drags within same transform session"
  - "hitTestHandle hit zone 12px vs 8px visual — extra 4px margin for usability on small selections"
  - "scaleNearestNeighbor reads from _origFloatPixels || floatPixels fallback — safe for input-box scale before any handle drag"
  - "Lock checkbox uses one-way value sync (X→Y or Y→X) rather than triggering the other input event — prevents debounce recursion"

patterns-established:
  - "_origFloatPixels snapshot pattern: always resample from original source at drag start, not from last rendered frame"
  - "Handle drag mode: 'handle-N' string prefix, parsed with parseInt on split('-')[1]"

requirements-completed: [XFM-01, XFM-03, XFM-04]

# Metrics
duration: 3min
completed: 2026-03-04
---

# Phase 6 Plan 02: 8-Handle Scale System Summary

**Nearest-neighbor 8-handle bounding box scale for transform float layer — drag corners/edges to resize, top-bar X%/Y%/Lock inputs with 300ms debounce**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-04T19:11:34Z
- **Completed:** 2026-03-04T19:13:53Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added `scaleNearestNeighbor` (NN resample, no quality accumulation across drags)
- Added `hitTestHandle` with 12px hit zone for usability on small selections
- Modified `_drawTransformUI` to draw 8 gray-purple 8x8px handle squares (TL/TC/TR/ML/MR/BL/BC/BR)
- Rewrote `tools.move.onDown` to hit-test handles before starting move drag
- Added `tools.move.onMove` handle branch: corner = both axes, TC/BC = Y only, ML/MR = X only
- Added `_applyScaleFromInputs` with 300ms debounce for top-bar X%/Y% number inputs
- Lock checkbox: modifying X auto-syncs Y value (and vice versa) without recursive event loops

## Task Commits

Each task was committed atomically:

1. **Task 1: scaleNearestNeighbor + drawTransformHandles + hitTestHandle** - `defe6d3` (feat)
2. **Task 2: Handle drag scale logic + top-bar X%/Y%/Lock input bindings** - `770117e` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `editor.html` — scaleNearestNeighbor, hitTestHandle, 8-handle drawing in _drawTransformUI, tools.move onDown/onMove rewrite, _applyScaleFromInputs, scale input event bindings

## Decisions Made
- `_origFloatPixels` captured at drag start (not at activation) — if user drags handle A, releases, then drags handle B, B still resamples from the original activation pixels, preventing quality accumulation
- hitTestHandle hit zone 12px (HALF=6) vs 8px visual (HALF=4) — extra margin improves usability especially at lower zoom levels
- `_applyScaleFromInputs` falls back to `ts.floatPixels` if `_origFloatPixels` not yet set (no handle drag has happened) — safe for pure input-box workflows
- Lock checkbox uses one-way value copy (`.value =`) rather than dispatching an `input` event — prevents debounce timer recursion

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 8-handle scale system complete; XFM-01 and XFM-04 satisfied
- Plan 03 (RotSprite rotation) can now operate on already-scaled `floatPixels` from transformState
- `_origFloatPixels` snapshot pattern available for Plan 03 rotation (resample from pre-rotation pixels)

---
*Phase: 06-transform*
*Completed: 2026-03-04*
