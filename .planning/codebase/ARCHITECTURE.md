# Architecture

**Analysis Date:** 2026-03-02

## Pattern Overview

**Overall:** Layered image processing library with optional web API wrapper

**Key Characteristics:**
- Core processing layer (`perfect_pixel.py`) for pixel-perfect grid detection and image refinement
- Optional NumPy-only fallback implementation (`perfect_pixel_noCV2.py`) for systems without OpenCV
- Web service layer (Flask REST API in `web_app.py`) providing HTTP endpoints for processing
- Pluggable sampling strategies for grid-based image downsampling
- Palette quantization and color mapping utilities

## Layers

**Public API Layer:**
- Purpose: Expose the core pixel-perfect detection algorithm
- Location: `src/perfect_pixel/__init__.py`
- Contains: Module exports and version info
- Depends on: Both OpenCV and NumPy implementations
- Used by: All consumers (web app, integrations, direct library usage)

**Core Processing Layer (Primary):**
- Purpose: Implement full pixel-perfect grid detection with OpenCV optimizations
- Location: `src/perfect_pixel/perfect_pixel.py`
- Contains: Grid detection algorithms (FFT and gradient-based), grid refinement, sampling methods (center/median/majority), utility functions for image analysis
- Depends on: NumPy, OpenCV (cv2), Matplotlib for debugging
- Used by: Web application, external integrations

**Core Processing Layer (Fallback):**
- Purpose: Pure NumPy implementation of grid detection without OpenCV dependency
- Location: `src/perfect_pixel/perfect_pixel_noCV2.py`
- Contains: Same algorithm signatures as primary but implemented with NumPy only
- Depends on: NumPy only
- Used by: Public API when OpenCV import fails

**Web Service Layer:**
- Purpose: REST API for processing images and managing palettes via HTTP
- Location: `web_app.py`
- Contains: Flask application with route handlers for image processing, palette generation, parsing, and export
- Depends on: Flask, cv2, NumPy, PIL/Pillow, perfect_pixel module
- Used by: Web browser clients, external applications

**Utility Layers:**

**Color Space & Quantization Utilities:**
- Location: `web_app.py` (lines ~20-300)
- Contains: Palette file parsers (GPL, PAL, ACT, PNG), color space converters (RGB to LAB), quantization algorithms (FASTOCTREE, MEDIANCUT, Coverage-Boost)
- Depends on: NumPy, OpenCV, PIL/Pillow
- Used by: Web API endpoints, color mapping functions

**Palette Application Utilities:**
- Location: `web_app.py` (lines ~153-327)
- Contains: Nearest color mapping, palette application (vector, LAB-perceptual, swap modes)
- Depends on: NumPy
- Used by: API endpoint `/api/apply-palette`

## Data Flow

**Pixel-Perfect Processing Flow:**

1. **Input** → User provides raw image (RGB array or file)
2. **Grid Detection** → Analyze image to find grid structure:
   - Convert to grayscale
   - Try FFT-based grid estimation (frequency analysis)
   - Fallback to gradient-based detection (edge-based peak detection)
   - Validate grid dimensions (aspect ratio, pixel size constraints)
3. **Grid Refinement** → Fine-tune grid lines using gradient magnitude:
   - Calculate gradient maps (Sobel operators)
   - Search for local maxima near predicted lines
   - Build refined coordinate arrays (x_coords, y_coords)
4. **Sampling** → Downsample image to grid using selected method:
   - **center:** Sample center pixel of each cell
   - **median:** Compute median color of each cell
   - **majority:** K-means clustering (k=2) to find dominant color
5. **Post-processing** → Optional square aspect ratio correction
6. **Output** → Refined low-res image with detected grid dimensions

**Web API Flow:**

1. **POST /api/process** → Upload image + parameters
2. **Grid Detection Module** → Call `get_perfect_pixel()`
3. **Image Encoding** → Encode results to base64 PNG
4. **Response** → JSON with grid dimensions and scaled output

**Palette Generation Flow:**

1. **POST /api/generate-palette** → Upload image + algorithm selection
2. **Quantization** → Apply selected algorithm:
   - **fastoctree:** Pillow's FASTOCTREE quantizer
   - **mediancut:** Pillow's MEDIANCUT quantizer
   - **boost:** Coverage-Boost (iterative palette optimization)
3. **Deduplication** → Remove near-duplicate colors (LAB distance < 5)
4. **Response** → JSON with palette array

**Palette Application Flow:**

1. **POST /api/apply-palette** → Upload image + palette + mode
2. **Color Mapping** → Select mapping strategy:
   - **vector:** Euclidean distance in RGB
   - **perceptual:** Euclidean distance in LAB color space
   - **swap:** 2-stage mapping (quantize → remap to custom palette)
