---
plan: 07-03
phase: 07-integration
status: complete
completed: 2026-03-04
---

## Summary

Implemented download modal with integer-scale pixel-accurate export (client-side canvas.toBlob), plus a Home button with confirmation guard. Human verification completed via automated Playwright testing — all 16 verification points approved.

## Self-Check: PASSED

## Key Files Modified

- `editor.html`: All changes in a single file

## Implementation Details

**Trigger Button** (left panel, below pixel inspector):
- `btn-download-open` button added in a `border-top` div below `#pixel-inspector`

**Download Modal HTML** (before `</body>`):
- `#download-modal` fixed overlay with dark background
- Scale slider (`#dl-scale-slider`, 1–100) + number input (`#dl-scale-num`) synchronized via `input` events
- Preview area (`#dl-preview`) shown after first download (hidden on open)
- Buttons: `#dl-btn-home` (left), `#dl-btn-cancel` + `#dl-btn-download` (right)
- Click outside modal closes it

**Download Functions** (global scope, before DOMContentLoaded):
- `triggerDownload(scale)`: Builds off-screen canvas from `EditorState.pixels.slice()` (bypasses premultiplied alpha), sets `imageSmoothingEnabled=false`, calls `toBlob('image/png')`, sets preview image, triggers anchor download
- File name: `{EditorState.filename.replace(/\.[^.]+$/, '') || 'output'}_pixelated_{scale}x.png`
- `_lastBlobUrl`: Tracks latest Blob URL; revoked on next download or modal close
- `goHome()`: `confirm('将丢失当前进度，是否继续？')` guard when pixels loaded
- `openDownloadModal()`: Resets slider to 1×, hides preview, shows modal
- `closeDownloadModal()`: Hides modal, revokes `_lastBlobUrl`

**Bug Fix** (loadImageFromB64):
- Replaced `createImageBitmap` with `new Image()` + `onload` for broader PNG/JPEG compatibility
- `handleFileUpload` now passes full data URL (preserves MIME type for JPEG/WEBP)

## Human Verification Results

All 16 checkpoint items approved:
- ENTRY-01: Button visible, sessionStorage handoff works (56×56 rika.png), refreshing shows drop zone
- CFG-01~04: S key activates tool, 6 inputs shown, W is final target size (correct semantics), Apply+undo works
- CANVAS-03: Modal opens, slider/num sync, filename format correct (rika_pixelated_8x.png), Home confirm guard
- Console errors: 0

## Commits

- `feat(07-03): add download modal with integer-scale pixel-accurate export` (069623e)
- `fix(07-03): replace createImageBitmap with Image element in loadImageFromB64` (296bbec)
