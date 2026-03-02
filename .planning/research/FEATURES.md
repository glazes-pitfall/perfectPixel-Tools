# Feature Research

**Domain:** Browser-based pixel art editor — Aseprite-compatible UX patterns in vanilla JS
**Researched:** 2026-03-02
**Confidence:** HIGH (core algorithms verified against Aseprite source; UX behaviors from official docs and source analysis)

---

## Research Methodology

Primary sources used (in priority order):

1. Aseprite source code — `src/doc/algorithm/` and `src/app/` (direct C++ inspection)
2. Aseprite official documentation — `aseprite.org/docs/`
3. Existing `ARCHITECTURE.md` in this project (already-researched patterns)

All algorithm descriptions below are derived from the actual Aseprite C++ source, not secondary articles.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features any pixel art editor must have. Missing these = product feels broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Pencil tool (single pixel) | Most basic editing primitive | LOW | setPixel on pointer events |
| Eraser tool | Draws transparent pixels | LOW | Identical to Pencil but writes RGBA(0,0,0,0) |
| Undo / Redo (Cmd+Z / Shift+Cmd+Z) | Every editor has it; users muscle-memory it | MEDIUM | Snapshot-based is simpler than command pattern at pixel art scale |
| Zoom in/out | Pixel art must be viewed at 4–16x | LOW | CSS transform on canvas container div |
| Color picker (foreground color) | Cannot draw without selecting color | MEDIUM | HSL wheel + hex input + RGB inputs |
| Palette swatch integration | Pixel art is palette-constrained by nature | MEDIUM | Click swatch sets foreground color; active swatch highlighted |
| Canvas pan (hand tool or Space+drag) | Any canvas larger than viewport needs panning | LOW | CSS transform translate |
| Marching ants selection border | Selection must be visually obvious | MEDIUM | ctx.setLineDash with animated offset; runs on RAF loop |
| Deselect (Cmd+D) | Standard shortcut; universally expected | LOW | Clear EditorState.selection |
| Paint Bucket flood fill | Fill large areas of a single color | MEDIUM | Iterative scanline or BFS with tolerance |
| Download / export | Output the edited image | LOW | canvas.toBlob() → object URL download |

### Tool-Specific Table Stakes

These are expected behaviors for each specific tool in the scope.

#### Rectangle Marquee Tool (M)

| Behavior | Why Expected | Notes |
|----------|--------------|-------|
| Drag to define rectangular selection | Core Marquee behavior | Grid-snapped for pixel art (snap to gridW/gridH) |
| Live dashed boundary during drag | Aseprite standard; also Photoshop | 1px anti-aliased dashed line updates on every pointermove |
| Shift+drag adds to selection | Standard selection algebra | Sets selection mode to ADD |
| Alt+drag subtracts from selection | Standard selection algebra | Sets selection mode to SUBTRACT |
| Cmd+D deselects | Muscle memory from Aseprite/Photoshop | Clear selection state |
| Shift+Cmd+I inverts | Standard; present in Aseprite docs | Invert mask bitmap |

#### Magic Wand Tool (W)

| Behavior | Why Expected | Notes |
|----------|--------------|-------|
| Click fills connected region matching color | Core Magic Wand | Flood-fill BFS selecting pixels not drawing them |
| Tolerance slider (0–255) | Every magic wand has tolerance | Per-channel box matching: each channel within ±tolerance |
| Contiguous checkbox | Aseprite has it; non-contiguous selects all matching pixels | Non-contiguous = iterate whole canvas, no BFS |
| Selection result becomes editable marquee | Wand output feeds into transform/move | Selection state set identically to marquee result |

#### Move Tool (V)

| Behavior | Why Expected | Notes |
|----------|--------------|-------|
| Drag selected region pixels | Core move behavior | Copies selected pixels to temp buffer, clears source, places at offset |
| Show pixel offset from canvas edges | Aseprite status bar shows :pos: X Y | Display left/top/right/bottom distances as overlay or status text |
| Arrow keys for 1px nudge | Standard fine-positioning | Each arrow key press = move selection by 1 pixel |

