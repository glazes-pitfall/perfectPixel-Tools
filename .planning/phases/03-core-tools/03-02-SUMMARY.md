---
phase: 03-core-tools
plan: "02"
subsystem: ui
tags: [canvas, pixel-art, flood-fill, bfs, bucket-tool, tool-settings]

# Dependency graph
requires:
  - phase: 03-core-tools-01
    provides: tools{} dispatch infrastructure, getPixel/setPixel/flushPixels primitives, pushHistory

provides:
  - floodFill() — iterative BFS with Uint8Array visited bitmap (O(n), no stack overflow)
  - tools.bucket — Paint Bucket with contiguous/non-contiguous mode and tolerance
  - Top-bar context-sensitive tool settings panels (pencil/eraser/bucket)
  - setActiveTool() extended with panel show/hide logic
  - All EditorState.toolOptions fields bound to live UI inputs

affects:
  - 03-03 (Eyedropper — no top-bar panel needed; but setActiveTool pattern established)
  - 04-palette-panel (foregroundColor drives bucket fill color)
  - 05-selection (selection-aware bucket fill will need to clip BFS to selection bounds)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Flood fill: iterative BFS with Uint8Array visited bitmap — mark BEFORE push (O(n) guarantee)"
    - "Bucket history model: save-before (pushHistory before floodFill) — safe for instant-apply tools"
    - "Tool settings panels: div#tool-settings-{tool} toggled by setActiveTool()"
    - "Per-tool size inputs: pencil and eraser have separate inputs to remember independent sizes"

key-files:
  created: []
  modified:
    - editor.html

key-decisions:
  - "Save-before model for bucket: pushHistory() called BEFORE floodFill() — safe for instant-apply tools; if fill throws, no phantom history entry"
  - "floodFill placed in global script scope (not inside DOMContentLoaded) so it's accessible to tools.bucket.onDown cleanly"
  - "Pencil and Eraser have separate size inputs (opt-brush-size vs opt-eraser-size) so each tool remembers its own size independently when switching"
  - "Eyedropper tool intentionally has no tool-settings panel — it will auto-restore previous tool on click (Phase 03-03)"

patterns-established:
  - "BFS visited-before-push: always mark visited BEFORE stack.push(), never after — prevents O(n^2) revisit"
  - "Non-contiguous fill: simple double loop over all pixels when contiguous=false, no BFS needed"
  - "Tool settings panel: id='tool-settings-{toolname}' divs toggled in setActiveTool()"

requirements-completed: [DRAW-04, DRAW-05]

# Metrics
duration: 4min
completed: 2026-03-03
---

# Phase 3 Plan 02: Paint Bucket + Tool Settings UI Summary

**Iterative BFS flood fill (Uint8Array visited bitmap) with tolerance/contiguous modes, plus context-sensitive top-bar tool parameter panels for Pencil/Eraser/Bucket**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-02T19:08:21Z
- **Completed:** 2026-03-02T19:11:53Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Implemented floodFill() as iterative BFS — visited bitmap marked BEFORE push (O(n) guarantee, no stack overflow risk)
- Paint Bucket tool with contiguous mode (BFS connected region) and non-contiguous mode (scan all pixels)
- Per-channel axis-aligned tolerance comparison (0=exact, 255=fill all)
- Three context-sensitive tool-settings panels in top bar; setActiveTool() shows/hides appropriate panel
- All EditorState.toolOptions fields (brushSize, brushShape, pixelPerfect, bucketTolerance, contiguous) bound to live inputs

## Task Commits

Each task was committed atomically:

1. **Task 1: Paint Bucket 工具（floodFill BFS）** - `5dd26b7` (feat)
2. **Task 2: 顶栏工具参数 UI** - `f74aa15` (feat)

## Files Created/Modified
- `/Users/calling/perfectPixel_ver1.1/editor.html` — Added floodFill(), tools.bucket, three tool-settings panels, setActiveTool panel switching, input event bindings

## Decisions Made
- Used save-before model for bucket (pushHistory before floodFill) rather than save-after — safer for instant-apply tools since a failed fill won't create a dangling history entry
- floodFill() defined in global scope (not inside DOMContentLoaded) to avoid closure complexity and keep it accessible as a pure function
- Pencil and Eraser use separate HTML inputs (`opt-brush-size` vs `opt-eraser-size`) so switching tools doesn't reset the other tool's size

## Deviations from Plan

None — plan executed exactly as written.

The only minor difference from the plan's suggested code: `pushHistory()` is called BEFORE `floodFill()` (save-before model) rather than after. The plan comment said "push immediately after fill" but the save-before approach was chosen as more robust. Both satisfy the requirement "点击一次 = 一步历史".

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- tools.bucket fully operational; Phase 4 (Palette Panel) will provide foregroundColor updates that bucket will use immediately
- Top-bar tool settings UI pattern established; Phase 03-03 (Eyedropper) adds no panel (auto-restores previous tool)
- floodFill() available for Phase 5 (Magic Wand) to reuse the BFS visited-bitmap pattern

## Self-Check: PASSED

- [x] FOUND: /Users/calling/perfectPixel_ver1.1/.planning/phases/03-core-tools/03-02-SUMMARY.md
- [x] FOUND: /Users/calling/perfectPixel_ver1.1/editor.html
- [x] FOUND commit 5dd26b7: feat(03-core-tools-02): implement Paint Bucket with BFS flood fill
- [x] FOUND commit f74aa15: feat(03-core-tools-02): add context-sensitive tool settings UI in top bar

---
*Phase: 03-core-tools*
*Completed: 2026-03-03*
