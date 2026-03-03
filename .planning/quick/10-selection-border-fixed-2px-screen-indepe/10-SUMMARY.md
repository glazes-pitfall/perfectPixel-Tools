# Quick Task 10 — Selection Border Fixed 2px Screen (Zoom-Independent)

## What Was Done

Fixed the selection border lineWidth so it remains exactly 2 screen pixels regardless of canvas zoom level.

## Root Cause

The canvas zoom is applied via CSS `transform: scale(zoom)` on the zoom-container. The selCanvas lives inside the container, so all drawing coordinates get scaled up by CSS. At zoom=4, a `lineWidth = 2/dpr` line becomes `2/dpr * 4 = 8` screen pixels wide.

## Fix

In `drawAnts()`, divided lineWidth and path offset by `EditorState.zoom`:

```javascript
// Before
selCtx.lineWidth = 2 / dpr;
const off = 1 / dpr;

// After
selCtx.lineWidth = 2 / dpr / EditorState.zoom;
const off = 1 / dpr / EditorState.zoom;
```

Both the mask (jagged pixel path) branch and the fallback `strokeRect` branch were updated.

## Files Changed

- `editor.html` — 3 lines in `drawAnts()`

## Commit

- `daaba7b`: feat(quick-10): selection border fixed 2px screen — divide lineWidth by zoom