#### Pencil Tool (B)

| Behavior | Why Expected | Notes |
|----------|--------------|-------|
| Draw on pointerdown + pointermove | Most basic expected behavior | setPixel for 1px brush; stamp brush shape for larger |
| Brush size (1px minimum, integer steps) | Every pencil has size | For size > 1: stamp a precomputed brush mask at each point |
| Brush shape: round (pixel circle) vs square | Aseprite has both; standard in pixel editors | See Pixel Circle algorithm notes below |
| Pixel-perfect mode checkbox | Aseprite-specific but widely known | Removes L-corner artifacts; see algorithm notes below |
| Right-click draws with background color | Aseprite behavior | Optional; secondary color support |

#### Paint Bucket Tool (G)

| Behavior | Why Expected | Notes |
|----------|--------------|-------|
| Click to flood fill | Core bucket behavior | Uses same tolerance + contiguous logic as Magic Wand |
| Tolerance (0–255) | Expected in any bucket tool | Per-channel box match |
| Contiguous checkbox | Aseprite has it | Non-contiguous replaces all matching pixels in bounds |

#### Eraser Tool (E)

| Behavior | Why Expected | Notes |
|----------|--------------|-------|
| Erase to transparent | Core eraser behavior | Writes RGBA(0,0,0,0) using same brush stamp as Pencil |
| Same size/shape/pixel-perfect options as Pencil | Shared brush system | EditorState.toolOptions.brushSize / brushShape apply to both |

#### Canvas Size (S)

| Behavior | Why Expected | Notes |
|----------|--------------|-------|
| Width and Height inputs | Obvious resize UI | Integer pixel values |
| Left / Right / Top / Bottom border expansion fields | Aseprite behavior; allows asymmetric expansion | Positive = add pixels on that edge; negative = crop |
| 4 reference lines preview on canvas | Aseprite behavior; needed to see result before commit | Draw 4 lines on selection-canvas showing new border position |
| Existing content repositioned correctly on Apply | If left edge expands by N, all content shifts +N pixels | Apply: create new Uint8ClampedArray, copy old pixels at offset |

#### Undo / Redo

| Behavior | Why Expected | Notes |
|----------|--------------|-------|
| Cmd+Z undoes last action | Universally expected | Restore previous Uint8ClampedArray snapshot |
| Shift+Cmd+Z redoes | Universally expected | Move historyIndex forward |
| Covers all operations | Users expect everything to be undoable | Drawing, transform apply, canvas resize, fill |
| Undo buttons always visible in top bar | Aseprite has undo/redo always accessible | Disable appearance when at stack boundary |

---

### Differentiators (Competitive Advantage)

