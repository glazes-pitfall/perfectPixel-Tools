# Codebase Concerns

**Analysis Date:** 2026-03-02

## Tech Debt

**Duplicate Implementation with Divergent Behavior:**
- Issue: Two parallel implementations of the same algorithm with inconsistencies: `perfect_pixel.py` (441 LOC) uses OpenCV for processing, while `perfect_pixel_noCV2.py` (490 LOC) reimplements features without CV2. The implementations differ in critical areas:
  - `sample_majority()` in CV2 version uses K-means clustering; noCV2 version uses manual K-means-like algorithm
  - Both have slightly different return value handling and edge case coverage
  - `estimate_grid_fft()` returns `(grid_w, grid_h)` in CV2 but `(grid_w, grid_h)` in noCV2 (line 380 vs 329)
- Files: `src/perfect_pixel/perfect_pixel.py`, `src/perfect_pixel/perfect_pixel_noCV2.py`
- Impact: Maintenance burden doubled; bug fixes must be applied to both; inconsistent behavior for users switching implementations
- Fix approach: Consolidate to single implementation with conditional CV2 imports, or create clear abstraction layer with unified interface

**Debug Print Statements Left in Production Code:**
- Issue: Extensive `print()` calls used for debugging are embedded in library code, not in logging framework
- Files: `src/perfect_pixel/perfect_pixel.py` (lines 318, 328, 335, 339, 350, 390, 430), `src/perfect_pixel/perfect_pixel_noCV2.py` (lines 372, 382, 389, 393, 404, 444, 484)
- Impact: Pollutes stdout when library is used programmatically; no way to suppress or redirect; unclear severity of messages ("failed", "detected" all use same channel)
- Fix approach: Replace all `print()` with Python logging module; allow configuration of log levels per function

**Unused Import and Debug Function:**
- Issue: `grid_layout()` function (lines 357-366 in perfect_pixel.py, lines 411-420 in noCV2) imports matplotlib and displays plots—only called when `debug=True` but not exported/documented
- Files: `src/perfect_pixel/perfect_pixel.py`, `src/perfect_pixel/perfect_pixel_noCV2.py`
- Impact: Adds matplotlib as hidden dependency when debug mode used; matplotlib import is slow and pulls in GUI backend
- Fix approach: Move debug visualization to separate optional module; document debug parameter; make matplotlib an optional dev dependency

**Hard-Coded Magic Numbers and Parameters:**
- Issue: Numerous hard-coded thresholds throughout algorithm without documentation or constants:
  - `peak_width=6` (default across multiple functions)
  - `rel_thr=0.35` in `detect_peak()` (line 30)
  - `refine_intensity=0.25` default (lines 208, 368)
  - `max_pixel_size=20.0` (line 333)
  - `min_dist=6` in `detect_peak()` (line 30)
  - `min_interval=4` (line 293)
  - Hard-coded LAB threshold `15` and `5.0` in web_app.py quantization (lines 245, 278)
- Files: `src/perfect_pixel/perfect_pixel.py`, `src/perfect_pixel/perfect_pixel_noCV2.py`, `web_app.py`
- Impact: Algorithm tuning requires code edits; no clear justification for values; difficult to adapt to different image types
- Fix approach: Extract to configuration constants at module level with comments explaining each parameter's purpose

## Known Bugs

**Potential Infinite Loop in Grid Refinement:**
- Symptoms: `refine_grids()` may hang on certain image inputs
- Files: `src/perfect_pixel/perfect_pixel.py` (lines 225-244), `src/perfect_pixel/perfect_pixel_noCV2.py` (lines 282-302)
- Trigger: While loops (lines 225, 230, 236, 241) lack explicit iteration limits and rely entirely on floating-point boundary checks (`while(x < W + cell_w/2)`)
- Workaround: Set conservative `refine_intensity` values; pre-validate grid size output
- Root cause: Floating-point arithmetic accumulation in `x += cell_w` or `x -= cell_w` can oscillate near boundary; if `find_best_grid()` returns same value repeatedly, loop never advances

