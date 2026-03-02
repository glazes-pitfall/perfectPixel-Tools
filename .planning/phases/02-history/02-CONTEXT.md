# Phase 2: History - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement snapshot-based undo/redo infrastructure (`pushHistory()` / `undo()` / `redo()`) covering all editor operations. Phase 2 delivers the mechanism only — since no real tools exist yet, a temporary test scaffold (canvas click listener) is added solely to make the success criteria verifiable and will be removed at the start of Phase 3.

</domain>

<decisions>
## Implementation Decisions

### History Stack Capacity
- MAX_HISTORY: **100** (user override — CLAUDE.md default of 50 does not apply)
- When stack exceeds 100 entries: shift off the oldest snapshot (LIFO overflow)
- No user-visible indication of stack overflow — buttons handle state implicitly

### Undo/Redo Button States
- Both buttons **grey (disabled)** when no operation is available:
  - Fresh page with no edits: both grey
  - Undo at history start (historyIndex ≤ 0 with no prior state): Undo grey
  - At tip of history (nothing to redo): Redo grey
- Buttons **light up (enabled)** when the corresponding operation is possible
- No step counter or "X steps remaining" label — state communicated by button appearance only
- No toast or flash message on hitting limits — silence is fine

### Test Scaffold (Temporary — Phase 3 removes it)
- Canvas `pointerdown` listener calls `pushHistory()` then fills the **entire canvas** with a single random color
- Each click produces a visually distinct, randomly chosen solid color for all pixels
- Rationale: whole-canvas color change makes undo/redo stack traversal immediately obvious — ideal for verifying history order without needing real drawing tools
- Scaffold is a standalone listener, clearly commented as temporary, easily deleted at Phase 3 start

### Keyboard Shortcuts
- Cmd+Z → undo; Shift+Cmd+Z → redo
- Guard against `input` and `textarea` focus (per CLAUDE.md spec): `if (e.target.matches('input, textarea')) return;`
- No special behavior when canvas has no image loaded — undo/redo simply has nothing to do (buttons stay grey)

### Claude's Discretion
- Exact visual styling for enabled vs disabled button states (opacity, color)
- Undo/Redo button wiring implementation details (event delegation vs direct binding)
- History stack overflow: `history.shift()` when length exceeds MAX_HISTORY, `historyIndex` adjusted accordingly

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EditorState.history: []` — already declared, ready to use
- `EditorState.historyIndex: -1` — already declared, ready to use
- `EditorState.MAX_HISTORY: 50` — **update to 100** (user decision above)
- `EditorState.pixels` (Uint8ClampedArray) — source for snapshots (`pixels.slice()`)
- `flushPixels()` — restores canvas from EditorState.pixels; undo/redo calls this after swapping snapshots
- Undo button `#btn-undo` and Redo button `#btn-redo` already exist in HTML (currently `disabled`)
- `keydown` listener already registered — add Cmd+Z / Shift+Cmd+Z cases inside it

### Established Patterns
- All pixel reads/writes go through `EditorState.pixels`, never `getImageData()` — history snapshots follow the same rule (`pixels.slice()`)
- CSS zoom via `transform: scale()` — snapshot fidelity is not affected by zoom
- `pointerdown` is the correct hook point for `pushHistory()` (per CLAUDE.md: "push on pointerdown only, not pointermove")

### Integration Points
- History functions (`pushHistory`, `undo`, `redo`) are global — Phase 3 tools call them directly
- Button DOM refs obtained once at init; `disabled` attribute toggled after each undo/redo and after each `pushHistory()`
- No new Flask routes required — Phase 2 is entirely client-side

</code_context>

<specifics>
## Specific Ideas

- Test scaffold fills the **entire canvas** with one random solid color per click (not a single pixel) — makes stack traversal visually dramatic and immediately confirmable without zooming in
- Example sequence: click 1 → red canvas, click 2 → yellow canvas, click 3 → blue canvas; Cmd+Z x3 restores each in reverse order

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-history*
*Context gathered: 2026-03-02*