Features specific to this project's pixel art workflow context or Aseprite-parity features that most browser editors lack.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Grid-aligned marquee selection | AI pixel art has consistent pixel grid; misalignment breaks the workflow | MEDIUM | Snap selection x/y/w/h to nearest gridW/gridH multiples on release |
| 8-handle transform with RotSprite rotation | Most browser editors use bilinear; RotSprite preserves pixel art quality | HIGH | See RotSprite algorithm notes below |
| Pixel-perfect pencil mode | Eliminates L-corner artifacts that make strokes look wrong in pixel art | MEDIUM | 3-point consecutive check algorithm (from Aseprite source) |
| Palette constraint integration (Ver 1.1 carry-over) | Apply color quantization to the editor output directly | LOW | Reuse existing /api/apply-palette endpoint; add Apply Palette button |
| Palette swatch click → auto-sync to color picker | Reduces clicks; keeps workflow inside the editor | LOW | EditorState pub/sub: swatch click emits 'color-changed' |
| Active swatch highlight when color picker matches palette | Visual feedback of palette constraint | LOW | colorsEqual() check on every color picker change |
| Eyedropper from canvas | Pick colors from the pixel art itself | LOW | getPixel(x, y) on click in any tool mode |
| "Open in Editor" from Ver 1.1 pipeline | Connects grid alignment → editing workflow; no other tool does this | LOW | sessionStorage handoff from web_ui.html |
| Grid overlay display | Shows the detected pixel art grid for alignment verification | LOW | Draw grid lines on cursor-canvas based on EditorState.gridW/H |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Layer system | "I want layers like Photoshop" | Out of scope for Ver 1.2; adds massive complexity to every tool (selection, fill, transform all become layer-aware); declared out-of-scope in PROJECT.md | Defer to Ver 2.0. Single-layer editor is complete for the AI pixel art post-processing workflow |
| Animation timeline / frames | "Sprite sheets" | Out of scope per PROJECT.md; would require frame management everywhere | Explicitly defer; user should use Aseprite for animation |
| Server-side undo history persistence | "I don't want to lose my undo history on refresh" | Local tool, single user, session-scoped state is adequate; sessionStorage already covers the tab lifetime | 50-step snapshot history in sessionStorage is sufficient |
| Sub-pixel rendering / anti-aliasing brushes | "Smoother lines" | Antithetical to pixel art; breaks palette constraints (introduces interpolated colors); users who want this should use Krita | Explicitly disable; pixel art editing is integer-only |
| Brush stabilizer / smoothing | "Smoother strokes" | Introduces latency; also not meaningful for pixel art where each pixel is deliberately placed | Not implemented; pixel art is click-by-click, not freehand |
| Bezier / vector tools | "Draw curves" | Out of scope; this is a raster pixel editor | Out of scope for this project entirely |
| Real-time multiplayer / cloud sync | "Share with team" | Single-user local tool; adds backend complexity incompatible with the Flask local server model | Not applicable to this use case |
| Pattern / texture brushes | "Stamp textures" | Adds UI complexity; not core to AI pixel art refinement workflow | Could be added as a custom brush type in a future version |

---

## Algorithm Notes

Documented from Aseprite source code (`src/doc/algorithm/`, `src/app/tools/`). Implementation targets are vanilla JavaScript.

### Pixel-Perfect Pencil Algorithm

**Source:** `src/app/tools/intertwiners.h` — `IntertwineAsPixelPerfect` class

**What it prevents:** When drawing a diagonal stroke, a naive Bresenham line produces L-shaped pixel clusters (two pixels touching at corners, not just edges). These look like "fat corners" and violate the aesthetic rules of pixel art.

**The algorithm (3-point consecutive point check):**

```
For each point c in the stroke (c > 0, c < last):
  prev = m_pts[c-1]
  curr = m_pts[c]
  next = m_pts[c+1]

  Skip curr if ALL of:
    1. prev and curr share the same X OR the same Y (axis-aligned adjacency)
    2. curr and next share the same X OR the same Y (axis-aligned adjacency)
    3. prev.x != next.x AND prev.y != next.y (prev and next are diagonally offset)

  When all 3 conditions are true: curr is the "elbow" of an L-shape.
  Erase curr (restore the pixel beneath it using saved pre-stroke state).
```

**In plain English:** If the middle pixel of three consecutive stroke pixels forms an L-bend (going horizontal then vertical, or vertical then horizontal), remove that middle pixel. This ensures strokes have only straight or 45° segments with no doubled corners.

**JavaScript implementation approach:**
- Collect all stroke points during `pointermove` into an array
- After each new point is added, check the last 3 points in the array
- If the condition is met, do not call `setPixel` for the middle point (or restore it)
- Only applies when `EditorState.toolOptions.pixelPerfect === true`

**When to trigger:** On `pointermove` during active stroke. Re-check last 3 points every time a new point is appended.

---

### RotSprite Rotation Algorithm

**Source:** `src/doc/algorithm/rotsprite.cpp` (Aseprite) — confirmed from direct source inspection

**What it is:** A pixel art rotation algorithm that dramatically reduces the visual artifacts of rotating low-resolution sprites compared to naive nearest-neighbor rotation.

**The 4 steps:**