**Grid Detection Failure Silently Returns Original Image:**
- Symptoms: Failed grid detection returns `(None, None, original_image)` making it hard to distinguish between intentional pass-through and actual failure
- Files: `src/perfect_pixel/perfect_pixel.py` (line 391), `src/perfect_pixel/perfect_pixel_noCV2.py` (line 445)
- Trigger: Any image where both FFT and gradient methods fail
- Workaround: Check return values explicitly; log messages are printed but not structured
- Root cause: No dedicated "failure" return type; None-checking is caller's responsibility

**Sample Center Method Doesn't Clip to Valid Range:**
- Symptoms: `sample_center()` may produce clipped coordinates without bounds checking
- Files: `src/perfect_pixel/perfect_pixel.py` (lines 110-118), `src/perfect_pixel/perfect_pixel_noCV2.py` (lines 178-183)
- Trigger: Grid lines at image edges with floating-point rounding
- Root cause: CV2 version clips (line 114), but noCV2 version does not clip (line 181)—inconsistent behavior between implementations

## Security Considerations

**No File Upload Validation in Web App:**
- Risk: Flask endpoint `/api/parse-palette` accepts file uploads without type/size validation beyond Flask's MAX_CONTENT_LENGTH
- Files: `web_app.py` (lines 465-498)
- Current mitigation: MAX_CONTENT_LENGTH set to 32 MB (line 17); file extension checked but not validated against actual content
- Recommendations:
  - Validate file magic bytes (first 4-8 bytes) against claimed extension
  - Whitelist specific file types (PNG, ACT, GPL, PAL only)
  - Add file size limits per type (palette files should be <1 MB)
  - Sanitize filename before using in responses

**Potential Large Memory Allocation:**
- Risk: `quantize_coverage_boost()` processes entire image in memory without downsampling; large images (>100 MB) may cause OOM
- Files: `web_app.py` (lines 207-299)
- Current mitigation: None; relies on system RAM
- Recommendations:
  - Add image size limit validation
  - Implement progressive quantization for large images
  - Add timeout to iterative refinement loop (currently `for _ in range(n_colors)` with no max execution time)

**Base64 Image Decoding Without Size Checks:**
- Risk: `/api/generate-palette` and `/api/apply-palette` decode base64 without pre-validation; malformed input crashes decoder
- Files: `web_app.py` (lines 407-410, 436-440)
- Current mitigation: Try-except catches generic Exception and returns 400; actual error not logged
- Recommendations:
  - Validate base64 format before decoding
  - Log actual decode errors for debugging
  - Rate-limit endpoints to prevent DOS

## Performance Bottlenecks

**Nested Loop in Palette Color Matching:**
- Problem: `apply_palette_swap()` (line 302-326) uses vectorized operations but `_nearest_indices()` (line 153-158) computes pairwise distances: O(N*K) where N=pixels, K=palette size
- Files: `web_app.py` (lines 153-158, 302-326)
- Cause: For large images (8K+) with many colors (256+), this becomes millions of distance computations
- Improvement path:
  - Use KD-tree or ball tree for nearest neighbor queries
  - Implement spatial hashing for LAB color lookup
  - Cache distance matrix if palette is reused

**FFT Grid Detection is Expensive:**
- Problem: `estimate_grid_fft()` (line 251) performs 2D FFT on every image, even when gradient method would suffice
- Files: `src/perfect_pixel/perfect_pixel.py` (lines 251-276), `src/perfect_pixel/perfect_pixel_noCV2.py` (lines 308-331)
- Cause: No early exit; FFT always computed before trying gradient fallback
- Improvement path:
  - Try gradient method first (faster, simpler)
  - Only use FFT if gradient fails and image is high resolution
  - Add optional mode to skip FFT entirely

