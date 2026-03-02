# Codebase Concerns

**Analysis Date:** 2026-03-02

## Tech Debt

**Infinite Loop Risk in `refine_grids()`:**
- Issue: Grid refinement loops (`while x < W + cell_w/2`, `while x > -cell_w/2`) depend on `find_best_grid()` always returning a valid coordinate. Floating-point boundary conditions can cause the loop termination condition to never be met if `find_best_grid()` returns the exact same coordinate twice in succession.
- Files: `src/perfect_pixel/perfect_pixel.py` (lines 225-244), `src/perfect_pixel/perfect_pixel_noCV2.py` (lines 283-302)
- Impact: Process hangs indefinitely, UI becomes unresponsive, timeout required
- Fix approach: Add iteration counter with max limit (e.g., `max_iterations = grid_x * 2`), or track previous coordinate and break if unchanged after refinement
- Status: Known issue documented in CLAUDE.md — avoid changing without explicit task

**Hard-coded Magic Numbers in Peak Detection:**
- Issue: Peak detection thresholds are magic numbers not configurable: `rel_thr=0.35` in `detect_peak()`, `min_dist=6`, hardcoded sensitivity values
- Files: `src/perfect_pixel/perfect_pixel.py` (line 30), `src/perfect_pixel/perfect_pixel_noCV2.py` (line 99)
- Impact: Detection fails silently on edge cases; small variations in image quality (compression, noise) cause missed grids
- Fix approach: Expose as configurable parameters to `get_perfect_pixel()`, profile against image test set to find robust defaults
- Status: Known issue in CLAUDE.md — "don't change defaults unless task explicitly targets them"

**Print Statements Instead of Logging:**
- Issue: Debug output uses `print()` statements scattered throughout core algorithm (lines 318, 328, 335, 339, 350, 372, 390, 393, 404, 444 in both backends). No log level control, no structured output.
- Files: `src/perfect_pixel/perfect_pixel.py`, `src/perfect_pixel/perfect_pixel_noCV2.py`, `web_app.py`
- Impact: Cannot suppress debug output in production; stdout pollution; no way to filter by severity; hard to integrate with logging infrastructure
- Fix approach: Replace with Python `logging` module; add configurable log level; preserve backward compatibility
- Status: Known issue in CLAUDE.md — acceptable as-is unless task targets logging infrastructure

---

## Security Considerations

**File Upload Endpoints Lack Magic-Byte Validation:**
- Risk: `/api/process`, `/api/parse-palette` accept files without verifying magic bytes. An attacker could upload malformed or disguised binary files that cv2/PIL might misinterpret or crash on.
- Files: `web_app.py` (lines 352-365, 467-493)
- Current mitigation: Flask `MAX_CONTENT_LENGTH = 32 MB` prevents unbounded uploads; exception handling catches decode errors
- Recommendations:
  - Validate magic bytes before decoding (PNG: `89 50 4E 47`, JPEG: `FF D8 FF`, etc.)
  - Whitelist accepted MIME types
  - Add file size check per format (e.g., max 20 MB for images)
- Priority: Medium — local development environment, but best practice for production deployment

**Base64 Image Transmission Without Integrity Check:**
- Risk: All image data between frontend and backend exchanged as base64 JSON. No checksum or signature validation. Corrupted transmission could silently produce garbage output.
- Files: `web_app.py` (lines 337-341), `web_ui.html` (palette/image data handling)
- Current mitigation: `b64_to_rgb()` has try-except for decode failures; cv2.imdecode() rejects invalid data
- Recommendations: Add SHA256 checksum of original image, verify on server side before processing
- Priority: Low — local development; not critical for ver 1.1

**No Input Validation on Color Values in Palette JSON:**
- Risk: `apply_palette_vector()`, `apply_palette_swap()` accept palette JSON without verifying RGB values are in [0-255] range. Out-of-range values could cause silent numerical issues.
- Files: `web_app.py` (lines 428-450)
- Current mitigation: `np.clip(result, 0, 255)` before final output catches overflow, but intermediate calculations could be incorrect
- Recommendations: Validate palette on POST: `all(0 <= c <= 255 for color in palette for c in color)`
- Priority: Low — non-critical, caught by final clip

---

## Performance Bottlenecks