```
Step 1: UPSCALE 8x using Scale2x (EPX algorithm)
  - Apply Scale2x three times to achieve 8x total scale
  - Scale2x rules (for each pixel P with neighbors A/B/C/D):
      If C == A and C != D and A != B → output[0] = A, else P
      If A == B and A != C and B != D → output[1] = B, else P
      If D == C and D != B and C != A → output[2] = C, else P
      If B == D and B != A and D != C → output[3] = D, else P
  - Result: 8x larger image with edge enhancement but no new colors

Step 2: ROTATE the 8x image using nearest-neighbor parallelogram mapping
  - The 4 destination corner coordinates (from the transform handles) are
    multiplied by 8 to match the upscaled image
  - A standard parallelogram rasterizer maps each output pixel to the
    nearest source pixel in the 8x image (nearest-neighbor, no interpolation)

Step 3: DOWNSCALE back to original size
  - Nearest-neighbor downscale by 8x (take top-left pixel of each 8x8 block,
    or use voting/majority for better quality — Aseprite uses scale_image())
  - Result is back at original dimensions

Step 4: Composite onto the canvas
  - The result replaces the selection content in EditorState.pixels
```

**Why Scale2x before rotation:** Rotating a 1x image with nearest-neighbor produces ugly staircasing. Scale2x preserves clean edges (it only samples from the same-color neighbors) while making the image large enough that the rotation sampling hits many more intermediate positions — resulting in much smoother staircase edges after downscaling.

**When RotSprite is skipped:** Angles that are exact multiples of 90° use fast pixel rotation (no quality loss at 90° since it is just transposing the pixel grid). RotSprite is only invoked for non-orthogonal angles.

**Memory and performance:** For pixel art (16×16 to 128×128 cells), 8x upscale is at most 1024×1024 = 4MB for the working buffer. This is fine synchronously. For larger inputs, consider a `setTimeout` chunked approach (as noted in ARCHITECTURE.md).

**JavaScript implementation target:**
- `rotspriteImage(srcPixels, srcW, srcH, corners)` → `Uint8ClampedArray`
- `corners`: `{x1,y1, x2,y2, x3,y3, x4,y4}` — the 4 destination corners from transform handles
- Internally: allocate 8x buffer → apply Scale2x 3 times → parallelogram rasterize → downscale → return

---

### Magic Wand / Paint Bucket Flood Fill Algorithm

**Source:** `src/doc/algorithm/floodfill.cpp` and `src/doc/mask.cpp` — confirmed from direct source inspection

**Flood fill function signature (C++ reference):**
```cpp
void floodfill(image, mask, x, y, bounds, srcColor, tolerance, contiguous, isEightConnected, data, proc)
```

**Algorithm type:** Scanline-based flood fill (not recursive DFS, not simple BFS).

**Color tolerance matching (per channel, axis-aligned box):**
```
For RGB: match if
  abs(src.r - target.r) <= tolerance AND
  abs(src.g - target.g) <= tolerance AND
  abs(src.b - target.b) <= tolerance AND
  abs(src.a - target.a) <= tolerance

For Grayscale: match if
  abs(src.k - target.k) <= tolerance AND
  abs(src.a - target.a) <= tolerance

Special case: fully transparent pixels (alpha == 0) always match each other
regardless of RGB values (because invisible pixels have no meaningful color)
```

**This is NOT Euclidean distance** — it is a per-channel range band. Tolerance of 30 means each channel independently can vary by ±30. This matches Aseprite and Photoshop behavior.

**Contiguous vs non-contiguous:**
- **Contiguous = true:** Scanline flood fill starting at seed pixel (x, y). Only reaches pixels connected to the seed via 4-connectivity (up/down/left/right). Standard flood fill.
- **Contiguous = false:** Iterates the entire canvas (or bounded region). Any pixel matching the target color within tolerance is included, regardless of connectivity to seed. Equivalent to `replace_color()` over the full image.

**Scanline implementation (Aseprite approach for contiguous mode):**
```
frontier = linked list of FLOODED_LINE { lpos, rpos, y, flags }
Seed: expand left/right from (x, y), record [lpos, rpos] on that scanline
Mark line TODO_ABOVE and TODO_BELOW
Process queue:
  For each pending scanline:
    Scan row above: find matching sub-segments
    Scan row below: find matching sub-segments
    Add new segments to frontier, recursively
```

