# PerfectPixel — Project Instructions

## What This Is

PerfectPixel is a Python tool that auto-detects pixel art grids and refines AI-generated pixel images to be perfectly aligned. Ver 1.1 adds a local browser-based Web UI on top of the core algorithm library.

**Run it:**
```bash
pip install flask opencv-python numpy pillow
python3 web_app.py
# Open http://localhost:5010
```

---

## Architecture

```
perfectPixel/
├── src/perfect_pixel/          ← Core algorithm library (published to PyPI)
│   ├── __init__.py             ← Auto-selects CV2 or noCV2 backend
│   ├── perfect_pixel.py        ← OpenCV backend (fast)
│   └── perfect_pixel_noCV2.py  ← NumPy-only backend (lightweight)
├── web_app.py                  ← Flask server, port 5010 (Ver 1.1 addition)
├── web_ui.html                 ← Single-file frontend, no build step required
└── integrations/comfyui/       ← ComfyUI node integration
```

Two layers, kept separate:
- **Library layer** (`src/`): pure algorithm, no web dependency
- **Web layer** (`web_app.py` + `web_ui.html`): Flask UI wrapping the library

---

## Critical Rules

**Do not touch the core algorithm without explicit instruction:**
- `src/perfect_pixel/perfect_pixel.py`
- `src/perfect_pixel/perfect_pixel_noCV2.py`

These are the published library. Any change risks breaking grid detection behavior.

**If a bug fix is needed in one backend, apply it to both:**
- `perfect_pixel.py` (CV2) and `perfect_pixel_noCV2.py` (noCV2) must stay behaviorally consistent.
- The only public API is `get_perfect_pixel(image, ...)` — signature must not change.

**Do not add new dependencies to the library layer.**
The whole point of the noCV2 backend is that it only needs NumPy. Keep it that way.

---

## Code Conventions

**Python style:**
- 4-space indentation, no tabs
- `snake_case` for all functions and variables
- Single `_` prefix for private/internal helpers: `_nearest_indices()`, `_pillow_quantize()`
- Short math variable names are fine: `H`, `W`, `C`, `mx`, `mn`, `thr`

**Imports order:**
1. stdlib (`sys`, `os`, `io`, `json`)
2. third-party (`numpy`, `cv2`, `PIL`, `flask`)
3. project (`from perfect_pixel import get_perfect_pixel`)

**Error handling in web routes:**
```python
try:
    rgb = b64_to_rgb(image_b64)
except Exception as e:
    return jsonify({"error": f"Cannot decode image: {e}"}), 400
```
HTTP status codes: `400` (bad input), `422` (validation fail), `500` (server error).

**Comments:** Only where logic isn't obvious. Section headers use dash separators:
```python
# ── Palette file parsers ──────────────────────────────────────────
```

**No docstrings on new helpers** unless it's a public API function.

---

## Known Issues — Don't Make Worse

These are tracked concerns. Work around them rather than touching the fragile areas unless the task explicitly targets them:

- `refine_grids()` has potential infinite loop on certain inputs (floating-point boundary)
- Peak detection is sensitive to magic-number thresholds — don't change defaults
- `print()` statements used instead of logging — leave as-is unless task is to add logging
- File upload endpoints lack magic-byte validation — known security gap

---

## Web App Notes

- Flask port: **5010** (not 5000, not 5001)
- Max upload: 32 MB (`MAX_CONTENT_LENGTH`)
- All image data exchanged as base64 JSON between frontend and backend
- Frontend (`web_ui.html`) is a single self-contained file — inline CSS and JS, no build step
- Color state (saved palettes) lives in browser `localStorage` only

---

## What Ver 1.2 Plans to Add

From `VERSION_1.1.md` known limitations — these are planned next:
- Pixel editor (erase, brush, zoom)
- Undo / redo
- Server-side palette persistence (replace localStorage)
- Batch processing mode
