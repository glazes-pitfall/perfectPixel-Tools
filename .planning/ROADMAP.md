# Roadmap: PerfectPixel Ver 1.2

## Overview

Ver 1.2 adds a full browser-based pixel art editor (`editor.html`) to the existing Ver 1.1 grid-alignment pipeline. The build follows a strict technical dependency chain: the pixel buffer and coordinate system (Foundation) must be correct before History, which must exist before Core Tools, which must be stable before Selection, which Selection must precede Transform. Canvas Config and the Integration handoff from Ver 1.1 close out the release once all editor capabilities are verified. Every phase delivers a coherent, independently testable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Editor page structure, pixel buffer, coordinate system, and zoom infrastructure
- [ ] **Phase 2: History** - Snapshot-based undo/redo covering all editor operations
- [ ] **Phase 3: Core Tools** - Pencil, Eraser, Paint Bucket tools with integrated color picker
- [ ] **Phase 4: Palette Panel** ⟋ **(parallel with Phase 5)** - Palette swatch integration with bidirectional color picker sync
- [ ] **Phase 5: Selection Tools** ⟋ **(parallel with Phase 4)** - Rectangle Marquee and Magic Wand with animated marching ants
- [ ] **Phase 6: Transform** - Move, 8-handle scale, and RotSprite rotation on selections
- [ ] **Phase 7: Integration** - Canvas Size tool, Open-in-Editor entry point, and download/save wiring

## Phase Details

### Phase 1: Foundation
**Goal**: The editor page loads, displays an image at pixel-accurate zoom, and every tool can read/write pixels using a stable coordinate system
**Depends on**: Nothing (first phase)
**Requirements**: UI-01, UI-02, CANVAS-01, CANVAS-02
**Success Criteria** (what must be TRUE):
  1. `editor.html` opens in the browser and renders a placeholder pixel art image in the central canvas with no blurring or interpolation
  2. User can zoom in and out on the canvas; pixel coordinates reported by the editor remain 1:1 with image coordinates at every zoom level
  3. The 4-panel layout (left bar, central canvas, right toolbox, top bar) is visible and structurally complete, matching the Ver 1.1 dark theme
  4. Clicking any pixel on the canvas returns the exact RGBA value from `EditorState.pixels` (not from the canvas element), confirming premultiplied-alpha isolation is in place
**Plans**: TBD

### Phase 2: History
**Goal**: Every drawing and editing action can be undone and redone without data loss
**Depends on**: Phase 1
**Requirements**: HIST-01, HIST-02
**Implementation note**: Phase 2 delivers only the undo/redo infrastructure (`pushHistory()` / `undo()` / `redo()`). Since no real tools exist yet, a temporary test scaffold — a canvas click listener that calls `pushHistory()` + `setPixel()` — is added solely to make the success criteria verifiable. This scaffold is removed at the start of Phase 3.
**Success Criteria** (what must be TRUE):
  1. Clicking on the canvas three times (via the temporary scaffold) produces three distinct pixel changes; pressing Cmd+Z three times restores the canvas to its exact pre-edit state
  2. After undoing, pressing Shift+Cmd+Z re-applies the actions in order
  3. Undo and redo buttons are visible and active in the top bar at all times
  4. Each canvas click counts as exactly one undo step (confirmed by verifying the history stack length equals the number of clicks)
**Plans**: TBD

### Phase 3: Core Tools
**Goal**: User can draw, erase, and flood-fill pixels on the canvas, selecting colors with the permanent color picker
**Depends on**: Phase 2
**Requirements**: DRAW-01, DRAW-02, DRAW-03, DRAW-04, DRAW-05, DRAW-06, CLR-01, CLR-02, CLR-03, CLR-04
**Implementation note**: First task of this phase is to remove the Phase 2 temporary test scaffold (the canvas click listener used for history verification).
**Success Criteria** (what must be TRUE):
  1. The Phase 2 test scaffold (temporary click listener) has been removed from the codebase
  2. User can draw on the canvas with Pencil (B) using round or square brush shapes at any integer diameter from 1px up, and each stroke is one undo step
  3. User can erase pixels to transparency with Eraser (E) using the same brush options as Pencil
  4. User can flood-fill a bounded region with Paint Bucket (G) using adjustable tolerance and contiguous/non-contiguous mode
  5. The permanent color picker (bottom-left) lets the user set the active drawing color via HSL wheel, eyedropper click on the canvas, hex input, or RGB inputs — all four update the same active color
  6. Enabling Pixel-perfect mode on the Pencil visually removes the extra corner pixel that appears on diagonal strokes