**JavaScript implementation for this project:** The ARCHITECTURE.md recommends a simpler BFS with a stack array. This is acceptable for pixel art scale (max ~512×512). For the Magic Wand (selection), the fill populates a boolean selection mask instead of painting pixels. The tolerance check and contiguous behavior are identical between Magic Wand and Paint Bucket — only the output differs.

**Magic Wand selection (non-contiguous) via Mask.byColor:**
```
byColor(image, target_color, tolerance):
  for each pixel in image:
    if matches(pixel, target_color, tolerance):
      mask.set(x, y, true)
    else:
      mask.set(x, y, false)
```

---

### 8-Point Transform Handle System

**Source:** `src/app/ui/editor/transform_handles.cpp` and `src/app/ui/editor/pixels_movement.cpp`

**Handle layout:**

```
NW handle ─────── N handle ─────── NE handle
    │                                    │
W handle                            E handle
    │                                    │
SW handle ─────── S handle ─────── SE handle
```

- Corner handles (NW, NE, SW, SE): Scale in 2 dimensions simultaneously
- Edge handles (N, S, E, W): Scale in 1 dimension only (constrain orthogonal axis)
- Pivot point (center, optional): Visible when angle != 0; draggable to reposition rotation center

**Handle positioning formula:**
```
N  handle: midpoint of topLeft + topRight corners
S  handle: midpoint of bottomLeft + bottomRight corners
W  handle: midpoint of topLeft + bottomLeft corners
E  handle: midpoint of topRight + bottomRight corners
NW handle: topLeft corner
NE handle: topRight corner
SW handle: bottomLeft corner
SE handle: bottomRight corner
```

**Handle cursor behavior:**
- Each handle has an angle bias (0°, 45°, 90°, etc. around the compass)
- The displayed cursor icon rotates to match: `Math.floor(8.0 * angle / (2π) + 0.5) % 8`
- In scaling mode: resize cursor pointing in the handle's axis direction
- After the user begins a rotation (via dragging outside handles): cursors switch to rotation arc cursors

**Dragging a corner handle (scale):**
- The opposite corner is the fixed anchor
- New width/height computed from mouse position relative to anchor
- Shift key: preserve aspect ratio (lock w/h ratio to original)
- Result: all 4 corners recalculated; transform redrawn

**Dragging an edge handle (scale one axis):**
- Only the perpendicular dimension changes
- The other axis stays fixed

**Applying transform:**
- User clicks "Apply" (Enter key) or clicks outside selection
- Current transform state (scale, rotation, corners) is applied to pixel buffer via RotSprite
- `pushHistory()` called before apply, enabling undo

**Canceling transform:**
- User clicks "Cancel" (Escape key) or clicks Cancel button
- Selection contents restored from pre-transform snapshot (saved at transform start)
- No history push needed (pixels unchanged)

**Context bar during active transform:**
```
[ Apply ✓ ]  [ Cancel ✗ ]  [ Scale X: 1.00 ]  [ Scale Y: 1.00 ]  [ Lock Aspect ]  [ Angle: 0.0° ]
```

All fields are editable inputs. Changing angle or scale fields triggers immediate preview re-render.

---

### Pixel Circle (Round Brush Shape) Algorithm

**Source:** `src/doc/brush.cpp` + `src/doc/algo.cpp` — `fill_ellipse` / `algo_ellipsefill`

**What "pixel circle" means:** A rasterized circle using integer error-term arithmetic (Zingl/Bresenham-based). The result is NOT a mathematically perfect circle — it is the set of integer pixel positions that best approximates a circle. At small sizes (1–7px diameter), this produces the specific shapes that pixel artists expect (the "pixel circle" lookup table shapes).