**Repeated Gradient Calculation:**
- Problem: `refine_grids()` recalculates Sobel gradients even after `detect_grid_scale()` already computed them
- Files: `src/perfect_pixel/perfect_pixel.py` (lines 208-249), `src/perfect_pixel/perfect_pixel_noCV2.py` (lines 268-306)
- Cause: No caching or pipeline; each module computes independently
- Improvement path: Cache gradient results from detection phase for refinement phase

**Manual 2D Convolution in noCV2 Version:**
- Problem: `conv2d_same()` (perfect_pixel_noCV2.py lines 26-42) uses nested loops for convolution, O(H*W*kernel_size²)
- Files: `src/perfect_pixel/perfect_pixel_noCV2.py` (lines 26-42)
- Cause: Pure NumPy implementation; no vectorization of kernel operations
- Improvement path: Vectorize kernel application or use scipy.ndimage.convolve if scipy dependency acceptable

## Fragile Areas

**Peak Detection Algorithm Highly Sensitive to Parameters:**
- Files: `src/perfect_pixel/perfect_pixel.py` (lines 30-87), `src/perfect_pixel/perfect_pixel_noCV2.py` (lines 99-153)
- Why fragile:
  - Hard-coded thresholds (rel_thr=0.35, peak_width=6, min_dist=6)
  - Custom peak-finding logic with overlapping conditions (lines 40-68)
  - Left/right candidate filtering uses magic multipliers (0.25, 1.75 on line 74-75)
  - No unit tests for edge cases (flat images, multiple peaks, noisy data)
- Safe modification:
  - Extract all thresholds to named parameters with defaults
  - Add parameter validation (peak_width >= 3, etc.)
  - Add comprehensive test suite with synthetic grid patterns
- Test coverage: Untested for images with non-uniform grid spacing, very fine grids, or degraded input

**Grid Coordinate Sorting and Boundary Conditions:**
- Files: `src/perfect_pixel/perfect_pixel.py` (lines 246-249), `src/perfect_pixel/perfect_pixel_noCV2.py` (lines 304-306)
- Why fragile:
  - Coordinates assumed to be sorted; no validation
  - Boundary coordinates at 0 and W/H assumed valid
  - `sample_center()`, `sample_majority()`, `sample_median()` all perform independent boundary checks (inconsistent)
- Safe modification:
  - Validate coordinate monotonicity in `refine_grids()` before returning
  - Centralize boundary clipping logic into shared utility function
  - Add assertions for coordinate ranges in sampling functions

**Color Space Conversion (RGB to LAB) Lacks Input Validation:**
- Files: `web_app.py` (lines 119-148)
- Why fragile:
  - Assumes RGB input is uint8 or float32; no type checking
  - No validation that input is exactly 3-channel RGB
  - Hard-coded D65 white point and sRGB gamma; not documented as assumptions
  - Handles grayscale via reshaping but this is a footgun for callers
- Safe modification:
  - Add explicit type and shape assertions at function entry
  - Document color space assumptions prominently
  - Consider accepting parameters for custom white points/gammas

## Scaling Limits

**Memory Usage with High-Resolution Images:**
- Current capacity: Successfully handles ~8K images on systems with 16GB RAM
- Limit: 100+ MP images will exhaust memory during quantization and LAB conversion
- Problem: Full image loaded into memory in multiple places (original, float32 copy, LAB conversion, distance matrix)
- Scaling path:
  - Implement tile-based processing for large images
  - Stream quantization in 512x512 blocks with overlapping boundaries
  - Use memory-mapped arrays for intermediate results

**Number of Colors in Quantization:**
- Current: Web UI sets `min(512, n_colors)` (line 400); performance acceptable up to 256
- Limit: 256+ colors becomes slow due to nested palette matching loops
- Scaling path: Implement hierarchical color tree or use scikit-learn KMeans for large palettes

## Dependencies at Risk