**FFT-Based Grid Detection is Expensive:**
- Problem: `estimate_grid_fft()` computes 2D FFT on full image grayscale. For large images (e.g., 2000×2000), FFT is O(N log N) and dominates total runtime.
- Files: `src/perfect_pixel/perfect_pixel.py` (lines 251-276), `src/perfect_pixel/perfect_pixel_noCV2.py` (lines 308-331)
- Cause: No downsampling before FFT; full-resolution analysis done for every image
- Improvement path:
  - Add optional downsampling for FFT (e.g., shrink to 512×512 if larger)
  - Cache FFT results if same image processed multiple times (requires frontend state)
  - Profile: measure FFT time vs. total processing time
- Priority: Medium — impacts UI responsiveness for high-res uploads

**Sample Majority Uses cv2.kmeans in OpenCV Backend:**
- Problem: `sample_majority()` calls `cv2.kmeans()` for every single pixel cell (nested loops over nx × ny). For large grids, this is O(grid_w × grid_h × kmeans_iterations).
- Files: `src/perfect_pixel/perfect_pixel.py` (lines 159-160)
- Cause: Per-cell clustering instead of vectorized approach
- Improvement path: Vectorize clustering; use single batch kmeans call instead of per-cell loop; profile if actual bottleneck
- Priority: Low — majority method is optional; users typically choose center or median sampling

**Web UI Frontend Has No Image Compression:**
- Problem: Base64-encoded full-resolution images transmitted over JSON. A 2000×2000 PNG becomes ~6 MB base64 string. No progressive encoding or streaming.
- Files: `web_ui.html` (image upload/display), `web_app.py` (encode_png_b64, all routes returning images)
- Cause: Simple base64 transmission; no compression or chunking
- Improvement path: Add client-side canvas resampling for preview; use binary blob transfer with FormData instead of base64 JSON for large images
- Priority: Medium — impacts UX on slow networks; ver 1.1 known limitation

---

## Fragile Areas

**Grid Detection Algorithm Sensitive to Input Quality:**
- Files: `src/perfect_pixel/perfect_pixel.py` (lines 278-355), `src/perfect_pixel/perfect_pixel_noCV2.py` (lines 333-409)
- Why fragile: Fallback chain (FFT → gradient-based) depends on magic thresholds; if both fail silently, user sees "Grid detection failed" with no actionable feedback
- Safe modification: If changing detection thresholds, test against image set with: noise, compression artifacts, blurry grids, non-square grids (3:2 aspect ratio)
- Test coverage: No unit tests found for grid detection; algorithm tested manually only
- Recommendation: Add test images in `images/` with known correct grid sizes; add regression test suite before modifying detection

**Palette Quantization Algorithm Iterative Replacement:**
- Files: `web_app.py` (lines 207-299, `quantize_coverage_boost()`)
- Why fragile: Complex morphological/connected-components logic with 5+ nested conditions; easy to introduce edge case bugs when modifying region size thresholds or replacement cost calculation
- Safe modification: Isolate `quantize_coverage_boost()` logic; add unit tests for edge cases (single-color image, very small regions, palette size = 1)
- Test coverage: No tests; behavior tested manually in UI only

**Backend Assumes RGB Input Format:**
- Files: `web_app.py` (line 366 assumes BGR→RGB conversion works), `src/perfect_pixel/` (lines 216, 323 assume specific color space)
- Why fragile: If grayscale image uploaded without RGB conversion, channel indexing will be wrong
- Safe modification: Add format validation before processing; explicit check for image.shape having 3 channels
- Test coverage: No test for grayscale input

---

## Scaling Limits

**Memory Usage with Large Images:**
- Current capacity: Can handle images up to ~32 MB (MAX_CONTENT_LENGTH), but processing a 4000×4000 RGB image (48 MB uncompressed) will OOM
- Limit: Depends on available system RAM; no streaming/tiling support
- Scaling path:
  - Implement image tiling for grid detection (process 512×512 tiles separately)
  - Add explicit max resolution (e.g., downsample if > 2000×2000)
  - Use memory-mapped arrays for very large FFT
- Priority: Low for ver 1.1 (target is pixel art, typically < 1000×1000); becomes critical if supporting 4K+ art

**Browser LocalStorage Palette Persistence:**
- Current capacity: Typically 5-10 MB per domain in most browsers
- Limit: Each saved palette is ~5 KB JSON (256 colors); can store ~1000 palettes before hitting limit
- Scaling path: Migrate to server-side persistence (ver 1.2 planned); add cleanup UI for old palettes
- Priority: Known limitation in VERSION_1.1.md; acceptable for beta