**The algorithm:**
```
Initialize: a = radius_x, b = radius_y (for circle: a == b == size/2)
Error terms: dx = 4*(1-a)*b², dy = 4*(b+1)*a²
Step horizontally or vertically based on error term sign
Draw filled horizontal spans at each y level
Result: integer-pixel filled ellipse = pixel circle when a == b
```

**Why this matters for users:** Pixel artists expect specific small brush shapes. A 5px "round" brush should look like:
```
 .XXX.
XXXXX
XXXXX
XXXXX
 .XXX.
```
Not a blurry antialiased approximation. The Zingl ellipse algorithm produces this exact result.

**JavaScript implementation:** Pre-compute brush masks for sizes 1–32px at startup. Store as boolean 2D arrays. On `pointerdown`/`pointermove`, stamp the precomputed mask centered at the cursor position. Recompute only when size changes.

---

### Move Tool — Distance Display Behavior

**Source:** `src/app/ui/editor/moving_pixels_state.cpp` — `onUpdateStatusBar()`

**What Aseprite shows during move:**
```
:pos: X Y  :size: W H  :selsize: SW SH [XX% YY%]  :angle: A  :aspect_ratio: W:H
```

- `:pos:` — current X, Y position of the selection's top-left corner on the canvas
- `:size:` — original image dimensions (unchanged)
- `:selsize:` — current selection width/height with scale percentage
- `:angle:` — rotation angle in degrees

**The "distance from canvas edges" Aseprite behavior:** Aseprite does not show four-edge distances in a dedicated overlay. It shows the absolute X/Y position. From that, users calculate the distance from edges themselves. The PROJECT.md requirement says "显示选区距画布四边的像素距离" — but the Aseprite source shows position coordinates (X, Y), from which edge distances are derived as: left=X, top=Y, right=canvasW-X-selW, bottom=canvasH-Y-selH.

**Recommendation:** Display an overlay label showing: `L: {x}  T: {y}  R: {canvasW-x-selW}  B: {canvasH-y-selH}` updated every `pointermove`. This matches the project requirement more explicitly than Aseprite's raw coordinate display.

---

### Canvas Size — Reference Line Preview

**Source:** `src/app/commands/cmd_canvas_size.cpp` — `SelectBoxState` with Rulers + DarkOutside flags

**Aseprite behavior:**
- Selecting canvas size shows 4 guides (reference lines) on the canvas preview
- These lines represent the new canvas boundary
- The region outside the new boundary is darkened
- An anchor grid (3×3 = 9 positions) determines where the existing content is placed within the new canvas

**For this project (simpler approach):**
- Enter canvas size mode: draw 4 colored lines on `selection-canvas` at the current edges
- As user edits L/R/T/B fields, update line positions in real time
- Lines at: `x = Left`, `y = Top`, `x = canvasW - Right`, `y = canvasH - Bottom`
- Apply button: create new pixel buffer, copy old pixels offset by (Left, Top)

---

## Feature Dependencies

```
[Pixel Buffer / setPixel / getPixel]
    └──required by──> [Pencil Tool]
    └──required by──> [Eraser Tool]
    └──required by──> [Paint Bucket]
    └──required by──> [Magic Wand]
    └──required by──> [Canvas Size Apply]
    └──required by──> [Transform Apply]

[History (undo/redo)]
    └──required by──> [All drawing tools] (pushHistory on pointerdown)
    └──required by──> [Transform Apply]
    └──required by──> [Canvas Size Apply]

[Selection State (x, y, w, h)]
    └──required by──> [Rectangle Marquee] (produces selection)
    └──required by──> [Magic Wand] (produces selection)
    └──required by──> [Move Tool] (reads selection)
    └──required by──> [8-Handle Transform] (reads + modifies selection)
    └──required by──> [Marching Ants animation] (reads selection)

[Marching Ants animation]
    └──required by──> [Rectangle Marquee] (visual feedback during drag)

[Magic Wand flood-fill BFS]
    └──shared with──> [Paint Bucket] (same algorithm, different output: mask vs paint)

[RotSprite JS reimplementation]
    └──required by──> [8-Handle Transform rotation] (non-orthogonal angles)

[Pixel-Perfect 3-point check]
    └──optional enhancement of──> [Pencil Tool]
    └──optional enhancement of──> [Eraser Tool]

[Color Picker]
    └──required by──> [Palette Swatch sync] (both read/write foreground color)
    └──used by──> [All drawing tools] (reads foreground color)

[Grid metadata (gridW, gridH from Ver 1.1)]
    └──required by──> [Grid-aligned Marquee snap]
    └──optional for──> [Grid overlay display]
```

