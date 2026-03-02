# Testing Patterns

**Analysis Date:** 2026-03-02

## Test Framework

**Runner:**
- Not detected - no test framework configured
- No pytest, unittest, or similar runner found
- No `pytest.ini`, `setup.cfg`, or test configuration files

**Assertion Library:**
- Not applicable - no automated tests present

**Run Commands:**
```bash
# No test command exists - manual testing via example.py
python example.py              # Manual test of pixel-perfect detection
python web_app.py              # Run Flask server for manual UI testing
```

## Test File Organization

**Location:**
- No dedicated test directory (`tests/`, `test/`)
- Only manual test/example files present: `example.py` (46 lines)

**Naming:**
- Manual test file: `example.py` (not following `test_*.py` or `*_test.py` pattern)
- Integration demo rather than unit test

**Structure:**
```
/Users/calling/perfectPixel_ver1.1/
├── example.py                 # Manual testing script
├── web_app.py                 # Flask application (manual UI testing)
└── src/
    └── perfect_pixel/         # No test directory
```

## Test Structure

**Manual Testing Approach (example.py):**

```python
import cv2
import matplotlib.pyplot as plt
from src.perfect_pixel import get_perfect_pixel

path = "images/test.jpeg"
bgr = cv2.imread(path, cv2.IMREAD_COLOR)

if bgr is None:
    raise FileNotFoundError(f"Cannot read image: {path}")
rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

w, h, out = get_perfect_pixel(rgb, sample_method="center", refine_intensity=0.3, debug=True)

if w is None or h is None:
    print("Failed to generate pixel-perfect image.")
    exit(1)

# Visual verification via matplotlib
plt.figure(figsize=(10, 4))
plt.subplot(1, 2, 1)
plt.title("Input")
plt.imshow(rgb)
plt.axis("off")

plt.subplot(1, 2, 2)
plt.title(f"Pixel-perfect ({w}×{h})")
plt.imshow(out)
plt.axis("off")

plt.show()
```

**Patterns:**
- Manual image file-based testing (hardcoded `images/test.jpeg` path)
- Visual verification through matplotlib plots
- Simple success/failure check: `if w is None or h is None: exit(1)`
- Exit code-based status reporting
- No assertion framework - relying on visual inspection

## Mocking

**Framework:** Not applicable - no automated tests

**What Would Need Mocking:**
- OpenCV image I/O operations (`cv2.imread`, `cv2.imdecode`)
- NumPy operations could be partially mocked but integration-heavy algorithm makes this difficult
- Flask request/response cycle for `web_app.py` endpoints

## Fixtures and Factories

**Test Data:**
- Hardcoded test image paths: `images/test.jpeg`, `images/test1.jpeg`
- Alternative test images commented in `example.py`:
  ```python
  # path = "images/avatar.png"
  # path = "images/robot.jpeg"
  # path = "images/shanxi.jpg"
  # path = "images/skull.png"
  # path = "images/rika.png"
  # path = "images/car.png"
  ```

**Location:**
- Test images stored in `/Users/calling/perfectPixel_ver1.1/images/` directory
- Not tracked in `pyproject.toml` or listed as test dependencies
- Manual placement by user

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
# No coverage tooling available
# Manual testing only via example.py and web UI
```

## Test Types

**Unit Tests:**
- Not implemented
- Individual functions (`detect_peak()`, `sample_majority()`, `refine_grids()`) lack isolated test cases
- Algorithm functions tightly coupled to NumPy arrays without dependency injection

**Integration Tests:**
- Implicit integration via `example.py` - tests full `get_perfect_pixel()` pipeline
- Manual end-to-end testing via web UI: upload image → process → verify output

**E2E Tests:**
- Flask routes testable via manual web UI or HTTP client
- No automated E2E testing framework (Selenium, Cypress, etc.)
- Manual verification of:
  - `/api/process` endpoint (image upload, grid detection, output generation)
  - `/api/generate-palette` endpoint (palette quantization)
  - `/api/apply-palette` endpoint (palette remapping)

## Common Patterns

**Async Testing:**
Not applicable - codebase is synchronous/blocking

**Error Testing:**
- Manual error case verification in `example.py`:
  ```python
  if bgr is None:
      raise FileNotFoundError(f"Cannot read image: {path}")

  if w is None or h is None:
      print("Failed to generate pixel-perfect image.")
      exit(1)
  ```

**Flask Route Testing Example (Manual):**
- Routes return JSON with error payloads on failure:
  ```python
  if "image" not in request.files:
      return jsonify({"error": "No image uploaded"}), 400

  if bgr is None:
      return jsonify({"error": "Cannot decode image"}), 400

  try:
      rgb = b64_to_rgb(image_b64)
  except Exception as e:
      return jsonify({"error": f"Cannot decode image: {e}"}), 400
  ```
- HTTP status codes used for signaling error types
- Exception messages included in JSON response

## Testing Gaps

**Critical untested areas:**
- `detect_grid_scale()` - complex FFT/gradient-based grid detection
- `quantize_coverage_boost()` - iterative palette optimization (75+ lines)
- `refine_grids()` - grid line refinement with gradient-based search
- Palette format parsing: `parse_gpl()`, `parse_pal()`, `parse_act()`
- Color space conversions: `rgb_to_lab()`, `rgb_to_gray()`
- Flask route error handling paths (all exception branches)

**Data validation:**
- No input validation tests for image dimensions, color formats
- Palette size bounds not tested (`n_colors = max(2, min(512, n_colors))`)
- Grid size constraints not validated in unit tests

**Performance:**
- No benchmarks or regression tests for algorithm speed
- Large image handling untested

---

*Testing analysis: 2026-03-02*
