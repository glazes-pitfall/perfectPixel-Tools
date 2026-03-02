# Project Research Summary

**Project:** PerfectPixel Ver 1.2 — Browser-Based Pixel Art Editor
**Domain:** Vanilla JS pixel art editor, Canvas API, Flask backend
**Researched:** 2026-03-02
**Confidence:** HIGH

## Executive Summary

PerfectPixel Ver 1.2 adds a full browser-based pixel art editor (`editor.html`) on top of the existing Ver 1.1 grid-alignment pipeline. The editor is a single HTML file with no build step, served by Flask at `/editor`, implemented entirely with native browser APIs: HTML5 Canvas, Pointer Events, and sessionStorage. Experts build pixel art editors this way — the Canvas `getImageData`/`putImageData` API with a persistent `Uint8ClampedArray` canonical pixel buffer is the only viable approach for flood fill, magic wand, pixel-perfect pencil, and RotSprite rotation. Three stacked canvas elements (pixel / selection / cursor layers) prevent redraw jank by isolating update frequencies. All zoom is handled via CSS `transform: scale()` on the container — never via canvas transform matrix, which breaks all pixel data operations.

The recommended approach is a 7-phase build order based on hard architectural dependencies: Foundation (pixel buffer + coordinate system) must precede History (undo/redo), which must precede Core Tools (pencil/eraser/bucket), which must precede Selection Tools (marquee/wand), which must precede Transform (move/scale/RotSprite). The highest-complexity deliverable is the RotSprite rotation algorithm — a JavaScript reimplementation of Aseprite's Scale2x-upscale + nearest-neighbor-rotate + downsample pipeline verified against Aseprite's C++ source. RotSprite is explicitly required (not optional) by the project requirements for non-orthogonal rotation of pixel art selections.

The top risks are all architectural and must be addressed in Phase 1: premultiplied alpha corruption (never read pixels from the canvas — always from `EditorState.pixels`), wrong devicePixelRatio application (pixel canvas must NOT be DPR-scaled; only overlay canvases are), and missing `willReadFrequently: true` on the pixel canvas context (causes severe performance degradation for all read-heavy operations). Getting these three right in Phase 1 prevents rework across every subsequent phase. The secondary risk is RotSprite memory pressure for large selections — mitigated by enforcing a 128×128 pixel selection size limit with a user-visible warning.

## Key Findings

### Recommended Stack

The full editor runs with zero new dependencies. The existing Flask + Pillow + OpenCV stack is reused as-is. All editor logic is native browser JavaScript — no npm, no build step, no external JS frameworks. The editor is served as a single `editor.html` file from a new Flask route.

**Core technologies:**
- HTML5 Canvas 2D API (`getImageData`, `putImageData`, `ImageData`, `Uint8ClampedArray`): pixel buffer rendering — the only viable API for direct per-pixel manipulation in vanilla JS
- Pointer Events API (`pointerdown`, `pointermove`, `pointerup`, `setPointerCapture`): unified input across mouse, touch, and stylus; `setPointerCapture` keeps events firing when pointer leaves canvas during a stroke
- CSS `transform: scale()` on canvas container div: handles all zoom/pan without touching canvas coordinate system — mandatory because `getImageData`/`putImageData` ignore canvas transform matrix
- `requestAnimationFrame`: all canvas animation (marching ants, cursor preview) must use RAF loops, never `setInterval`
- `sessionStorage`: handoff of image base64 + grid metadata + palette from `web_ui.html` to `editor.html` without a Flask round-trip
- `willReadFrequently: true` on pixel canvas context: forces software rendering path, making `getImageData` fast for flood fill / magic wand / eyedropper / pixel-perfect checks
- `image-rendering: pixelated` CSS on all canvases: prevents browser from antialiasing the zoomed display

**Critical version notes:** `willReadFrequently` requires Chrome 96+, Firefox 107+, Safari 15.4+. All are safe for a 2026 deployment.

### Expected Features

