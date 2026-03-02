# Testing Patterns

**Analysis Date:** 2026-03-02

## Test Framework

**Current State:**
- No test framework installed or configured
- No test files present in codebase
- No pytest.ini, setup.cfg, tox.ini, or pyproject.toml test configuration

**Tools Used Instead of Tests:**
- Manual testing: `example.py` script uses `get_perfect_pixel()` with sample images and `matplotlib` for visualization
- Direct invocation: `python3 example.py` loads image and displays side-by-side before/after

## Test File Organization

**Current Pattern:**
- No dedicated tests directory or test files (`tests/`, `test_*`, `*_test.py` all absent)
- Single example script at `example.py` serves as manual test
- Web application testing done via browser at `http://localhost:5010`

**Where Tests Should Go** (if added):
- Unit tests for algorithm functions: `tests/test_perfect_pixel.py`, `tests/test_perfect_pixel_noCV2.py`
- Integration tests for grid detection: `tests/test_grid_detection.py`
- Web route tests: `tests/test_web_routes.py`
- Palette parsing tests: `tests/test_palette_parsing.py`

## Manual Testing Pattern (Current)

**Script Location:**
- `example.py` (lines 1-45): Demonstrates typical workflow

**Structure:**
```python
import cv2
import matplotlib.pyplot as plt
from src.perfect_pixel import get_perfect_pixel

# Load image
bgr = cv2.imread(path, cv2.IMREAD_COLOR)
if bgr is None:
    raise FileNotFoundError(f"Cannot read image: {path}")
rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

# Call algorithm
w, h, out = get_perfect_pixel(
    rgb,
    sample_method="center",
    refine_intensity=0.3,
    debug=True
)

# Check for success
if w is None or h is None:
    print("Failed to generate pixel-perfect image.")
    exit(1)

# Visual verification
plt.figure(figsize=(10, 4))
plt.subplot(1, 2, 1)
plt.imshow(rgb)
plt.subplot(1, 2, 2)
plt.imshow(out)
plt.show()

# Save output
cv2.imwrite("output.png", out_bgr)
```

**What This Tests:**
- File I/O (image loading)
- Format conversion (BGR to RGB)
- Core algorithm execution
- Failure mode handling (None checks)
- File output (PNG save)
- Manual visual inspection

## Web Route Testing Pattern

**Location:**
- `web_app.py` defines 5 POST routes without unit tests
- Routes tested manually via curl, browser form, or frontend JavaScript

**Route Tests Needed:**
1. `/api/process` (line 351): Requires form file + parameters
2. `/api/generate-palette` (line 395): Requires base64 image + quantization params
3. `/api/apply-palette` (line 425): Requires base64 image + palette JSON
4. `/api/parse-palette` (line 465): Requires uploaded palette file
5. `/api/export-palette` (line 501): Requires palette JSON + format selection

**Error Handling Patterns to Test:**
- Missing required fields: `if "image" not in request.files`
- Invalid image data: `if bgr is None:`
- Parsing failures: Try-except with specific exception messages (line 407-410)
- Validation ranges: `n_colors = max(2, min(512, n_colors))`

Example error response:
```python
try:
    rgb = b64_to_rgb(image_b64)
except Exception as e:
    return jsonify({"error": f"Cannot decode image: {e}"}), 400
```

## Coverage Gaps

**Untested Areas (High Priority):**

1. **Grid Detection Algorithms** (`perfect_pixel.py`):
   - `estimate_grid_fft()`: FFT-based grid size estimation
   - `estimate_grid_gradient()`: Gradient-based fallback
   - `detect_peak()`: Peak detection with magic-number thresholds
   - `refine_grids()`: Grid line refinement (has potential infinite loop issue per CLAUDE.md)
   - No unit tests for edge cases: empty images, very small images, invalid inputs

2. **Sampling Methods** (`perfect_pixel.py`):
   - `sample_center()`: Center-pixel sampling
   - `sample_majority()`: K-means based majority voting
   - `sample_median()`: Median sampling
   - No tests for boundary conditions or sampling accuracy

