---
phase: 05-selection-tools
plan: "01"
subsystem: ui
tags: [canvas, selection, marching-ants, marquee, pixel-art, javascript]

# Dependency graph
requires:
  - phase: 03-core-tools
    provides: tools object pattern, EditorState, canvas setup, pointer event dispatch
provides:
  - EditorState.selectionMask (Uint8Array per-pixel mask)
  - setSelection/clearSelection/updateSelectionUI helpers
  - rebuildAntsPath/drawAnts/scheduleAnts marching-ants animation
  - Rectangle Marquee tool (M key) with grid-snap and Shift-union
  - Deselect and Inverse buttons in top-bar (display:none until selection active)
  - invertSelection() stub for Plan 03 to replace
affects:
  - 05-02-magic-wand (uses selectionMask, setSelection, unionMasks, isSelectedPixel)
  - 06-transform (uses selectionMask for move/scale/rotate target region)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-pixel Uint8Array mask (not rect-only) for selections — enables arbitrary wand shapes"
    - "Path2D cached from mask; only lineDashOffset animates per RAF frame — O(1) animation update"
    - "clearSelection() must cancel RAF via antsRafId guard — prevents leaked animation after deselect"
    - "selectionMask=null means no selection (all pixels writable); selectionMask with all-1 is full-canvas select"

key-files:
  created: []
  modified:
    - editor.html

key-decisions:
  - "[05-01]: selectionMask is a flat Uint8Array (not 2D array) for O(1) pixel-index access without multiplication overhead per lookup"
  - "[05-01]: Path2D rebuilt on setSelection, not on every RAF frame — only antsDashOffset changes per frame"
  - "[05-01]: invertSelection() added as stub here (Plan 03 will replace) — wired to btn-inverse button now"
  - "[05-01]: clearSelection() does NOT call setActiveTool — tool stays marquee after deselect"
  - "[05-01]: Zero-size marquee click (no drag) calls clearSelection() instead of setSelection(empty)"

patterns-established:
  - "Marching ants: Path2D built from boundary pixel edges (4-direction check per selected pixel), not simple rect outline"
  - "Shift-union: unionMasks(existingMask, newMask) creates new Uint8Array OR result; existing mask unchanged"
  - "snapToGrid: rounds to nearest gridSize multiple; falls back to v unchanged when gridSize <= 1"
  - "isSelectedPixel(x,y): returns true when no selection (all writable), false when pixel outside mask"

requirements-completed: [SEL-01, SEL-02]

# Metrics
duration: 5min
completed: 2026-03-03
---

# Phase 05 Plan 01: Selection Tools Summary

**Per-pixel Uint8Array selection mask + marching-ants RAF animation + Rectangle Marquee tool with grid-snap and Shift-union support**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-03T07:53:52Z
- **Completed:** 2026-03-03T07:58:xx Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added `EditorState.selectionMask` (Uint8Array per-pixel) and `toolOptions.wandContiguous` to EditorState
- Implemented complete selection data model: `setSelection`, `clearSelection`, `updateSelectionUI`, `isSelectedPixel`, `unionMasks`, `computeBoundingBox`
- Implemented marching-ants animation system: `rebuildAntsPath` (Path2D from boundary edges), `drawAnts` (RAF loop), `scheduleAnts` (restart guard)
- Implemented Rectangle Marquee tool (M key) with grid-snap, animated drag preview, Shift-union, zero-size deselect
- Added Deselect (btn-deselect) and Inverse (btn-inverse) buttons in top-bar, hidden until selection is active
- Added M and W keyboard shortcuts; enabled Marquee and Wand buttons in right sidebar
- Added `tool-settings-marquee` and `tool-settings-wand` panels in top-bar; wand tolerance/contiguous inputs wired
- Set cursor style per tool in `setActiveTool`: crosshair for marquee/wand/eyedropper, none for pencil/eraser/bucket

## Task Commits

1. **Task 1: Selection data model + HTML scaffolding** - `04e5b52` (feat)
2. **Task 2: Rectangle Marquee tool implementation** - `23ae3a1` (feat)

## Files Created/Modified
- `/Users/calling/perfectPixel_ver1.1/editor.html` - Selection infrastructure + Rectangle Marquee tool added

## Decisions Made
- selectionMask stored as flat Uint8Array (not 2D) — O(1) pixel lookup via `x + y * width` indexing
- Path2D rebuilt once on `setSelection`, only `lineDashOffset` changes per RAF frame — avoids full path rebuild every 60fps
- `invertSelection()` stub added in Plan 01; btn-inverse wired now; Plan 03 will replace stub with real implementation
- Zero-size marquee click (no drag, width=0 or height=0) calls `clearSelection()` rather than setting empty selection

## Deviations from Plan

None — plan executed exactly as written. All 13 sub-steps from Task 1 and the full marquee implementation from Task 2 applied without deviation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Selection infrastructure is complete; Plan 05-02 (Magic Wand) can proceed immediately
- `isSelectedPixel(x,y)` helper ready for tools in Plans 05-02+ to respect selection boundaries
- `unionMasks()` ready for wand Shift-add behavior
- `invertSelection()` stub in place for Plan 03 keyboard shortcuts plan to replace

---
*Phase: 05-selection-tools*
*Completed: 2026-03-03*