### Dependency Notes

- **History requires pixel buffer:** History snapshots are `Uint8ClampedArray.slice()` copies. The pixel buffer must be initialized before any history push.
- **Transform requires selection:** Transform handles only appear when a selection is active. The 8-handle system is the selection's UI representation.
- **Paint Bucket and Magic Wand share core BFS logic:** Implement one `floodFillBFS(x, y, tolerance, contiguous) → affectedCoords[]` function. Bucket paints those coords; Wand adds them to the selection mask.
- **RotSprite requires Scale2x:** Scale2x must be implemented first as a standalone function, then RotSprite calls it 3 times.

---

## MVP Definition

### Launch With (v1 — the minimum for a usable pixel art editor that fulfills the Ver 1.2 goal)

- [ ] Pencil Tool (B) — basic 1px drawing, essential to any editor
- [ ] Eraser Tool (E) — transparent drawing, shares Pencil code
- [ ] Paint Bucket Tool (G) with tolerance + contiguous — fills regions; without it users must paint pixel by pixel
- [ ] Undo / Redo (Cmd+Z / Shift+Cmd+Z) — without undo, users cannot recover from mistakes
- [ ] Color picker + palette swatch sync — cannot work without color selection
- [ ] Rectangle Marquee (M) with grid-snap — core selection for the AI pixel art workflow
- [ ] Magic Wand (W) with tolerance + contiguous — selects color regions for replacement
- [ ] Move Tool (V) — moves selection contents; without it the tool set is incomplete
- [ ] 8-handle transform + RotSprite — the project explicitly requires this; it is the differentiator
- [ ] Canvas Size (S) with 4-reference-line preview — editing canvas bounds is required per PROJECT.md
- [ ] "Open in Editor" button in web_ui.html — connects Ver 1.1 pipeline to editor

### Add After Validation (v1.x)

- [ ] Pixel-perfect pencil mode — adds quality; defer until core drawing works
- [ ] Non-contiguous paint bucket and magic wand — adds power but the contiguous mode covers 90% of use cases
- [ ] Grid overlay display — nice visual aid but not required for editing
- [ ] Eyedropper from canvas without switching tools (Alt+click) — convenience; core eyedropper is in color picker panel already

### Future Consideration (v2+)

- [ ] Layer system — explicitly out of scope in PROJECT.md; enormous complexity multiplier
- [ ] Animation frames / timeline — out of scope per PROJECT.md
- [ ] Server-side palette persistence — localStorage sufficient; defer to Ver 1.3

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Pencil + Eraser | HIGH | LOW | P1 |
| Undo / Redo | HIGH | MEDIUM | P1 |
| Paint Bucket (contiguous + tolerance) | HIGH | MEDIUM | P1 |
| Color Picker + Palette sync | HIGH | MEDIUM | P1 |
| Rectangle Marquee (grid-snapped) | HIGH | MEDIUM | P1 |
| Magic Wand (contiguous + tolerance) | HIGH | MEDIUM | P1 |
| Marching Ants animation | MEDIUM | LOW | P1 (part of Marquee) |
| Move Tool | HIGH | MEDIUM | P1 |
| 8-handle transform | HIGH | HIGH | P1 (explicitly required) |
| RotSprite rotation | HIGH | HIGH | P1 (explicitly required) |
| Canvas Size | HIGH | MEDIUM | P1 |
| Pixel-perfect pencil mode | MEDIUM | MEDIUM | P2 |
| Brush size > 1px | MEDIUM | LOW | P2 |
| Non-contiguous fill / wand | MEDIUM | LOW | P2 |
| Grid overlay | LOW | LOW | P2 |
| Eyedropper (Alt+click) | MEDIUM | LOW | P2 |
| Layer system | HIGH (requested) | VERY HIGH | P3 (defer to v2) |
| Animation | MEDIUM (requested) | VERY HIGH | P3 (defer) |