**Must have (P1 — table stakes for a functional editor):**
- Pencil tool (B) — basic 1px+ drawing, pointerdown/move
- Eraser tool (E) — draws transparent pixels, shares Pencil brush system
- Paint Bucket (G) with tolerance + contiguous — iterative BFS flood fill, not recursive
- Undo / Redo (Cmd+Z / Shift+Cmd+Z) — snapshot-based, push once per discrete action (not per pixel)
- Color picker (HSL wheel + hex/RGB inputs) + palette swatch sync
- Rectangle Marquee (M) with grid-snap — snaps selection bounds to detected pixel art grid
- Magic Wand (W) with tolerance + contiguous — shares BFS core with Paint Bucket
- Move Tool (V) — translates selection contents with pixel offset display
- 8-handle transform + RotSprite rotation — explicitly required; the project's key differentiator
- Canvas Size (S) with 4-reference-line preview — required per project requirements
- "Open in Editor" button in web_ui.html — sessionStorage handoff from Ver 1.1 pipeline

**Should have (P2 — add after core validation):**
- Pixel-perfect pencil mode — 3-point L-shape removal algorithm from Aseprite source
- Brush size > 1px with round/square shape options
- Non-contiguous fill / wand mode
- Grid overlay display
- Eyedropper via Alt+click without switching tools

**Defer (P3 — v2+):**
- Layer system — explicitly out of scope in project requirements; massive complexity multiplier for every tool
- Animation frames / timeline — out of scope; users directed to Aseprite
- Server-side palette persistence — localStorage sufficient for Ver 1.2

### Architecture Approach

The editor is a 4-panel layout (`editor.html`) kept separate from `web_ui.html` to avoid merging incompatible layouts into an already 51K-line file. A single `EditorState` object is the canonical source of truth for all state: pixel buffer (`Uint8ClampedArray`), history stack, active tool, selection bounds, palette, grid metadata, and tool options. Components read/write only through `EditorState`; a minimal 20-line pub/sub pattern (`EditorState.on`/`EditorState.emit`) handles change notifications. DOM is write-only — it renders from state, never holds canonical values. The Flask integration adds one new route (`/editor`) and optionally one new endpoint (`/api/editor/save`); three existing palette endpoints are reused without modification.

**Major components:**
1. `EditorState` — single source of truth: pixels, history, tool state, selection, palette
2. Three-canvas layer stack (pixel / selection / cursor) — isolation of update frequencies
3. `ToolController` + tool objects (`pencil`, `eraser`, `bucket`, `wand`, `marquee`, `move`) — each tool is a plain object with `onDown`/`onMove`/`onUp`/`onCursor` methods
4. `HistoryManager` — snapshot-based undo/redo using `Uint8ClampedArray.slice()`; 50-entry ring buffer
5. `SelectionManager` — marching ants RAF loop + 8 transform handles; hit-testing in screen coordinates
6. `PalettePanel` — ported from `web_ui.html`; palette state moved to `EditorState.palette`
7. `ColorPicker` — permanent bottom-left panel, HSL wheel, syncs bidirectionally with palette swatches
8. Flask `/editor` route + optional `/api/editor/save` — minimal new backend surface

**Build order dependency chain:**
```
Foundation (State + Canvas + Coordinates)
  → History (requires pixel buffer)
    → Core Tools (requires history for undo)
      → Palette Panel (requires foreground color from state)
        → Selection Tools (requires tools to be selection-aware)
          → Transform (requires selections)
            → Integration (requires everything)
```

### Critical Pitfalls

1. **Premultiplied alpha corruption on `getImageData` round-trip** — browsers store canvas data in premultiplied alpha format internally; calling `getImageData` after `putImageData` can return corrupted RGBA values for semi-transparent pixels. Prevention: never read pixels from the canvas; always read from `EditorState.pixels` directly. This must be established in Phase 1 — retrofitting requires touching every tool.

2. **DevicePixelRatio applied to the wrong canvas layer** — applying DPR to the pixel canvas destroys the 1:1 pixel-to-image-coordinate mapping and breaks all tool coordinate math. Prevention: pixel canvas must NOT be DPR-scaled (canvas dimensions = image dimensions exactly); only cursor and selection canvases use DPR scaling for crisp overlay rendering. Must be correct from Phase 1 canvas setup.

