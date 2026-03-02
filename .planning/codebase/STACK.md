# Technology Stack

**Analysis Date:** 2026-03-02

## Languages

**Primary:**
- Python 3.8+ - Core library and image processing
- HTML/CSS/JavaScript - Web UI frontend

**Secondary:**
- None

## Runtime

**Environment:**
- Python 3.8+ (specified in `pyproject.toml`)

**Package Manager:**
- pip (setuptools-based)
- Lockfile: Not present (uses dynamic pinning via `pyproject.toml`)

## Frameworks

**Core:**
- Flask 1.0+ - Web framework for `web_app.py` endpoint server
- NumPy 1.20.0+ - Numerical computation and array operations (core dependency)
- OpenCV (opencv-python) - Optional dependency for fast image processing backend in `src/perfect_pixel/perfect_pixel.py`
- Pillow (PIL) - Image quantization and palette handling in `web_app.py`

**Testing:**
- Not detected

**Build/Dev:**
- setuptools 61.0+ - Package building
- wheel - Python package distribution format

## Key Dependencies

**Critical:**
- numpy>=1.20.0 - Required for all grid detection and image processing algorithms
- opencv-python - Optional but recommended for performance in `src/perfect_pixel/perfect_pixel.py`

**Infrastructure:**
- Flask - Web server for running `web_app.py` (serves on port 5010)
- Pillow - Color space conversions and palette quantization in `web_app.py`
- matplotlib - Visualization in `example.py` (development/demo only)
- torch - PyTorch tensor operations in ComfyUI integration (`integrations/comfyui/PerfectPixelComfy/nodes_perfect_pixel.py`)

## Configuration

**Environment:**
- Flask app configuration in `web_app.py`: `app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024` (32 MB max upload)
- Flask runs on host "0.0.0.0", port 5010
- No .env file detected

**Build:**
- `pyproject.toml` - Package metadata and dependencies
- setuptools configured in `pyproject.toml` with:
  - Package directory: `src/`
  - Include pattern: `perfect_pixel*`

## Platform Requirements

**Development:**
- Python 3.8+ installed
- Optional: OpenCV for best performance (falls back to NumPy-only if unavailable)
- Optional: matplotlib for running `example.py`

**Production:**
- Python 3.8+ runtime
- NumPy (required)
- OpenCV or standalone NumPy support (dual-backend system allows flexible deployment)
- Flask for web server (if using web_app.py)
- PyTorch (only if using ComfyUI integration)

## Dual-Backend System

Perfect Pixel implements a fallback mechanism:
- Primary: OpenCV backend (`src/perfect_pixel/perfect_pixel.py`) - faster, requires cv2
- Fallback: NumPy-only backend (`src/perfect_pixel/perfect_pixel_noCV2.py`) - no cv2 dependency
- Selection logic in `src/perfect_pixel/__init__.py` - tries to import cv2, falls back to NumPy version if unavailable

---

*Stack analysis: 2026-03-02*
