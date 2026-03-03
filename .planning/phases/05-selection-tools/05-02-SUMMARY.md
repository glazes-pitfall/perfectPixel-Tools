---
phase: 05-selection-tools
plan: "02"
subsystem: ui
tags: [editor, canvas, selection, magic-wand, marching-ants, bfs, flood-fill]

requires:
  - phase: 05-01
    provides: selectionMask Uint8Array, setSelection/clearSelection/unionMasks/computeBoundingBox helpers, marching-ants RAF animation, Rectangle Marquee tool

provides:
  - wandSelect() BFS flood-select returning Uint8Array mask (not painting pixels)
  - tools.wand: Magic Wand tool with contiguous and non-contiguous modes
  - Shift+click union with existing selection
  - invertSelection() full implementation (replaces Plan 01 stub)
  - Cmd+D keyboard shortcut for deselect
  - Shift+Cmd+I keyboard shortcut for inverse selection

affects: [06-transform, 05-03, 05-04]

tech-stack:
  added: []
  patterns:
    - "wandSelect mirrors floodFill BFS pattern: mark-before-push Uint8Array visited bitmap for O(n) guarantee"
    - "Wand tool is click-only — onMove/onUp are no-ops; no drag behavior needed"
    - "invertSelection: no-selection → select all; existing mask → bitwise NOT; full-canvas → clear"

key-files:
  created: []
  modified:
    - editor.html

key-decisions:
  - "[05-02]: wandSelect uses Uint8Array mask (same index scheme as selectionMask: x + y * W) for O(1) lookup compatibility with rebuildAntsPath"
  - "[05-02]: Shift+click union handles null existing mask — unionMasks(null, result.mask) falls back to result.mask only via OR logic"
  - "[05-02]: invertSelection with no selection selects all pixels (new Uint8Array(total).fill(1)) rather than no-op"
  - "[05-02]: Inverting a full-canvas selection → computeBoundingBox returns null → clearSelection() called"

patterns-established:
  - "Wand click-only pattern: onDown does work, onMove/onUp are empty no-ops"
  - "Selection inversion null check: guard against EditorState.selectionMask being null (no existing selection)"

requirements-completed: [SEL-03, SEL-04, SEL-05]

duration: 1min
completed: 2026-03-03
---

# Phase 5 Plan 02: Magic Wand + Inverse Selection Summary

**Magic Wand BFS flood-select with per-pixel Uint8Array mask, Shift+click union, and full invertSelection implementation completing the selection UI**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-03T10:23:03Z
- **Completed:** 2026-03-03T10:24:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Magic Wand tool (W key) with contiguous BFS and non-contiguous full-canvas scan modes
- Shift+click union merges new wand selection with existing selection mask
- invertSelection() fully implemented: no selection → select all; existing mask → bitwise NOT; full-canvas → clear
- Cmd+D keyboard shortcut → clearSelection()
- Shift+Cmd+I keyboard shortcut → invertSelection()
- btn-deselect and btn-inverse click listeners verified (Plan 01) and functional with full implementation

## Task Commits

Each task was committed atomically:

1. **Task 1: wandSelect function + Magic Wand tool implementation** - `2116a33` (feat)
2. **Task 2: Complete top-bar Deselect/Inverse button wiring** - `83ef6b5` (feat)

## Files Created/Modified
- `/Users/calling/perfectPixel_ver1.1/editor.html` - Added wandSelect() BFS function, tools.wand implementation, full invertSelection(), Cmd+D and Shift+Cmd+I keyboard shortcuts

## Decisions Made
- wandSelect uses the same Uint8Array mask indexing scheme (x + y * W) as selectionMask for direct compatibility with rebuildAntsPath() — no conversion needed
- Shift+click union: when EditorState.selectionMask is null, unionMasks handles it gracefully (OR with 0)
- invertSelection with no selection → fill(1) = select entire canvas; inverting full selection → bbox null → clearSelection

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Magic Wand tool complete with irregular marching-ants (from Plan 01's rebuildAntsPath)
- All selection helpers (setSelection, clearSelection, unionMasks, computeBoundingBox, invertSelection) fully implemented
- Ready for Phase 5 Plans 03 and 04 (if any) or Phase 6 Transform tools
- Phase 6 Move (V) tool can use EditorState.selectionMask directly for pixel-level move operations

---
*Phase: 05-selection-tools*
*Completed: 2026-03-03*