3. **Color Space Conversions** (`web_app.py`):
   - `rgb_to_lab()`: sRGB linearization + XYZ + LAB conversion (lines 119-148)
   - `rgb_to_gray()` (noCV2 backend): BT.709 luminance formula
   - No tests for color accuracy, edge cases (black, white, pure colors)

4. **Palette Operations** (`web_app.py`):
   - `quantize_coverage_boost()`: Complex iterative palette optimization (lines 207-299)
   - `apply_palette_vector()`: Nearest-color mapping in RGB/LAB
   - `apply_palette_swap()`: Two-step palette matching
   - No tests for palette quality, convergence, color matching accuracy

5. **Palette File Parsing** (`web_app.py`):
   - `parse_gpl()`: GIMP palette format (lines 22-36)
   - `parse_pal()`: JASC-PAL format (lines 39-56)
   - `parse_act()`: Adobe Color Table binary (lines 59-74)
   - `parse_png_palette()`: Extract unique colors from PNG (lines 77-81)
   - No tests for malformed files, missing headers, truncated data

6. **Dual Backend Consistency** (`perfect_pixel.py` vs `perfect_pixel_noCV2.py`):
   - No tests to verify CV2 and NumPy backends produce identical results
   - No regression tests to ensure fallback behavior works

7. **Web Route Validation**:
   - Base64 decoding robustness
   - JSON parsing edge cases
   - File upload size limits (32 MB)
   - Palette data validation (empty palettes, invalid RGB values)

8. **ComfyUI Integration** (`integrations/comfyui/PerfectPixelComfy/nodes_perfect_pixel.py`):
   - Backend selection ("Auto", "OpenCV Backend", "Lightweight Backend")
   - Format conversion helpers: `_torch_image_to_uint8_rgb()`, `_uint8_rgb_to_torch_image()`
   - No tests present

## Test Coverage Requirements

**Recommended Testing Strategy:**

1. **Unit Tests (pytest):**
   ```bash
   pip install pytest pytest-cov numpy opencv-python pillow
   pytest tests/ -v --cov=src/perfect_pixel
   ```

2. **Minimum Coverage Targets:**
   - Core algorithm functions: 80%+ (especially grid detection)
   - Web routes: 70%+ (happy path + common errors)
   - Color conversion utilities: 90%+ (perceptual accuracy critical)

3. **Test Organization:**
   ```
   tests/
   ├── test_grid_detection.py      # FFT, gradient, peak detection
   ├── test_sampling.py             # center, majority, median
   ├── test_color_conversion.py     # RGB to LAB, gamma correction
   ├── test_palette_operations.py   # quantization, mapping, swapping
   ├── test_palette_parsing.py      # GPL, PAL, ACT, PNG parsing
   ├── test_web_routes.py           # Flask endpoints
   ├── test_backend_consistency.py  # CV2 vs NumPy parity
   ├── conftest.py                  # Shared fixtures
   └── fixtures/                    # Test images and palette files
   ```

## Running Existing Manual Tests

**Example Script:**
```bash
python3 example.py
```

**Output:**
- Displays matplotlib window with before/after comparison
- Saves `output.png` (refined grid image)
- Saves `output_8x.png` (8x scaled version)

**Web App Testing:**
```bash
python3 web_app.py
# Open http://localhost:5010 in browser
# Upload image, adjust parameters, verify output
```

## Debug Mode

**Enabled via Function Parameter:**
- `get_perfect_pixel(..., debug=True)` (line 368)
- When enabled: displays matplotlib grid overlay (lines 433-434)
- Shows detected grid lines overlaid on input image

Example invocation in `example.py` (line 19):
```python
w, h, out = get_perfect_pixel(rgb, sample_method="center", refine_intensity=0.3, debug=True)
```

---

*Testing analysis: 2026-03-02*
