---
phase: 06-transform
plan: "05"
subsystem: ui
tags: [canvas, transform, rotation, cursor, pixel-art, RotSprite]

# Dependency graph
requires:
  - phase: 06-transform
    provides: hitTestHandle (number|null), tools.move onDown/onMove/onUp, _applyRotationPreview, _drawTransformUI

provides:
  - hitTestHandle now returns {type:'scale'|'rotate', handleIdx} | null — dual-mode handle zones
  - Corner handle outer ring (6-20px) triggers RotSprite rotation drag
  - tools.move.onCursor switches cursor: se-resize/nw-resize/etc for scale, crosshair for rotate zone
  - Relative-angle rotation drag with real-time Angle° input sync

affects:
  - phase 07-integration: rotation drag UX is complete; any future transform enhancements should extend hitTestHandle return type pattern

# Tech tracking
tech-stack:
  added: []
  patterns:
    - hitTestHandle dual-zone: inner ±6px = scale, outer 6~20px corners only = rotate
    - Relative-angle rotation drag: refAngle captured at pointerdown, deltaDeg accumulated on move
    - onCursor receives raw PointerEvent as 3rd arg for client-space hit testing

key-files:
  created: []
  modified:
    - editor.html

key-decisions:
  - "[06-05]: hitTestHandle INNER=6 (scale zone) OUTER=20 (rotate outer ring) — separates click target from hover target"
  - "[06-05]: onCursor(x, y, e) signature extended with PointerEvent 3rd arg — required for client-coord hit testing in cursor logic"
  - "[06-05]: _selCanvasPointerDown rotate branch delegates to tools.move.onDown(0,0,e) — avoids code duplication"
  - "[06-05]: Rotation center computed as selection center in client coords from pixelCanvas.getBoundingClientRect()"

patterns-established:
  - "Dual-mode handle zones: INNER box = primary action, OUTER ring = secondary action (corners only)"
  - "Raw PointerEvent passed to onCursor for tools that need client coordinates"

requirements-completed: [XFM-02, XFM-03, XFM-04, XFM-05]

# Metrics
duration: 2min
completed: 2026-03-04
---

# Phase 6 Plan 05: Corner Handle Dual-Mode (Scale / RotSprite) + Verification Summary

**Corner handles now support scale (inner ±6px) and RotSprite rotation (outer 6-20px ring) with live crosshair cursor and real-time Angle° sync**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T21:21:13Z
- **Completed:** 2026-03-03T21:24:00Z
- **Tasks:** 2 (Task 3 is checkpoint — awaiting human verification)
- **Files modified:** 1

## Accomplishments
- hitTestHandle extended from returning `number|null` to `{type:'scale'|'rotate', handleIdx}|null` — all call sites updated
- Corner handles (TL/TR/BL/BR) now have outer rotation zone (6-20px from center) showing crosshair cursor
- Relative-angle rotation drag: pointerdown records refAngle, pointermove accumulates delta and calls _applyRotationPreview()
- Angle° input in top bar syncs in real-time during rotation drag

## Task Commits

Each task was committed atomically:

1. **Task 1+2: hitTestHandle dual-mode + cursor + rotation drag** - `5400900` (feat)

_Note: Tasks 1 and 2 were implemented in a single commit as the code changes were interleaved (both modify the same function bodies)._

**Plan metadata:** TBD (docs commit after checkpoint)

## Files Created/Modified
- `/Users/calling/perfectPixel_ver1.1/editor.html` - hitTestHandle extended; _selCanvasPointerDown updated; tools.move.onDown/onMove/onCursor updated; pointermove passes e to onCursor

## Decisions Made
- hitTestHandle INNER=6 / OUTER=20: provides clear visual separation between scale (click on handle box) and rotate (click slightly outside handle box) without requiring modifier keys
- onCursor signature extended to `(x, y, e)`: the raw PointerEvent is needed for client-coord hit testing — other tools ignore the extra arg safely
- `_selCanvasPointerDown` rotate branch delegates to `tools.move.onDown(0,0,e)` to avoid duplicating the rotation initialization logic
- Rotation center is selection center in client coords (pixRect.left + center * ps): correct for all zoom levels because getBoundingClientRect() reflects CSS transform

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - implementation was straightforward given existing infrastructure from Plans 06-01 through 06-04.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Task 3 (human verification checkpoint) is pending — see CHECKPOINT REACHED message below
- Phase 6 feature implementation complete pending verification
- Phase 7 (Integration) ready to begin after checkpoint passes

---
*Phase: 06-transform*
*Completed: 2026-03-04*