**Single-Threaded Flask Server:**
- Current capacity: One image processing at a time; typical process time 2-5 seconds per image
- Limit: If 2+ users upload simultaneously, queue backs up; no request queuing visible to users
- Scaling path: Use gunicorn with multiple workers; add job queue (Celery); implement request timeout
- Priority: Low for local development; becomes critical if hosting publicly

---

## Scaling Limits

**Max Upload Size Enforcement:**
- Current limit: 32 MB hardcoded in `web_app.py` (line 17)
- Issue: No per-endpoint override; all routes share same limit
- Improvement: Make configurable via environment variable for easier deployment tuning

---

## Dependencies at Risk

**OpenCV Dependency Optional but Detection Fallback is Degraded:**
- Risk: If cv2 import fails, code falls back to noCV2 backend. NumPy-only backend works but gradient estimation slower. No warning to user about reduced performance.
- Impact: If cv2 binary incompatible on deployment platform, detection silently becomes slower without user knowledge
- Migration plan: Add startup check; log which backend loaded; test both backends in CI
- Files: `src/perfect_pixel/__init__.py` (lines 1-17)

**Pillow Quantize Methods Non-Deterministic:**
- Risk: `Image.Quantize.FASTOCTREE` and `MEDIANCUT` produce different results on same image due to internal randomization. Users expecting reproducibility may get different palettes on re-run.
- Impact: Cannot create reproducible palette generation; user frustration if palette changes unexpectedly
- Migration plan: Add seed parameter to quantization (if Pillow supports); document non-determinism in UI
- Priority: Low — acceptable for aesthetic use case

---

## Missing Critical Features

**No Progress Indication for Long Operations:**
- Problem: Large image processing (FFT on 2000×2000) can take 10+ seconds. UI shows spinner but no ETA or progress percentage.
- Blocks: Users don't know if process is stuck or just slow
- Approach: Add optional progress callback to core algorithm; stream progress events via WebSocket or polling

**No Batch Processing:**
- Problem: Can only process one image at a time. Users wanting to process 100 images must do each manually.
- Blocks: Workflow efficiency for bulk pixel art generation
- Approach: Add batch route that accepts ZIP or folder; implement job queue with result downloads
- Status: Known limitation in VERSION_1.1.md; planned for ver 1.2

**No Undo/Redo:**
- Problem: Once palette applied or image processed, no way to revert without re-uploading
- Blocks: Exploratory workflow; users reluctant to experiment
- Approach: Maintain operation history stack in frontend; replay operations as needed
- Status: Known limitation; planned for ver 1.2

---

## Test Coverage Gaps

**Grid Detection Has No Unit Tests:**
- What's not tested: `detect_peak()`, `estimate_grid_fft()`, `estimate_grid_gradient()` behavior on edge cases (very small grids, non-square, noisy images, compression artifacts)
- Files: `src/perfect_pixel/perfect_pixel.py`, `src/perfect_pixel/perfect_pixel_noCV2.py`
- Risk: Changes to peak detection thresholds could break existing functionality undetected; regressions not caught until user reports
- Priority: High — core algorithm stability depends on this

**Palette Quantization Algorithms No Unit Tests:**
- What's not tested: `quantize_coverage_boost()` edge cases (1-color image, single-pixel regions, palette.shape edge cases), `apply_palette_swap()` with mismatched palette sizes
- Files: `web_app.py` (lines 207-326)
- Risk: Complex algorithm changes could silently produce incorrect results
- Priority: Medium — impacts user-facing palette feature

**Web Routes Have No Integration Tests:**
- What's not tested: `/api/process` with various image formats (PNG, JPEG, GIF, corrupted), `/api/apply-palette` with edge case palettes (empty, single color, invalid JSON)
- Files: `web_app.py` (routes at lines 346-537)
- Risk: Backend crashes or returns 5xx errors silently in production; users see "error" with no detail
- Priority: Medium

**Backend-Frontend Contract Not Validated:**
- What's not tested: Frontend correctly parses all JSON response shapes; error messages display properly; base64 image decoding works for all browser/OS combinations
- Files: `web_ui.html` (all API calls)
- Risk: Silent failures; users get blank output or broken UI
- Priority: Low — primarily UX issue, not data correctness

---

*Concerns audit: 2026-03-02*