**Priority key:**
- P1: Must have for Ver 1.2 launch (in scope per PROJECT.md)
- P2: Should have — add if time allows or add in v1.1 patch
- P3: Do not build now — explicitly deferred or out of scope

---

## Competitor Feature Analysis

| Feature | Aseprite (desktop reference) | Piskel (browser) | Our Approach |
|---------|------------------------------|------------------|--------------|
| RotSprite rotation | Yes — default for non-orthogonal angles | No — bilinear only | RotSprite required per PROJECT.md |
| Grid-aligned selection | Yes — configurable snap grid | No | Snap to detected pixel art grid (our differentiator) |
| Pixel-perfect brush | Yes — checkbox in tool options | No | Yes — implement the 3-point check |
| Palette integration | Yes — built-in palette management | Yes — basic palette | Yes — reuse Ver 1.1 palette system |
| Magic Wand tolerance | Yes — 0–255 per-channel | No magic wand | Yes — per-channel box matching |
| Flood fill tolerance | Yes — 0–255 per-channel | Yes — basic | Yes — per-channel box matching |
| 8-handle transform | Yes | No | Yes — required |
| Layer system | Yes | Yes (limited) | No — explicitly deferred to v2 |
| Animation timeline | Yes | Yes | No — out of scope |
| AI pipeline integration | No | No | Yes — unique to this tool |
| Single-file browser app | No | No | Yes — no install required |

---

## Sources

- Aseprite source code — `src/app/tools/intertwiners.h` — pixel-perfect algorithm (verified HIGH confidence)
- Aseprite source code — `src/doc/algorithm/rotsprite.cpp` — RotSprite: 8x scale, Scale2x, parallelogram rotation (verified HIGH confidence)
- Aseprite source code — `src/doc/algorithm/floodfill.cpp` — scanline flood fill, tolerance logic (verified HIGH confidence)
- Aseprite source code — `src/doc/mask.cpp` — `byColor()` per-channel tolerance matching math (verified HIGH confidence)
- Aseprite source code — `src/app/ui/editor/pixels_movement.cpp` — 8-handle transform, RotSprite invocation, algorithm selection logic (verified HIGH confidence)
- Aseprite source code — `src/app/ui/editor/transform_handles.cpp` — handle positioning formulas, cursor rotation logic (verified HIGH confidence)
- Aseprite source code — `src/app/ui/editor/moving_pixels_state.cpp` — Move Tool status bar content (verified HIGH confidence)
- Aseprite source code — `src/app/commands/cmd_canvas_size.cpp` — Canvas Size behavior, L/R/T/B offsets, anchor system (verified HIGH confidence)
- Aseprite source code — `src/doc/algo.cpp` — `algo_ellipsefill` (pixel circle), `algo_line_perfect` (Bresenham) (verified HIGH confidence)
- Aseprite source code — `src/app/tools/rotation_algorithm.h` — RotationAlgorithm enum: DEFAULT/FAST=0, ROTSPRITE=1 (verified HIGH confidence)
- Aseprite docs — `aseprite.org/docs/selecting/` — Selection shortcuts (Cmd+A, Cmd+D, Cmd+Shift+I), marching ants, selection modes (MEDIUM confidence — official docs)
- Aseprite docs — `aseprite.org/docs/rotate/` — RotSprite vs Fast algorithm choice (MEDIUM confidence — official docs)
- Project ARCHITECTURE.md — Canvas layering, state model, undo strategy, coordinate transforms (HIGH confidence — already researched in this project)
- Project PROJECT.md — Requirements validation and constraints (HIGH confidence — primary requirements source)

---

*Feature research for: Browser-based pixel art editor (PerfectPixel Ver 1.2)*
*Researched: 2026-03-02*