**OpenCV Dependency Fragility:**
- Risk: `perfect_pixel.py` requires OpenCV but project structure suggests it's optional (separate `perfect_pixel_noCV2.py`)
- Files: `src/perfect_pixel/perfect_pixel.py`, `src/perfect_pixel/__init__.py`
- Problem: `__init__.py` likely imports from one or both versions; no clear selection logic for CV2 availability
- Check: Read `src/perfect_pixel/__init__.py` to verify import strategy
- Migration path: Use feature detection to import compatible version at runtime

**Pillow API Assumptions:**
- Risk: Web app uses Pillow's `Image.Quantize.FASTOCTREE` and `MEDIANCUT` (lines 188, 414)—these are relatively new enums (Pillow 9.1.0+)
- Files: `web_app.py` (lines 176-188, 412-418)
- Problem: Requires Pillow >= 9.1.0; older versions will error silently or crash
- Recommendation: Add explicit version requirement to pyproject.toml or add Pillow to web_app dependencies (currently missing)

**NumPy Memory Behavior with Large Arrays:**
- Risk: Repeated reshapes and array operations may cause memory fragmentation
- Files: Multiple sampling functions reshape arrays extensively
- Problem: No explicit memory cleanup or gc hints; large images may OOM despite sufficient available RAM
- Recommendation: Consider pre-allocating output arrays rather than relying on NumPy auto-allocation

## Missing Critical Features

**No Input Image Format Validation:**
- Problem: Web app assumes all uploaded files are valid images but provides no format verification
- Blocks: Impossible to distinguish corrupt vs. unsupported format in error message
- Files: `web_app.py` (lines 351-365, 408)
- Impact: Users get cryptic "Cannot decode image" without guidance on supported formats (PNG, JPEG, BMP, etc.)

**No Configuration File Support:**
- Problem: Algorithm parameters hard-coded; no way to customize defaults without editing code
- Blocks: Deployment scenarios needing parameter tuning for specific use cases
- Impact: Web UI defaults may not suit all image types; requires Python code changes

**No Progress Reporting for Long Operations:**
- Problem: Grid detection and quantization can take 5-30 seconds on large images; no client feedback
- Blocks: Web UI appears frozen; users may retry thinking request failed
- Impact: Poor user experience with 4K+ images

## Test Coverage Gaps

**Peak Detection Edge Cases:**
- What's not tested: Very small grids (< 4 pixels), grids with noise, off-center grids, asymmetric grids
- Files: `src/perfect_pixel/perfect_pixel.py` (lines 30-87), `src/perfect_pixel/perfect_pixel_noCV2.py` (lines 99-153)
- Risk: Algorithm may fail silently on edge cases, returning None and degrading gracefully without warning
- Priority: High (core algorithm)

**Boundary Conditions in Sampling:**
- What's not tested: Images where grid lines fall exactly on edges, single-pixel cells, zero-size cells
- Files: `src/perfect_pixel/perfect_pixel.py` (lines 110-207), `src/perfect_pixel/perfect_pixel_noCV2.py` (lines 178-266)
- Risk: Index errors, division by zero, or incorrect sampling at boundaries
- Priority: High (common in edge cases)

**Web API Error Conditions:**
- What's not tested: Malformed JSON, missing form fields, oversized uploads, invalid base64
- Files: `web_app.py` (lines 351-463)
- Risk: Crashes with 500 errors instead of graceful 400 responses; no error logging for debugging
- Priority: Medium (impacts production stability)

**Cross-Implementation Consistency:**
- What's not tested: CV2 vs noCV2 implementations producing identical output for same input
- Files: `src/perfect_pixel/perfect_pixel.py` vs `src/perfect_pixel/perfect_pixel_noCV2.py`
- Risk: Inconsistent user experience; bugs may exist in one implementation but not the other
- Priority: High (maintenance risk)

**LAB Color Space Conversion:**
- What's not tested: Input validation (non-RGB inputs, wrong shape, invalid values)
- Files: `web_app.py` (lines 119-148)
- Risk: Silent failures or NaN propagation in distance calculations
- Priority: Medium (used in palette matching)

---

*Concerns audit: 2026-03-02*