3. **`willReadFrequently` missing on pixel canvas** — without this flag, every `getImageData` call triggers an expensive CPU-GPU readback, causing 5-20ms lag per eyedropper click and making flood fill sluggish. Prevention: set `willReadFrequently: true` on the first `getContext('2d')` call for the pixel canvas; it cannot be set retroactively.

4. **RotSprite 8x buffer memory pressure** — a 256×256 selection generates ~36MB of intermediate buffers synchronously, freezing the browser. Prevention: enforce a 128×128 pixel hard limit on selections before invoking RotSprite; show a spinner; use `setTimeout(0)` between Scale2x passes for the 64–128px range.

5. **Undo history filled by pointer move events** — pushing `pushHistory()` on `pointermove` instead of `pointerdown` generates 200 undo steps per stroke, making undo useless after a single stroke. Prevention: track `strokeInProgress` boolean; push history exactly once in `pointerdown`.

6. **Flood fill without visited bitmap revisits pixels** — naive BFS without a `Uint8Array` visited tracking causes O(n^2) performance and potential OOM on large uniform areas. Prevention: mark pixels visited before pushing to the stack; use `push`/`pop` (O(1)) not `push`/`shift` (O(n)) on the stack array.

## Implications for Roadmap

Based on combined research across all four files, the following 7-phase structure is strongly recommended. The ordering is determined by hard technical dependencies — no phase can begin until its predecessors are complete.

### Phase 1: Foundation
**Rationale:** Every subsequent phase depends on the pixel buffer, coordinate system, and canvas initialization being correct. Getting these wrong requires rework across all tools. The three most critical pitfalls (premultiplied alpha, DPR, willReadFrequently) must all be addressed here.
**Delivers:** A working canvas that can display an image loaded from sessionStorage, with pixel-accurate click coordinates at all zoom levels, and the `EditorState` data model fully defined.
**Addresses:** EditorState initialization, 3-canvas layer setup with correct DPR handling, `viewportToCanvas()` coordinate conversion, `setPixel`/`getPixel`/`flushPixels` helpers, basic zoom/pan via CSS transform.
**Avoids:** Pitfall 1 (premultiplied alpha), Pitfall 2 (DPR on wrong canvas), Pitfall 7 (coordinate conversion with zoom), Pitfall 8 (willReadFrequently missing).

### Phase 2: History
**Rationale:** Every drawing tool needs undo support from day one. Adding history after tools are built requires retrofitting every tool to call `pushHistory()` correctly, which is error-prone.
**Delivers:** Functional Cmd+Z / Shift+Cmd+Z undo/redo with snapshot-based history; undo/redo buttons in top bar.
**Implements:** `pushHistory()`/`undo()`/`redo()` using `Uint8ClampedArray.slice()` snapshots, 50-entry ring buffer, stroke boundary tracking.
**Avoids:** Pitfall 5 (undo push on every pointermove).

### Phase 3: Core Tools
**Rationale:** Pencil, Eraser, and Paint Bucket are the fundamental drawing primitives. They share the pixel buffer infrastructure from Phase 1 and the undo system from Phase 2. Magic Wand BFS core is implemented here (shared with bucket) before Selection in Phase 5.
**Delivers:** Working pencil (1px), eraser (transparent), flood fill (iterative BFS with tolerance + contiguous), tool options bar (brush size, shape, tolerance), color picker panel.
**Addresses:** Pencil, Eraser, Paint Bucket (P1 features), Tool Options Bar, Color Picker.
**Avoids:** Pitfall 4 (flood fill visited bitmap), Pitfall 11 (pixel-perfect stroke mask).

### Phase 4: Palette Panel
**Rationale:** Palette integration depends on the color picker (Phase 3) being in place. Palette state is ported from `web_ui.html` before selection tools (Phase 5) need color state to be stable.
**Delivers:** Palette swatch grid, bidirectional sync between palette clicks and color picker, localStorage persistence; `EditorState.palette` as canonical palette state.
**Addresses:** Palette swatch integration, active swatch highlight, foreground color sync.
**Avoids:** Anti-Pattern: palette state must move from `web_ui.html` module closure into `EditorState.palette`.

