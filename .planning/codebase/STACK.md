# Technology Stack

**Analysis Date:** 2026-03-02

## Languages

**Primary:**
- Python 3.8+ - Core algorithm library and Flask web server

## Runtime

**Environment:**
- Python 3.8+ (minimum requirement per `pyproject.toml`)
- Currently running on Python 3.13.1 (tested)

**Package Manager:**
- `pip` - Standard Python package manager
- Lockfile: Not detected (uses `pyproject.toml` only)

## Frameworks

**Core:**
- Flask 1.x+ - Web framework for HTTP API server (`web_app.py`, port 5010)
  - Routes for image processing, palette generation, palette parsing/export
  - File upload handling (32 MB max)

**Image Processing:**
- OpenCV (`cv2`) [Optional] - Fast backend for grid detection and image I/O (`src/perfect_pixel/perfect_pixel.py`)
  - FFT-based peak detection
  - Morphological operations (erosion, dilation)
  - Image encoding/decoding
- NumPy (Required) - Core numerical arrays, fallback lightweight backend (`src/perfect_pixel/perfect_pixel_noCV2.py`)
- Pillow (`PIL`) - Image quantization and palette operations
  - Color quantization algorithms: FASTOCTREE, MEDIANCUT
  - Palette extraction and conversion

**ComfyUI Integration:**
- PyTorch (`torch`) - Used only in ComfyUI node wrapper (`integrations/comfyui/PerfectPixelComfy/nodes_perfect_pixel.py`)
  - Torch not a dependency of core library; only for ComfyUI integration

## Key Dependencies

**Core Library (Required):**
- `numpy>=1.20.0` - Numerical operations, matrix math, FFT support
  - Used in both OpenCV and NumPy backends
  - Essential for grid detection algorithm

**Core Library (Optional):**
- `opencv-python` [Optional] - Installable via `pip install perfect-pixel[opencv]`
  - Provides faster grid detection via FFT and morphological operations
  - Fallback: NumPy-only backend available if OpenCV unavailable

**Web Application (web_app.py):**
- Flask - HTTP server and routing
- opencv-python - Image I/O and manipulation (`cv2.imread`, `cv2.cvtColor`, `cv2.resize`)
- numpy - Array operations for color space conversions, palette processing
- pillow - Image quantization (`Image.Quantize.FASTOCTREE`, `Image.Quantize.MEDIANCUT`)

**ComfyUI Integration:**
- perfect-pixel (core library)
- torch - ComfyUI's tensor format conversion
- numpy - Array operations

**Development/Testing:**
- matplotlib - Demo visualization (`example.py`) — not production dependency

## Configuration

**Environment:**
- Flask app config: Hardcoded in `web_app.py`
  - Host: `0.0.0.0`
  - Port: `5010` (fixed, not 5000)
  - Max file upload: `32 * 1024 * 1024` bytes (32 MB)
  - Debug mode: `False` in production
- No `.env` file detected — all configuration hardcoded

**Build:**
- `pyproject.toml` - Package metadata, dependencies, entry points
  - Build backend: `setuptools` >= 61.0
  - Package name: `perfect-pixel`
  - Version: 0.1.4
  - License: MIT

## Backend Selection

The library automatically selects the fastest available backend at import time:

1. **Auto mode** (`src/perfect_pixel/__init__.py`):
   - Attempts to import OpenCV (`cv2`)
   - If available: uses `perfect_pixel.py` (fast backend)
   - If unavailable: falls back to `perfect_pixel_noCV2.py` (NumPy-only)

2. **Manual override** (ComfyUI integration):
   - Node parameter allows explicit backend selection: "Auto", "OpenCV Backend", "Lightweight Backend"

## Platform Requirements

**Development:**
- Python 3.8+
- pip (package manager)
- Optional: OpenCV (faster processing)
- Optional: matplotlib (example scripts only)

**Production (Web):**
- Python 3.8+
- Flask
- OpenCV (recommended) or NumPy-only fallback
- Pillow (for palette operations)

**ComfyUI Integration:**
- ComfyUI installation
- Python 3.8+
- PyTorch (provided by ComfyUI)
- perfect-pixel library

---

*Stack analysis: 2026-03-02*
