# Coding Conventions

**Analysis Date:** 2026-03-02

## Naming Patterns

**Files:**
- Module files use `snake_case`: `perfect_pixel.py`, `perfect_pixel_noCV2.py`
- Variant implementations suffixed with descriptive names: `perfect_pixel_noCV2.py` (no OpenCV2 dependency variant)
- Web application file: `web_app.py`

**Functions:**
- All functions use `snake_case`: `get_perfect_pixel()`, `detect_grid_scale()`, `sample_majority()`
- Private/internal functions prefixed with single underscore: `_nearest_indices()`, `_pillow_quantize()`, `_deduplicate_palette()`
- Descriptive, action-oriented names: `compute_fft_magnitude()`, `detect_peak()`, `apply_palette_swap()`
- API route handlers named with prefix matching functionality: `api_generate_palette()`, `api_apply_palette()`

**Variables:**
- Loop counters use single letters: `i`, `j`, `k`, `x`, `y`, `H`, `W`
- Short mathematical variables: `mx` (max), `mn` (min), `thr` (threshold), `ker` (kernel), `sigma`
- Descriptive names for arrays/data: `x_coords`, `y_coords`, `grad_x_sum`, `grad_y_sum`, `palette_a`, `palette_b`
- Abbreviated coordinate names in image processing: `x`, `y`, `H` (height), `W` (width), `C` (channels)
- Color array names: `rgb`, `bgr`, `gray`, `pixels`, `palette`

**Types:**
- Numpy arrays suffix with data representation: `_array`, `_sum`, `_idx`
- Boolean flags descriptive: `fix_square`, `debug`, `use_lab`
- Configuration parameters fully spelled: `refine_intensity`, `sample_method`, `export_scale`

## Code Style

**Formatting:**
- No explicit linter/formatter detected (no `.flake8`, `.pylintrc`, `pyproject.toml` linting config)
- Consistent 4-space indentation throughout
- Line length varies, some lines exceed 100 characters (e.g., `if grad_x_sum[i] > grad_x_sum[i - 1] and grad_x_sum[i] > grad_x_sum[i + 1] and grad_x_sum[i] >= thr_x:`)
- Blank lines between logical sections (2-3 blank lines before major function blocks)

**Linting:**
- No linter configuration detected
- Code uses PyPI packages without strict version pinning beyond `requires-python = ">=3.8"` in `pyproject.toml`

## Import Organization

**Order:**
1. Standard library imports: `sys`, `os`, `base64`, `io`, `json`, `struct`
2. Third-party imports: `numpy`, `cv2`, `PIL`, `flask`
3. Project imports: `from src.perfect_pixel import get_perfect_pixel`

**Path Aliases:**
- No path aliases (`@` syntax) detected
- Direct relative imports used: `from src.perfect_pixel import get_perfect_pixel`
- Module-level import fallback pattern: `try/except ImportError` for optional dependencies (`cv2`)

**Pattern from `__init__.py`:**
```python
try:
    import cv2
    from .perfect_pixel import get_perfect_pixel as _get_perfect_pixel_opencv
    get_perfect_pixel = _get_perfect_pixel_opencv
except ImportError:
    _get_perfect_pixel_opencv = None
    get_perfect_pixel = _get_perfect_pixel_numpy
```

## Error Handling

**Patterns:**
- Web routes use `try/except Exception as e` with JSON error responses
- Try blocks wrap external operations (image decode, quantization, color space conversion)
- Generic `Exception` catching used for broad error handling: `except Exception as e:`
- Specific `ValueError` catching in parsers: `except ValueError: continue`
- Return `None` for failure cases without raising: `if grid_w is None or grid_h is None: return None, None, image`
- JSON error responses with HTTP status codes: `400` (missing data), `422` (validation failure), `500` (server error)

**Pattern from `web_app.py` routes:**
```python
try:
    rgb = b64_to_rgb(image_b64)
except Exception as e:
    return jsonify({"error": f"Cannot decode image: {e}"}), 400
```

## Logging

**Framework:** `console.log` style via `print()` statements (no logging module used)

**Patterns:**
- Information-level messages: `print(f"Detected grid size from gradient: ({scale_x:.2f}, {scale_y:.2f})")`
- Debug/status messages: `print("FFT-based grid estimation failed, fallback to gradient-based method.")`
- Application startup: `print("Perfect Pixel Web UI running at http://localhost:5010")`
- No formal logging levels (DEBUG, INFO, ERROR) - all print statements
- Debug output controlled by optional `debug=True` parameter triggering `grid_layout()` visualization

## Comments

**When to Comment:**
- Inline comments for non-obvious algorithm details: `# log(1 + |F|)`, `# enforce a dead-zone around center`
- Section delimiters using dashes: `# ── Palette file parsers ────────────────────────────────────────────────────`
- Algorithm step comments: `# Step 1: initialize palette with FASTOCTREE`
- Sparse usage - most code is self-documenting via function/variable names

**JSDoc/TSDoc:**
- Docstrings used for major public functions only
- Single-line docstrings for simple functions: `"""Parse GIMP Palette (.gpl) text → list of [r, g, b]"""`
- Multi-line docstrings for complex functions with parameter descriptions:
```python
def get_perfect_pixel(image, sample_method="center", grid_size = None, min_size = 4.0, peak_width = 6, refine_intensity = 0.25, fix_square = True, debug=False):
    """
    Args:
        image: RGB Image (H * W * 3)
        sample_method: "majority", "center", or "median"
        grid_size: Manually set grid size (grid_w, grid_h) to override auto-detection
    ...
    returns:
        refined_w, refined_h, scaled_image
    """
```
- Type hints used in `perfect_pixel_noCV2.py`: `def rgb_to_gray(image_rgb: np.ndarray) -> np.ndarray:`
- Type hints inconsistently applied (present in `perfect_pixel_noCV2.py`, absent in `perfect_pixel.py`)

## Function Design

**Size:**
- Range from 5-line utility functions to 100+ line complex algorithms
- Long functions typical for image processing: `detect_grid_scale()` (34 lines), `get_perfect_pixel()` (68 lines), `quantize_coverage_boost()` (75+ lines)

**Parameters:**
- Mix of required positional and optional keyword arguments
- Default values provided for algorithm tuning: `peak_width=6`, `rel_thr=0.35`, `min_dist=6`
- Configuration parameters with sensible defaults: `refine_intensity=0.25`, `fix_square=True`, `debug=False`
- Numpy array types dominant in image processing functions

**Return Values:**
- Multiple return values common: `return grid_w, grid_h` or `return refined_size_x, refined_size_y, scaled_image`
- `None` returned for failure cases: `return None, None` or `return None`
- Tuple unpacking in callers: `grid_w, grid_h, out = get_perfect_pixel(...)`

## Module Design

**Exports:**
- Single public export in `__init__.py`: `__all__ = ["get_perfect_pixel"]`
- All other functions are module-private or internal helpers
- Fallback export pattern for optional dependencies (OpenCV vs NumPy implementations)

**Barrel Files:**
- `__init__.py` acts as barrel file, re-exporting single public function
- Implementation files (`perfect_pixel.py`, `perfect_pixel_noCV2.py`) contain full algorithm suite but not directly imported by consumers
- Web app imports directly: `from perfect_pixel import get_perfect_pixel` (not from barrel)

---

*Convention analysis: 2026-03-02*