### Phase 5: Selection Tools
**Rationale:** Selection tools depend on the pixel buffer (Phase 1), core tools being selection-aware (Phase 3), and palette color state being stable (Phase 4). Marching ants animation requires careful RAF loop management.
**Delivers:** Rectangle Marquee with grid-snap, animated marching ants border, Magic Wand with tolerance + contiguous, Deselect (Cmd+D), selection-clipped drawing for pencil/eraser.
**Addresses:** Rectangle Marquee (P1), Magic Wand (P1), Marching Ants animation.
**Avoids:** Pitfall 10 (marching ants RAF loop not cancelled), grid-snap producing confusing selections on large grids.

### Phase 6: Transform
**Rationale:** Transform depends on active selections from Phase 5. RotSprite is the highest-complexity deliverable and should be implemented last among the core features so that simpler move/scale is verified before adding the rotation algorithm.
**Delivers:** Move Tool with pixel-offset display and arrow-key nudge; 8-handle scale + RotSprite rotation with Apply/Cancel context bar; Transform handles with screen-coordinate hit-testing at all zoom levels.
**Addresses:** Move Tool (P1), 8-handle transform (P1), RotSprite rotation (P1 — required differentiator).
**Avoids:** Pitfall 3 (RotSprite memory — enforce 128×128 limit), Pitfall 6 (Scale2x alpha equality), Pitfall 12 (handle hit-test at high zoom).

### Phase 7: Canvas Config and Integration
**Rationale:** Canvas Size and the "Open in Editor" sessionStorage handoff are the last pieces; they depend on a fully functional editor from Phases 1-6.
**Delivers:** Canvas Size tool with 4-reference-line preview; "Open in Editor" button in `web_ui.html`; sessionStorage handoff with quota fallback; Download buttons (exact + scaled); Flask `/editor` route + `/api/editor/save` endpoint.
**Addresses:** Canvas Size (P1), "Open in Editor" button (P1), Download/export.
**Avoids:** Pitfall 9 (sessionStorage quota exceeded for large images), Flask integration gotchas (always use `INTER_NEAREST` for scaled download).

### Phase Ordering Rationale

- Foundation before everything because premultiplied alpha and DPR mistakes require global rework if discovered late — they touch every tool coordinate and every pixel read
- History before tools because retrofitting undo into existing tools is error-prone; every tool must call `pushHistory()` correctly on its first use
- Core tools before selection because selection-aware drawing (pencil/eraser respecting selection bounds) requires the tools to already exist
- Palette before selection because selection tools need stable color state for magic wand tolerance comparisons
- Selection before transform because the 8-handle transform system is the UI representation of the selection — it cannot exist without a selection
- Transform last among core features because RotSprite is the highest-risk algorithm; all simpler features should be verified before it is integrated
- Canvas Config and Integration last because it wraps everything else; the sessionStorage handoff has no value until the editor itself is functional

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 6 (Transform):** RotSprite JS reimplementation has MEDIUM confidence — algorithm logic is verified from Aseprite C++ source but JavaScript pixel-index arithmetic and edge handling at boundary pixels needs careful testing. Write unit tests for Scale2x, then RotSprite, before integrating into the transform UI. Plan for iteration.
- **Phase 7 (Integration — sessionStorage fallback):** The Flask token-based fallback for large images (> sessionStorage quota) has no reference implementation in the codebase. Needs explicit design before Phase 7 begins.