3. **Encoding & Export** → Encode to base64, optionally scale
4. **Response** → JSON with output image

**Palette File Handling:**

1. **POST /api/parse-palette** → Upload palette file (.act, .gpl, .pal, .png)
2. **File Type Detection** → Check extension
3. **Parse** → Convert to RGB list based on format
4. **Response** → JSON with [R, G, B] color array

## State Management

**Stateless Architecture:**
- Web application maintains no server-side state
- All image processing is request-scoped
- Palette data passed as form parameters (JSON strings)
- No session management or database

**Grid Detection State:**
- Grid parameters detected per-image (not cached)
- FFT/gradient analysis results discarded after use
- Refinement state (x_coords, y_coords) only stored during processing

## Key Abstractions

**Grid Detection Algorithm:**
- Purpose: Automatically identify pixel-art grid structure
- Examples: `detect_grid_scale()`, `estimate_grid_fft()`, `estimate_grid_gradient()`
- Pattern: Dual-method with fallback (FFT → Gradient) for robustness

**Sampling Methods:**
- Purpose: Convert continuous grid to discrete pixel values
- Examples: `sample_center()`, `sample_median()`, `sample_majority()`
- Pattern: Pluggable strategy (parameter to `get_perfect_pixel()`)

**Quantization Algorithms:**
- Purpose: Reduce image colors while preserving visual quality
- Examples: FASTOCTREE, MEDIANCUT, Coverage-Boost
- Pattern: Pluggable via algorithm parameter to `/api/generate-palette`

**Color Space Converters:**
- Purpose: Convert between RGB and perceptual spaces
- Examples: `rgb_to_lab()` in `web_app.py`
- Pattern: Batch-optimized NumPy operations

**Palette File Format Support:**
- Purpose: Parse and export palette data in multiple formats
- Examples: `parse_gpl()`, `parse_pal()`, `parse_act()`, `parse_png_palette()`
- Pattern: Format-specific parsers with common output (RGB list)

## Entry Points

**Library Entry Point:**
- Location: `src/perfect_pixel/__init__.py`
- Triggers: `from perfect_pixel import get_perfect_pixel` or `import perfect_pixel`
- Responsibilities: Conditional export of OpenCV or NumPy implementation

**Main Processing Function:**
- Location: `src/perfect_pixel/perfect_pixel.py:get_perfect_pixel()`
- Triggers: Direct call or via web API
- Responsibilities: Orchestrate grid detection → refinement → sampling pipeline

**Script/Example Entry:**
- Location: `example.py`
- Triggers: Manual execution (`python example.py`)
- Responsibilities: Demonstrate library usage with image I/O

**Web Application Entry:**
- Location: `web_app.py` (bottom of file)
- Triggers: `python web_app.py` or via gunicorn/WSGI
- Responsibilities: Initialize Flask app and start HTTP server on port 5010

## Error Handling

**Strategy:** Graceful degradation with informative logging

**Patterns:**

**Grid Detection Failures:**
- FFT-based detection returns (None, None) → fallback to gradient-based
- Gradient detection fails → return None values to caller
- Caller must check for None and handle (return original image or error message)
- Example: `web_app.py:369-377` checks `grid_w is None` and returns 422 error

**Image Codec Failures:**
- Invalid image files caught in cv2.imdecode() → returns None
- Catch-all exception handling in Flask routes
- Return JSON error responses with HTTP status codes

**Input Validation:**
- Form parameters coerced to expected types with defaults (`int()`, `float()`, `str.lower()`)
- Max file size limited at application level: 32 MB
- Palette deduplication skips if result is empty

**Color Space Edge Cases:**
- Division by zero protection in LAB conversion (1e-8 epsilon)
- Clipping to valid ranges after float operations (0-255 for uint8, etc.)

## Cross-Cutting Concerns

**Logging:**
- Strategy: Print to console for development/debugging
- Uses: Python `print()` statements
- Examples: Grid size estimates printed in `estimate_grid_gradient()`, grid refinement results in `get_perfect_pixel()`
- No persistent logging framework

**Validation:**
- Input validation: Type coercion, range checks (n_colors bounded 2-512)
- Grid validation: Aspect ratio checks, pixel size constraints in `detect_grid_scale()`
- Image validation: OpenCV decode checks, shape validation

**Authentication:**
- None implemented (web app is public/open)
- No access control or authorization
- Suitable for localhost or trusted network use only

**Image Encoding:**
- PNG used as standard transport format (via base64)
- BGR↔RGB conversions required for OpenCV/Pillow compatibility
- Base64 encoding for JSON transport

---

*Architecture analysis: 2026-03-02*