**Plans**: TBD

### Phase 4: Palette Panel
**Goal**: The Ver 1.1 palette system is available inside the editor and stays in sync with the active drawing color
**Depends on**: Phase 3
**Requirements**: PAL-01, PAL-02
**Success Criteria** (what must be TRUE):
  1. Clicking a swatch in the palette panel immediately updates the color picker to that color, ready for drawing
  2. When the color picker's active color matches a palette swatch, that swatch displays a visible highlight border
  3. The palette panel can be collapsed and expanded without losing palette state
**Plans**: TBD

### Phase 5: Selection Tools
**Goal**: User can isolate a region of the canvas using Rectangle Marquee or Magic Wand, and drawing tools respect the selection boundary
**Depends on**: Phase 3 (runs in parallel with Phase 4)
**Requirements**: SEL-01, SEL-02, SEL-03, SEL-04, SEL-05
**Success Criteria** (what must be TRUE):
  1. Dragging Rectangle Marquee (M) on the canvas produces a selection that snaps to the detected pixel art grid, with a 1px animated marching-ants border visible during and after dragging
  2. Clicking Magic Wand (W) selects a region of similar-color pixels; Tolerance and Contiguous options visibly change the selection extent
  3. While a selection is active, pencil and eraser strokes are clipped to the selected region
  4. Pressing Cmd+D deselects; Shift+Cmd+I inverts the selection; both commands appear in the top bar while a selection is active
**Plans**: TBD

### Phase 6: Transform
**Goal**: User can move, scale, and rotate the contents of a selection using pixel-art-safe algorithms
**Depends on**: Phase 4 and Phase 5 (both must be complete)
**Requirements**: XFM-01, XFM-02, XFM-03, XFM-04, XFM-05
**Success Criteria** (what must be TRUE):
  1. With a selection active, Move Tool (V) lets the user drag selection contents to a new position; pixel distances from each canvas edge are displayed while dragging
  2. Eight transform handles appear around the active selection; dragging a handle scales the selection contents; X scale, Y scale, and a lock-aspect checkbox are editable in the top bar
  3. Rotating a selection using RotSprite produces pixel-art-quality results (no anti-aliasing artifacts); the rotation angle is editable in the top bar
  4. Pressing Enter applies a pending transform; pressing ESC cancels it and restores the original pixels; Apply and Cancel buttons are visible in the top bar during any active transform
**Plans**: TBD

### Phase 7: Integration
**Goal**: The editor is reachable from the Ver 1.1 pipeline, canvas dimensions can be adjusted, and all outputs can be downloaded
**Depends on**: Phase 6
**Requirements**: ENTRY-01, UI-03, CANVAS-03, CFG-01, CFG-02, CFG-03, CFG-04
**Success Criteria** (what must be TRUE):
  1. After running grid alignment in `web_ui.html`, clicking "Open in Editor" loads the aligned image in `editor.html` with grid metadata and palette carried over via sessionStorage
  2. Switching to Canvas Size (S) mode shows four reference lines on the canvas that update in real time as the user types new Width, Height, or L/R/T/B values
  3. Clicking Apply in Canvas Size mode produces a new canvas with the correct dimensions; existing pixel content is shifted to the correct position
  4. Precision and scaled-up download buttons below the central canvas produce correct output files
  5. After applying a palette in the editor, the palette mapping comparison image appears to the right of the canvas
**Plans**: TBD

## Progress

**Execution Order:**
1 → 2 → 3 → [4 ∥ 5] → 6 → 7
Phase 4 (Palette Panel) and Phase 5 (Selection Tools) run in parallel after Phase 3 completes.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/TBD | Not started | - |
| 2. History | 0/TBD | Not started | - |
| 3. Core Tools | 0/TBD | Not started | - |
| 4. Palette Panel | 0/TBD | Not started | - |
| 5. Selection Tools | 0/TBD | Not started | - |
| 6. Transform | 0/TBD | Not started | - |
| 7. Integration | 0/TBD | Not started | - |
