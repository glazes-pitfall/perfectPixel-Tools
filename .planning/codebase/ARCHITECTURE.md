# Architecture

**Analysis Date:** 2026-03-02

## Pattern Overview

**Overall:** Layered architecture with pluggable backends and dual entry points (CLI library + web UI).

**Key Characteristics:**
- Two independent layers: core algorithm library (`src/perfect_pixel/`) and web application layer (`web_app.py` + `web_ui.html`)
- Auto-selecting backend system that prefers OpenCV but degrades gracefully to NumPy-only
- Stateless API with single public function signature
- Palette management as first-class feature alongside grid detection
- Integration points for external systems (ComfyUI node)

## Layers

**Library Layer (Core Algorithm):**
- Purpose: Auto-detect pixel art grids and refine image alignment
- Location: `src/perfect_pixel/`
- Contains: Grid detection, sampling methods, refinement algorithms
- Depends on: NumPy (required), OpenCV (optional), NumPy.fft
- Used by: Web app, ComfyUI integration, example scripts, external consumers (PyPI)

**Web Layer (UI + API):**
- Purpose: Browser-based interface for grid detection and palette manipulation
- Location: `web_app.py`, `web_ui.html`
- Contains: Flask routes, palette parsers/exporters, color space conversions, palette generation algorithms
- Depends on: Flask, OpenCV, NumPy, PIL/Pillow
- Used by: Browser clients

**Integration Layer:**
- Purpose: Adapt library to third-party systems
- Location: `integrations/comfyui/`
- Contains: ComfyUI node wrapper, backend selection, tensor/numpy conversion
- Depends on: PyTorch, library layer

## Data Flow

**Grid Detection → Refinement → Sampling:**

1. User uploads or provides image (RGB uint8 array)
2. Convert to grayscale → FFT-based grid estimation
3. If FFT fails, fallback to gradient-based detection
4. Validate grid dimensions (min size, aspect ratio bounds)
5. Refine grid lines using gradient magnitude peaks (iterative)
6. Sample grid cells using selected method (center/median/majority)
7. Optionally enforce square output
8. Return refined grid dimensions + downsampled image

**Palette Application Flow:**

1. User uploads image + provides or generates palette
2. Quantize image to palette size (FASTOCTREE, MEDIANCUT, or COVERAGE-BOOST algorithms)
3. Map each pixel to nearest palette color (RGB or LAB space)
4. Optional palette-swap mode: quantize image, match quantized palette to user palette
5. Return remapped image with optional scaling

**State Management:**
- No server-side state: all parameters passed per-request
- Browser `localStorage` stores user's saved palettes (client-side only)
- Each request is independent; no session affinity

## Key Abstractions

**Backend Selection (`src/perfect_pixel/__init__.py`):**
- Purpose: Graceful degradation from OpenCV to NumPy-only
- Examples: `_get_perfect_pixel_opencv`, `_get_perfect_pixel_numpy`
- Pattern: Try-except import chain; exposes single `get_perfect_pixel()` function regardless of backend

**Grid Detection (multiple methods):**
- FFT-based: `estimate_grid_fft()` — Uses frequency domain peaks
- Gradient-based: `estimate_grid_gradient()` — Fallback using Sobel edges
- Validation: `detect_grid_scale()` — Checks constraints and selects best method

**Sampling Methods (grid cell consolidation):**
- Center: `sample_center()` — Single center pixel per grid cell
- Median: `sample_median()` — Median of all pixels in cell
- Majority: `sample_majority()` — K-means clustering to find dominant color per cell

**Palette Algorithms:**
- Basic: `quantize_image()` — Pillow's FASTOCTREE
- Coverage-Boost: `quantize_coverage_boost()` — Iterative slot replacement targeting under-represented regions
- Color mapping: `apply_palette_vector()` — Nearest-neighbor in RGB or LAB
- Palette-swap: `apply_palette_swap()` — Two-stage quantize-then-match

**Color Space Conversion:**
- `rgb_to_lab()` — sRGB linearization → XYZ (D65) → CIE LAB
- Used for perceptual distance metrics in palette matching

## Entry Points

**Library Entry (PyPI):**
- Location: `src/perfect_pixel/__init__.py` exports `get_perfect_pixel()`
- Triggers: External code imports and calls the function
- Responsibilities: Auto-select backend, run grid detection, sampling, refinement
- Signature: `get_perfect_pixel(image, sample_method="center", grid_size=None, min_size=4.0, peak_width=6, refine_intensity=0.25, fix_square=True, debug=False)`

**Web Server Entry:**
- Location: `web_app.py`, main block runs Flask on port 5010
- Triggers: `python3 web_app.py`
- Responsibilities: Serve HTML UI, handle image/palette upload/processing requests

**ComfyUI Integration Entry:**
- Location: `integrations/comfyui/PerfectPixelComfy/__init__.py`
- Triggers: ComfyUI node factory loads the module
- Responsibilities: Wrap library, convert ComfyUI tensor format to/from NumPy

**Example Script Entry:**
- Location: `example.py`
- Triggers: `python3 example.py`
- Responsibilities: Demo library usage, display results

## Error Handling

**Strategy:** Graceful degradation + informative HTTP status codes.

**Patterns:**

- Backend failure → Fallback to lightweight backend
  - Try CV2 import; if fails, use NumPy-only backend
  - Transparent to caller: same public API

- Grid detection failure → Return `(None, None, original_image)`
  - Web endpoint: HTTP 422 "Grid detection failed. Try a clearer pixel art image."
  - Library user: Handle None return values

- Palette validation → HTTP 400 for missing/invalid input
  - Empty palette → 400
  - Non-JSON palette → 400 "Invalid palette JSON"

- Image decode failure → HTTP 400 "Cannot decode image"

- Processing errors (quantization, color conversion) → HTTP 500

- Fallback mechanisms:
  - FFT grid detection fails → Try gradient-based
  - Gradient detection fails → Return None and inform user
  - User palette has near-duplicates → Deduplicate automatically (`_deduplicate_palette()`)

## Cross-Cutting Concerns

**Logging:**
- Current: `print()` statements for progress/debug info
- Examples: "Detected grid size...", "Refined grid size...", "FFT-based grid estimation failed..."
- Known issue: No structured logging; only stdout

**Validation:**
- Grid constraints: `min_size=4.0`, `max_pixel_size=20.0`, aspect ratio < 1.5
- Palette size: clamped to 2-512 colors
- Image dimensions: basic null checks after decode

**Authentication:**
- None: Web API is unauthenticated (local-only assumption)
- File upload: No magic-byte validation (known security gap)

**Performance Considerations:**
- FFT: O(N log N) for N=H*W pixel count
- Gradient: O(N) with kernel convolution
- Palette matching: O(N*K) where K=palette size
- LAB conversion: O(N) for N pixels with matrix operations

---

*Architecture analysis: 2026-03-02*
