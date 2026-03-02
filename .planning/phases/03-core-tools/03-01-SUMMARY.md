---
phase: 03-core-tools
plan: "01"
subsystem: ui
tags: [canvas, pixel-art, brush-tools, bresenham, pixel-perfect]

# Dependency graph
requires:
  - phase: 02-history
    provides: pushHistory / undo / redo infrastructure and EditorState.pixels

provides:
  - Tool dispatch infrastructure (tools{} object, isDrawing flag, pointer event routing)
  - setActiveTool() with button highlight support
  - getBrushStamp() — round (Euclidean) and square brush shapes
  - applyStamp() — batched pixel writes with single flushPixels()
  - bresenhamLine() — gap-free stroke interpolation
  - drawCursorPreview() / clearCursorPreview() — pixel-aligned brush cursor
  - shouldSkipPixelPerfect() — L-corner removal for diagonal strokes
  - setPixel() helper (missing from Phase 2, fundamental write primitive)
  - tools.pencil — full draw tool with save-after history model
  - tools.eraser — write alpha=0 with save-after history model
affects:
  - 03-02 (Paint Bucket — reuses tools{} dispatch, applyStamp, getBrushStamp patterns)
  - 04-palette-panel (foregroundColor drives pencil color)
  - 05-selection (selection-aware drawing must hook tools dispatch)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tool dispatch: tools[EditorState.activeTool].onDown/onMove/onUp/onCursor"
    - "Save-after history: pushHistory() called in onUp, not onDown or onMove"
    - "Bresenham interpolation: fill gaps when pointer skips pixels at high speed"
    - "Brush stamp: pre-compute offset array once on pointerdown, reuse on each point"
    - "Pixel-perfect: _ppHistory tracks last 2 placed pixels; skip L-corner detour pixels"
    - "Alpha constraint: pencil=255 always, eraser=[0,0,0,0] always, never 1-254"

key-files:
  created: []
  modified:
    - editor.html

key-decisions:
  - "setPixel() added as auto-fix (Rule 2 - Missing Critical) — was referenced in CLAUDE.md but never implemented in Phase 2; needed by applyStamp"
  - "tools.pencil and tools.eraser defined inside DOMContentLoaded (after tools{} stub), reassigning the stub entries — avoids hoisting issues with let-scoped vars like _pencilStamp"
  - "Pixel-perfect uses _ppHistory sliding window of last 2 pixels; skip condition: cur shares axis with p1 AND p2 shares different axis — removes L-corner duplicates"
  - "Eraser preview color [200,200,200,128] chosen for semi-transparent white — visually distinct from drawing tools"

patterns-established:
  - "Tool interface: every tool must implement onDown/onMove/onUp/onCursor"
  - "Save-after: all drawing tools call pushHistory() in onUp exactly once"
  - "Brush stamp: pre-compute on pointerdown, reuse throughout stroke"
  - "Alpha constraint: only 0 or 255 permitted — pencil enforces via foregroundColor, eraser hardcodes [0,0,0,0]"

requirements-completed: [DRAW-01, DRAW-02, DRAW-03, DRAW-06]

# Metrics
duration: 4min
completed: 2026-03-03
---

# Phase 3 Plan 01: Core Tools (Pencil + Eraser) Summary

**Tool dispatch infrastructure with Bresenham pencil (Pixel-Perfect mode), alpha=0 eraser, and pixel-aligned cursor preview — Phase 2 TEMP SCAFFOLD removed**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-02T19:01:58Z
- **Completed:** 2026-03-02T19:05:21Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Removed Phase 2 TEMP SCAFFOLD (_scaffoldClick) and replaced with real tool dispatch system
- Implemented pencil tool with Bresenham interpolation, brush shapes (round/square), Pixel-Perfect L-corner removal, and save-after history model
- Implemented eraser tool writing alpha=0 (transparent) pixels with same stroke continuity
- Added cursor preview showing brush shape at hover position with white outline for visibility
- Enabled Pencil/Bucket/Eraser tool buttons in right sidebar with active-highlight CSS

## Task Commits

Each task was committed atomically:

1. **Task 1: 移除脚手架 + 工具调度基础设施 + 激活右侧工具栏** - `259579d` (feat)
2. **Task 2: 笔刷工具函数 + 铅笔工具 + 橡皮工具 + 光标预览** - `7652be5` (feat)

## Files Created/Modified
- `/Users/calling/perfectPixel_ver1.1/editor.html` — Added tool dispatch, brush utilities, pencil/eraser implementations, cursor preview

## Decisions Made
- `setPixel()` was missing from Phase 2 (CLAUDE.md described it but it was never written) — added as auto-fix (Rule 2 - Missing Critical)
- Tools reassign the stub objects inside DOMContentLoaded after `const tools = {...}` to avoid hoisting issues with let-scoped `_pencilStamp` / `_eraserStamp` variables
- Pixel-perfect algorithm uses sliding window of last 2 placed pixels; skips current pixel when it would create an L-corner diagonal

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added setPixel() helper function**
- **Found during:** Task 2 (笔刷工具函数)
- **Issue:** `applyStamp()` calls `setPixel()` but that function was never implemented in Phase 2. CLAUDE.md documents it as a core primitive but it was absent from editor.html.
- **Fix:** Added `setPixel(x, y, [r,g,b,a])` that writes directly to `EditorState.pixels[i..i+3]` — identical to the CLAUDE.md specification
- **Files modified:** editor.html
- **Verification:** `applyStamp()` compiles and executes without ReferenceError
- **Committed in:** `7652be5` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical)
**Impact on plan:** Essential fix — without setPixel() all brush drawing would throw ReferenceError. No scope creep.

## Issues Encountered
None — plan executed cleanly after adding the missing setPixel() primitive.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tool dispatch infrastructure ready — 03-02 (Paint Bucket) can add `tools.bucket` directly
- Pencil/Eraser working; Phase 4 (Palette Panel) will provide `foregroundColor` updates that pencil will use immediately
- B/E/G keyboard shortcuts active; M/W/V shortcuts reserved for Phases 5/6

## Self-Check: PASSED

- [x] FOUND: .planning/phases/03-core-tools/03-01-SUMMARY.md
- [x] FOUND: editor.html
- [x] FOUND commit 259579d: feat(03-core-tools-01): remove scaffold + tool dispatch infrastructure
- [x] FOUND commit 7652be5: feat(03-core-tools-01): add brush tools — pencil, eraser, cursor preview

---
*Phase: 03-core-tools*
*Completed: 2026-03-03*