Phases with well-established patterns (skip research-phase):
- **Phase 1 (Foundation):** Canvas setup, DPR handling, `willReadFrequently`, coordinate conversion — all HIGH confidence from MDN official docs, stable APIs since 2015+.
- **Phase 2 (History):** Snapshot-based undo/redo with `Uint8ClampedArray.slice()` is a standard pattern, fully specified in ARCHITECTURE.md.
- **Phase 3 (Core Tools):** Iterative BFS flood fill and pencil/eraser pixel buffer writes are well-documented. The pixel-perfect algorithm is verified from Aseprite source.
- **Phase 4 (Palette Panel):** Direct port from existing `web_ui.html` code — no research needed, just extraction and refactoring.
- **Phase 5 (Selection):** Marching ants via `setLineDash` and grid-snapped marquee are standard patterns, HIGH confidence.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core APIs are native browser APIs documented on MDN with Baseline designation since 2015-2022. `willReadFrequently` is the newest requirement (2022-2023 baseline). Zero external dependencies required. |
| Features | HIGH | Core algorithms (RotSprite, pixel-perfect pencil, flood fill tolerance) verified directly against Aseprite C++ source. Feature scope validated against project requirements in PROJECT.md. |
| Architecture | HIGH | Based on direct analysis of the existing `web_ui.html` and `web_app.py` codebase, plus established Canvas API patterns. 3-canvas layer stack and CSS-transform zoom are confirmed patterns from multiple pixel art editors. |
| Pitfalls | HIGH | Premultiplied alpha, DPR, and willReadFrequently pitfalls are documented in official specs and browser bug trackers. RotSprite memory math is directly calculable. Flood fill visited-bitmap pattern is standard computer science. |

**Overall confidence:** HIGH

### Gaps to Address

- **RotSprite JS boundary behavior:** The algorithm logic is verified from Aseprite source, but JavaScript pixel-index arithmetic at boundary pixels (top/bottom/left/right edges of the 8x upscaled buffer) needs test coverage before integration. Plan a standalone RotSprite unit test phase within Phase 6.
- **sessionStorage quota fallback design:** PITFALLS.md identifies the failure mode but the fallback (POST image to Flask, get token, redirect) has no reference implementation in the codebase. This needs an explicit API design before Phase 7 starts — a `/api/editor/init` endpoint that stores a temporary file and returns a token.
- **Pixel-perfect pencil exactness:** Two slightly different descriptions of the pixel-perfect algorithm exist across STACK.md and FEATURES.md (2x2 block neighbor check vs. 3-point consecutive point check). FEATURES.md's Aseprite source derivation (3-point consecutive check from `intertwiners.h`) takes precedence. Document the chosen algorithm explicitly in Phase 3 and add a visual test case.
- **Color picker implementation scope:** Building a full HSL wheel is ~100 lines of canvas code. The existing `web_ui.html` has a simpler RGB picker. The gap between "port existing RGB picker" vs. "build full HSL wheel" should be decided before Phase 3. Using the existing picker is lower risk; the HSL wheel adds user value but is not strictly required for launch.

## Sources

### Primary (HIGH confidence)
- MDN Web Docs: Canvas API, ImageData, getImageData, putImageData, willReadFrequently, Pointer Events, setPointerCapture, setLineDash, ResizeObserver, cancelAnimationFrame, Storage quotas — official spec documentation
- WHATWG HTML Issue #5365 — premultiplied alpha in Canvas spec; known gap
- Mozilla Bugzilla #389366 — premultiplied alpha getImageData bug, reported 2007, affects all browsers
- Aseprite source: `src/doc/algorithm/rotsprite.cpp`, `src/app/tools/intertwiners.h`, `src/doc/algorithm/floodfill.cpp`, `src/doc/mask.cpp`, `src/app/ui/editor/pixels_movement.cpp`, `src/app/ui/editor/transform_handles.cpp` — algorithm implementations verified directly
- Existing codebase: `/Users/calling/perfectPixel_ver1.1/web_ui.html` (1142 lines), `web_app.py` — direct analysis confirming Flask patterns, CSS variables, API shapes
- `/Users/calling/perfectPixel_ver1.1/.planning/PROJECT.md` — primary requirements source

### Secondary (MEDIUM confidence)
- web.dev: High DPI Canvas — DPR handling patterns (slightly dated but core concepts stable)
- Kevin Schiener (2024): "Canvas2D willReadFrequently attribute" — verified against MDN spec
- Ben's Blog: "HTML5 Canvas Flood Fill that doesn't kill the browser" — iterative BFS flood fill patterns
- Codeheir (2022): "Comparing Flood Fill Algorithms in JavaScript" — performance comparison

### Tertiary (LOW confidence)
- Rickyhan.com: "Pixel Art Algorithm: Pixel Perfect" — pixel-perfect description corroborated by FEATURES.md Aseprite source derivation

---
*Research completed: 2026-03-02*
*Ready for roadmap: yes*
