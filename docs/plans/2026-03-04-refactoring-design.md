# PerfectPixel Tools — Refactoring Design

**Date:** 2026-03-04
**Approach:** Strategy Pattern Refactoring (Plan A)
**Scope:** Full — Python backend + frontend + server + code rot cleanup

---

## Problem Statement

The codebase suffers from three categories of issues:

1. **Code rot** — 14 scattered `print()` statements, unused debug functions, stale comments
2. **Redundancy** — 350+ lines of duplicated algorithm logic across two Python backends, copy-pasted CSS/JS between HTML files
3. **Complexity** — `editor.html` is a 5000-line monolith, global state scattered across dozens of variables, `get_perfect_pixel()` violates SRP

---

## Part 1: Python Backend Refactoring

### Target Structure

```
src/perfect_pixel/
├── __init__.py              # Public API entry (get_perfect_pixel)
├── core.py                  # Pure algorithms: FFT, peak detection, grid refinement, sampling
├── ops.py                   # ImageOps Protocol definition
├── backend_cv2.py           # OpenCV implementation of ImageOps
├── backend_numpy.py         # NumPy-only implementation of ImageOps
├── perfect_pixel.py         # Backward-compat thin wrapper → imports from core
└── perfect_pixel_noCV2.py   # Backward-compat thin wrapper → imports from core
```

### ImageOps Protocol

```python
class ImageOps(Protocol):
    def sobel(self, gray: np.ndarray) -> tuple[np.ndarray, np.ndarray]: ...
    def morphology_open(self, binary: np.ndarray, ksize: int) -> np.ndarray: ...
    def connected_components(self, binary: np.ndarray) -> tuple[int, np.ndarray, np.ndarray]: ...
    def kmeans_2(self, pixels: np.ndarray) -> np.ndarray: ...
```

### Migration Rules

- Functions identical in both backends → move directly to `core.py`
- Functions differing only in image ops calls → move to `core.py`, accept `ops: ImageOps` parameter
- `print()` → `logging.getLogger(__name__)`
- `grid_layout()` debug function → remove
- Old files become thin wrappers for backward compatibility

---

## Part 2: Frontend editor.html Modularization

### Target Structure

```
editor/
├── editor.html              # HTML skeleton (~200 lines), <script src> imports
├── editor.css               # Editor-specific styles
├── shared.css               # Shared CSS variables + button styles (also used by web_ui.html)
├── js/
│   ├── color-utils.js       # rgbToHex, hexToRgb, hslToRgb (eliminates duplication)
│   ├── state.js             # EditorState + centralized state management
│   ├── history.js           # Undo/redo snapshot system
│   ├── canvas-render.js     # Three-layer Canvas rendering, drawAnts, zoom/pan
│   ├── tools.js             # Pencil/Eraser/Bucket/Marquee/Wand/Move/Eyedropper
│   ├── selection.js         # Selection management, marching ants, transform handles
│   ├── palette.js           # Palette generation/loading/applying/import/export
│   ├── rotsprite.js         # RotSprite rotation algorithm (Scale2x + downsample)
│   ├── canvas-size.js       # Canvas Size tool (S key)
│   └── main.js              # Initialization, event binding, tool dispatch
```

### Design Decisions

1. **No ES modules** — use traditional `<script src>` for zero-build-tool compatibility
2. **Global namespace** — modules mount to `window.PP` (e.g., `PP.State`, `PP.Tools`)
3. **Shared CSS** — `web_ui.html` links to `editor/shared.css`, eliminating CSS duplication
4. **Shared color-utils.js** — `web_ui.html` also references the same file

---

## Part 3: web_app.py Optimization

### Shared Utilities

- `decode_base64_image(data_url) -> PIL.Image` — eliminates 3x duplicated base64 decode
- `make_error(msg, code=400) -> Response` — unified error format and HTTP status codes
- `image_to_data_url(img, fmt='PNG') -> str` — unified image encoding

### Standardization

- Validation errors → HTTP 400
- Processing failures → HTTP 422
- Route grouping with clear section comments

---

## Part 4: Code Rot Cleanup

| Issue | Action |
|-------|--------|
| 14x `print()` | Replace with `logging` |
| `grid_layout()` debug function | Remove |
| Stale comments (`<!-- palette section removed -->`) | Delete |
| ComfyUI bare `except Exception` | Change to `except ImportError` |
| Hidden button residual code in `updateSelectionUI()` | Clean up |

---

## Non-Changes (Preserved)

- ComfyUI integration external API
- `pyproject.toml` package structure
- Flask route URLs (frontend fetch addresses unchanged)
- Core algorithm logic (relocated, not modified)
- `from perfect_pixel import get_perfect_pixel` continues to work
