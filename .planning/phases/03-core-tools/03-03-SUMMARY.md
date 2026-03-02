---
phase: 03-core-tools
plan: "03"
subsystem: editor-color-picker
tags: [color-picker, hsl-wheel, eyedropper, sync-ui, foreground-color]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [color-picker-panel, syncColorUI, eyedropper-tool]
  affects: [editor.html]
tech_stack:
  added: [createConicGradient, HSL-to-RGB conversion, PointerCapture on picker-canvas]
  patterns: [single-sync-path with _syncLock guard, _prevTool restore pattern]
key_files:
  modified: [editor.html]
decisions:
  - "createConicGradient used for hue ring — avoids pixel-by-pixel rendering, single canvas API call"
  - "fill('evenodd') on hue ring arc clip — correct arc subtraction without compositing tricks"
  - "_syncLock boolean guard prevents infinite update loop when any control changes EditorState.foregroundColor"
  - "Eyedropper reads getPixel() from EditorState.pixels, never ctx.getImageData() — premultiplied alpha safety"
  - "Escape key clears hover UI via setActiveTool() which already handles cleanup"
metrics:
  duration: "3m"
  completed_date: "2026-03-03"
  tasks_completed: 2
  files_modified: 1
---

# Phase 3 Plan 03: Permanent Color Picker Panel Summary

**One-liner:** HSL color wheel with hue ring + SL square, hex/RGB inputs, and eyedropper tool all synced through single `syncColorUI()` with `_syncLock` guard.

## What Was Built

Implemented the permanent 常驻调色盘 (color picker panel) at the bottom of the left sidebar, and a complete eyedropper tool.

### Task 1: Color Picker Panel HTML + HSL Wheel + syncColorUI + Hex/RGB Inputs

**Commit:** 2170d07

Added `#color-picker-panel` between `#left-scroll` and `#pixel-inspector` in `#left-panel`. The panel is `flex-shrink:0` — it never collapses regardless of left panel scroll content.

**Components added:**
- `<canvas id="picker-canvas" width="160" height="160">` — HSL color wheel with conic gradient hue ring (outerR=75, innerR=55) and linear-gradient SL square (90×90, centered)
- `#clr-hex` — monospace text input, updates on Enter/blur, rejects invalid hex and restores last valid value
- `#clr-copy` — clipboard copy button with `execCommand` fallback
- `#clr-r`, `#clr-g`, `#clr-b` — number inputs 0-255, immediate update on `input` event
- `#clr-swatch` — 28×28 foreground color preview block
- `#btn-eyedropper` — activates eyedropper, stores `EditorState._prevTool`
- `#eyedropper-hover-swatch` + `#eyedropper-transparent-label` — eyedropper preview UI

**JavaScript added (script top-level):**
- `hslToRgb(h, s, l)` / `rgbToHsl(r, g, b)` — pure JS conversion, no dependencies
- Picker canvas state: `currentHue`, `currentSat`, `currentLit`, `_pickerDragZone`
- `drawHueRing()` using `createConicGradient` + `fill('evenodd')` for donut ring
- `drawSLSquare()` using two-pass linear gradients (saturation + lightness overlay)
- `drawPickerIndicators()` — small circles on ring (hue position) and square (SL position)
- `redrawPicker()` — calls the three draw functions
- `syncColorUI()` with `_syncLock` boolean guard — single sync path from `EditorState.foregroundColor` to all four controls

**JavaScript added (inside DOMContentLoaded):**
- Picker canvas pointer events with `setPointerCapture` — `handlePickerDrag()` handles both ring drag (hue angle) and square drag (S/L coordinates)
- Hex input `keydown`/`blur` handlers
- RGB input `input` handlers
- Eyedropper button `click` handler

### Task 2: Eyedropper Tool Implementation

**Commit:** bcd9e13

Replaced the `tools.eyedropper` stub from 03-01 with full implementation:

**`tools.eyedropper.onDown(x, y)`:**
- Reads pixel via `getPixel(x, y)` from `EditorState.pixels` (never `ctx.getImageData()`)
- Transparent pixel (`a === 0`): returns early, no color change
- Opaque pixel: sets `EditorState.foregroundColor = [r, g, b, 255]`, calls `syncColorUI()`
- Restores `EditorState._prevTool` (or falls back to `'pencil'`)
- Hides hover swatch and transparent label

**`tools.eyedropper.onCursor(x, y)`:**
- Draws crosshair on `cursor-canvas` (white lines, DPR-adjusted lineWidth)
- Updates `#eyedropper-hover-swatch` (shows pixel color as tiny swatch)
- Shows `#eyedropper-transparent-label` instead when `a === 0`

**Additional changes:**
- `setActiveTool()` updated: clears eyedropper hover UI when switching to any non-eyedropper tool
- `keydown` handler updated: `Escape` key cancels eyedropper, restores `_prevTool`, clears hover UI

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: `editor.html`
- FOUND: Task1 commit 2170d07
- FOUND: Task2 commit bcd9e13
- ALL 18 code presence checks passed
