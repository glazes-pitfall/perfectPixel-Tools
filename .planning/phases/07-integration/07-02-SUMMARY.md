---
plan: 07-02
phase: 07-integration
status: complete
completed: 2026-03-04
---

## Summary

Implemented the Canvas Size tool (keyboard shortcut S) with real-time purple reference line preview, blue expansion overlay, and pixel-accurate Apply with undo support.

## Self-Check: PASSED

## Key Files Modified

- `editor.html`: All changes in a single file

## Implementation Details

**HTML Panel** (after tool-settings-move, before btn-deselect):
- `tool-settings-canvas-size` div with W/H/L/R/T/B inputs + Apply/Cancel buttons
- W/H are final target canvas dimensions (independent of L/R/T/B)
- L/R/T/B control offset of existing content in new canvas

**JavaScript Functions** (inside DOMContentLoaded, before zoom controls section):
- `_getCanvasSizeParams()`: Parses inputs, returns `{newW, newH, offsetL, offsetT}`
- `drawCanvasSizeGuides()`: Coordinate transform via getBoundingClientRect, purple lines + blue expansion overlay on selCanvas
- `applyCanvasSize()`: pushHistory + TypedArray row-copy (subarray) + initCanvases + flushPixels + setActiveTool('pencil')
- `cancelCanvasSize()`: Clear selCanvas + setActiveTool('pencil')

**setActiveTool Updates**:
- Added 'tool-settings-canvas-size' to panelIds array
- Init W/H inputs to current canvas dims + reset L/R/T/B to 0 on activate
- setTimeout(drawCanvasSizeGuides, 0) for first render after panel switch

**_onZoomChanged → _onZoomChangedListeners** (multicast):
- Replaced `let _onZoomChanged = null` with `let _onZoomChangedListeners = []`
- Changed `if (_onZoomChanged) _onZoomChanged()` to `_onZoomChangedListeners.forEach(fn => fn())`
- Transform tool: changed `_onZoomChanged = ...` to `_onZoomChangedListeners.push(...)`
- Canvas Size: added second push listener

**Keyboard Shortcuts**:
- S/s → setActiveTool('canvas-size') when pixels loaded
- ESC → cancelCanvasSize() (checked before other ESC handlers via `return`)

## Deviations from Plan

None significant. The `setActiveTool` canvas-size hook was placed inside the function body (in outer scope) rather than inside DOMContentLoaded, which is correct since setActiveTool is in outer scope and `drawCanvasSizeGuides` is in DOMContentLoaded scope — solved with a `typeof drawCanvasSizeGuides === 'function'` guard for the setTimeout call.

## Commit

`feat(07-02): implement Canvas Size tool (S key) with live guides` (99891f3)
