# Coding Conventions

**Analysis Date:** 2026-03-02

## Naming Patterns

**Files:**
- Module files: `snake_case.py` (e.g., `perfect_pixel.py`, `perfect_pixel_noCV2.py`)
- Private/internal modules indicated by filename, not prefix (e.g., `_noCV2` variant for NumPy-only implementation)
- Application entry point: `web_app.py`

**Functions:**
- All functions use `snake_case` (e.g., `parse_gpl()`, `rgb_to_lab()`, `get_perfect_pixel()`)
- Private/internal functions prefixed with single underscore: `_nearest_indices()`, `_pillow_quantize()`, `_deduplicate_palette()`
- Sampling functions: `sample_center()`, `sample_majority()`, `sample_median()`
- Conversion functions: `rgb_to_lab()`, `rgb_to_gray()`, `b64_to_rgb()`

**Variables:**
- Local variables use `snake_case`: `rgb_array`, `image_b64`, `palette_json`, `refine_intensity`
- Short mathematical variables acceptable: `H`, `W`, `C` (height, width, channels), `mx`, `mn` (max, min), `thr` (threshold), `N`, `K` (dimensions)
- Loop counters: `i`, `j`, `k` for nested operations
- Array shapes: `(N, K, 3)` notation in comments to clarify tensor dimensions

**Types:**
- No explicit type hints in function signatures (follows pattern of existing codebase)
- NumPy arrays documented with shape in comments: `pixels_feat: (N, 3)`, `palette_feat: (K, 3)`
- Color representations: `[r, g, b]` lists, `np.ndarray` with dtype specified in code

## Code Style

**Formatting:**
- 4-space indentation, no tabs
- Line continuation with backslash at operators (seen in web_app.py line 27-28)
- Blank lines between logical sections (minimum 1 blank line between function definitions)
- Section headers use dash separators: `# ── Palette file parsers ────────────────────────────────────────────────`

**Linting:**
- No explicit linting config found (`.eslintrc`, `.pylintrc`, etc. not present)
- Code appears to follow PEP 8 conventions informally

**Import Organization:**
1. Standard library first: `sys`, `os`, `io`, `json`, `struct`, `base64`
2. Third-party libraries: `numpy`, `cv2`, `PIL`, `flask`, `torch` (for ComfyUI integration)
3. Local imports: `from perfect_pixel import get_perfect_pixel`

Example from `web_app.py`:
```python
import sys
import os
import base64
import io
import json
import struct

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

import cv2
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify, send_file, Response
from perfect_pixel import get_perfect_pixel
```

**Path Aliases:**
- None detected. Standard relative imports used.

## Error Handling

**Web Routes (Flask):**
- Try-except blocks with specific error messages returned as JSON with HTTP status codes:
  - `400` - Bad input (missing files, decoding errors)
  - `422` - Validation failure (grid detection failed)
  - `500` - Server error (algorithm failures)

Example pattern from `web_app.py` (lines 407-410):
```python
try:
    rgb = b64_to_rgb(image_b64)
except Exception as e:
    return jsonify({"error": f"Cannot decode image: {e}"}), 400
```

**Algorithm Functions:**
- Return `None` or `(None, None)` on detection/parsing failures
- Callers check for `None` explicitly:
  ```python
  if grid_w is None or grid_h is None:
      return jsonify({"error": "Grid detection failed..."}), 422
  ```

**Silent Fallbacks:**
- Palette parsing uses exception handling with continue for malformed lines (lines 34-35 of web_app.py)
- No exceptions raised; empty results returned if no valid colors extracted

## Logging

**Framework:** `print()` statements only (no logging module)

**Patterns:**
- Debug status messages: `print(f"Detected grid size from gradient: ({scale_x:.2f}, {scale_y:.2f})")`
- Fallback notifications: `print("FFT-based grid estimation failed, fallback to gradient-based method.")`
- Final results: `print(f"Refined grid size: ({refined_size_x}, {refined_size_y})")`
- No structured logging; simple string formatting with f-strings

Location of print statements:
- `perfect_pixel.py`: Grid detection results (lines 318, 328, 335, 339, 350, 430)
- `web_app.py`: Application startup (line 540)

## Comments

**When to Comment:**
- Section headers for logical groupings (dash separators)
- Algorithm intent before complex calculations (e.g., "Morphological opening removes isolated noise pixels" at line 249)
- State what, not how (e.g., "Keep only connected components >= min_px pixels" rather than loop structure)

**JSDoc/TSDoc:**
- Used for public API functions only
- Example from `web_app.py` (lines 22-23):
  ```python
  def parse_gpl(text):
      """Parse GIMP Palette (.gpl) text → list of [r, g, b]"""
  ```
- Docstrings are one-liners for private functions, omitted for simple helpers
- No parameter/return documentation in docstrings; inferred from code

## Function Design

**Size:** Functions range from 2-100 lines; most under 40 lines. Larger functions are algorithm implementations with clear phases.

**Parameters:**
- Most functions take 2-5 parameters
- Default parameters used for optional settings: `refine_intensity=0.25`, `use_lab=False`, `min_region_pct=1.0`
- Boolean flags for mode selection: `fix_square=True`, `debug=False`
- Request form data unpacked individually from Flask `request.form.get()`

**Return Values:**
- Single values for simple computations
- Tuples for multiple related outputs: `(grid_w, grid_h)`, `(gx, gy)`
- Arrays for image processing operations
- JSON-serializable dicts for Flask routes: `{"palette": palette, "count": len(palette)}`

## Module Design

**Exports:**
- Core library exposes single public function: `get_perfect_pixel()` via `__init__.py`
- Web app routes defined directly with `@app.route()` decorators
- Palette parsing/export functions defined at module level but clearly sectioned with comments

**Barrel Files:**
- Used in library layer: `src/perfect_pixel/__init__.py` (lines 1-18)
- Imports both CV2 and noCV2 backends, tries CV2 first, falls back to NumPy
- Exports only `get_perfect_pixel` via `__all__ = ["get_perfect_pixel"]`

Example from `src/perfect_pixel/__init__.py`:
```python
__version__ = "0.1.2"

from .perfect_pixel_noCV2 import get_perfect_pixel as _get_perfect_pixel_numpy

try:
    import cv2
    from .perfect_pixel import get_perfect_pixel as _get_perfect_pixel_opencv
    get_perfect_pixel = _get_perfect_pixel_opencv
except ImportError:
    _get_perfect_pixel_opencv = None
    get_perfect_pixel = _get_perfect_pixel_numpy

__all__ = ["get_perfect_pixel"]
```

## Dual Backend Pattern

**CV2 Backend** (`perfect_pixel.py`):
- Uses OpenCV for fast operations
- Functions: `estimate_grid_fft()`, `estimate_grid_gradient()`, `detect_grid_scale()`, `refine_grids()`, `sample_majority()` (with `cv2.kmeans`)
- Algorithm heavy with image processing primitives

**NumPy-only Backend** (`perfect_pixel_noCV2.py`):
- Reimplements core algorithms without CV2 (for lightweight deployments)
- Custom implementations: `rgb_to_gray()`, `sobel_xy()`, `conv2d_same()` (manual convolution)
- Same public API: `get_perfect_pixel()` with identical signature
- Behavioral consistency: Must maintain feature parity with CV2 backend

**Key Rule:**
If bug fix applied to one backend, apply to both. Signature of `get_perfect_pixel(image, sample_method, grid_size, min_size, peak_width, refine_intensity, fix_square, debug)` must not change.

---

*Convention analysis: 2026-03-02*
