# PerfectPixel Tools Refactoring — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate code rot, redundancy, and excessive complexity across the entire codebase while preserving all external APIs and behavior.

**Architecture:** Strategy pattern for Python backends (shared core + pluggable image ops), multi-file JS modules for editor, extracted utilities for Flask server. Zero build tools — browser-native `<script src>` loading.

**Tech Stack:** Python 3.8+ (numpy, opencv-python optional), vanilla JS, Flask, HTML/CSS

---

## Task 1: Create ImageOps Protocol and Backend Adapters

**Files:**
- Create: `src/perfect_pixel/ops.py`
- Create: `src/perfect_pixel/backend_cv2.py`
- Create: `src/perfect_pixel/backend_numpy.py`

**Step 1: Create ops.py with the ImageOps protocol**

```python
# src/perfect_pixel/ops.py
"""Image operations protocol — backend-agnostic interface."""

from __future__ import annotations
import numpy as np
from typing import Protocol, Tuple


class ImageOps(Protocol):
    """Backend-agnostic image operations required by the grid detection pipeline."""

    def to_gray(self, image: np.ndarray) -> np.ndarray:
        """Convert RGB/BGR image to float32 grayscale."""
        ...

    def sobel(self, gray: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Return (grad_x, grad_y) as float32 arrays."""
        ...

    def normalize_1d(self, v: np.ndarray) -> np.ndarray:
        """Normalize 1D array to [0, 1] range."""
        ...

    def kmeans_2(self, pixels: np.ndarray, iters: int = 6) -> np.ndarray:
        """K-means with K=2, return the majority cluster center (float32, shape (C,))."""
        ...
```

**Step 2: Create backend_cv2.py**

```python
# src/perfect_pixel/backend_cv2.py
"""OpenCV-backed image operations."""

import cv2
import numpy as np
from .ops import ImageOps


class CV2Ops:
    """ImageOps implementation using OpenCV."""

    def to_gray(self, image: np.ndarray) -> np.ndarray:
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY).astype(np.float32)

    def sobel(self, gray: np.ndarray) -> tuple:
        gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
        return gx, gy

    def normalize_1d(self, v: np.ndarray) -> np.ndarray:
        return cv2.normalize(v, None, 0, 1, cv2.NORM_MINMAX).flatten()

    def kmeans_2(self, pixels: np.ndarray, iters: int = 6) -> np.ndarray:
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, iters, 1.0)
        _, labels, centers = cv2.kmeans(
            pixels, 2, None, criteria, 1, cv2.KMEANS_RANDOM_CENTERS
        )
        count1 = np.sum(labels)
        count0 = len(labels) - count1
        return centers[1] if count1 >= count0 else centers[0]
```

**Step 3: Create backend_numpy.py**

```python
# src/perfect_pixel/backend_numpy.py
"""NumPy-only image operations (no OpenCV dependency)."""

import numpy as np


def _rgb_to_gray(image_rgb: np.ndarray) -> np.ndarray:
    img = image_rgb.astype(np.float32)
    if img.ndim == 2:
        return img
    return (0.299 * img[..., 0] + 0.587 * img[..., 1] + 0.114 * img[..., 2]).astype(np.float32)


def _conv2d_same(image: np.ndarray, kernel: np.ndarray) -> np.ndarray:
    img = image.astype(np.float32, copy=False)
    k = kernel.astype(np.float32, copy=False)
    kh, kw = k.shape
    ph, pw = kh // 2, kw // 2
    pad = np.pad(img, ((ph, ph), (pw, pw)), mode="reflect")
    out = np.zeros_like(img, dtype=np.float32)
    for dy in range(kh):
        for dx in range(kw):
            w = k[dy, dx]
            if w == 0:
                continue
            out += w * pad[dy:dy + img.shape[0], dx:dx + img.shape[1]]
    return out


def _normalize_minmax(x: np.ndarray, a=0.0, b=1.0) -> np.ndarray:
    x = x.astype(np.float32, copy=False)
    mn, mx = float(x.min()), float(x.max())
    if mx - mn < 1e-8:
        return np.zeros_like(x, dtype=np.float32) + a
    y = (x - mn) / (mx - mn)
    return (a + (b - a) * y).astype(np.float32)


class NumpyOps:
    """ImageOps implementation using only NumPy."""

    def to_gray(self, image: np.ndarray) -> np.ndarray:
        return _rgb_to_gray(image)

    def sobel(self, gray: np.ndarray) -> tuple:
        kx = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.float32)
        ky = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=np.float32)
        return _conv2d_same(gray, kx), _conv2d_same(gray, ky)

    def normalize_1d(self, v: np.ndarray) -> np.ndarray:
        return _normalize_minmax(v, 0.0, 1.0).flatten()

    def kmeans_2(self, pixels: np.ndarray, iters: int = 6) -> np.ndarray:
        c0 = pixels[0]
        c1 = pixels[np.argmax(((pixels - c0) ** 2).sum(1))]
        m1 = None
        for _ in range(iters):
            d0 = ((pixels - c0) ** 2).sum(1)
            d1 = ((pixels - c1) ** 2).sum(1)
            m1 = d1 < d0
            if np.any(~m1): c0 = pixels[~m1].mean(0)
            if np.any(m1):  c1 = pixels[m1].mean(0)
        if m1 is None:
            return c0
        return c1 if m1.sum() >= (~m1).sum() else c0
```

**Step 4: Verify files exist and have no syntax errors**

Run: `cd /Users/cheongzhiyan/Developer/perfectPixel-Tools && python3 -c "from src.perfect_pixel.ops import ImageOps; from src.perfect_pixel.backend_cv2 import CV2Ops; from src.perfect_pixel.backend_numpy import NumpyOps; print('OK')"`

Expected: `OK`

**Step 5: Commit**

```bash
git add src/perfect_pixel/ops.py src/perfect_pixel/backend_cv2.py src/perfect_pixel/backend_numpy.py
git commit -m "refactor: add ImageOps protocol and CV2/NumPy backend adapters"
```

---

## Task 2: Create core.py with Shared Algorithm Logic

**Files:**
- Create: `src/perfect_pixel/core.py`

**Step 1: Create core.py**

Move all shared functions from both `perfect_pixel.py` and `perfect_pixel_noCV2.py` into `core.py`. Functions that differ only in image ops calls accept an `ops` parameter.

The following functions are **identical** in both backends and move directly:
- `compute_fft_magnitude` (pp.py:4-14, noCV2.py:78-83)
- `smooth_1d` (pp.py:16-28, noCV2.py:86-96)
- `detect_peak` (pp.py:30-87, noCV2.py:99-153)
- `find_best_grid` (pp.py:89-108, noCV2.py:156-175)
- `sample_center` (pp.py:110-118, noCV2.py:178-183)
- `sample_median` (pp.py:175-206, noCV2.py:235-266)

The following functions need `ops` parameter injection:
- `sample_majority` — uses `ops.kmeans_2()` instead of cv2.kmeans/manual kmeans
- `refine_grids` — uses `ops.to_gray()` and `ops.sobel()`
- `estimate_grid_fft` — uses `ops.normalize_1d()`
- `estimate_grid_gradient` — uses `ops.sobel()` (via `ops.to_gray()`)
- `detect_grid_scale` — uses `ops.to_gray()`
- `get_perfect_pixel` — orchestrator, accepts `ops` parameter

Replace all `print()` calls with `logging.getLogger(__name__)`.

Remove `grid_layout()` debug visualization function entirely.

```python
# src/perfect_pixel/core.py
"""Shared pixel grid detection and sampling algorithms.

All image-backend-specific operations are injected via the `ops` parameter
which conforms to the ImageOps protocol defined in ops.py.
"""

import logging
import numpy as np

log = logging.getLogger(__name__)


def compute_fft_magnitude(gray_image):
    f = np.fft.fft2(gray_image.astype(np.float32))
    fshift = np.fft.fftshift(f)
    mag = np.abs(fshift)
    mag = 1 - np.log1p(mag)
    mn, mx = float(mag.min()), float(mag.max())
    if mx - mn < 1e-8:
        return np.zeros_like(mag, dtype=np.float32)
    mag = (mag - mn) / (mx - mn)
    return mag


def smooth_1d(v, k=17):
    k = int(k)
    if k < 3:
        return v
    if k % 2 == 0:
        k += 1
    sigma = k / 6.0
    x = np.arange(k) - k // 2
    ker = np.exp(-(x * x) / (2 * sigma * sigma))
    ker = ker / (ker.sum() + 1e-8)
    return np.convolve(v, ker, mode="same")


def detect_peak(proj, peak_width=6, rel_thr=0.35, min_dist=6):
    center = len(proj) // 2
    mx = float(proj.max())
    if mx < 1e-6:
        return None

    thr = mx * float(rel_thr)
    candidates = []
    for i in range(1, len(proj) - 1):
        is_peak = True
        for j in range(1, peak_width):
            if i - j < 0 or i + j >= len(proj):
                continue
            if proj[i - j + 1] < proj[i - j] or proj[i + j - 1] < proj[i + j]:
                is_peak = False
                break
        if is_peak and proj[i] >= thr:
            left_climb = 0
            for k in range(i, 0, -1):
                if proj[k] > proj[k - 1]:
                    left_climb = abs(proj[i] - proj[k - 1])
                else:
                    break
            right_fall = 0
            for k in range(i, len(proj) - 1):
                if proj[k] > proj[k + 1]:
                    right_fall = abs(proj[i] - proj[k + 1])
                else:
                    break
            candidates.append({
                "index": i,
                "climb": left_climb,
                "fall": right_fall,
                "score": max(left_climb, right_fall),
            })

    if not candidates:
        return None

    left = [c for c in candidates if c["index"] < center - min_dist and c["index"] > center * 0.25]
    right = [c for c in candidates if c["index"] > center + min_dist and c["index"] < center * 1.75]
    left.sort(key=lambda x: x["score"], reverse=True)
    right.sort(key=lambda x: x["score"], reverse=True)

    if not left or not right:
        return None

    peak_left = left[0]["index"]
    peak_right = right[0]["index"]
    return abs(peak_right - peak_left) / 2


def find_best_grid(origin, range_val_min, range_val_max, grad_mag, thr=0):
    best = round(origin)
    peaks = []
    mx = np.max(grad_mag)
    if mx < 1e-6:
        return best
    rel_thr = mx * thr
    for i in range(-round(range_val_min), round(range_val_max) + 1):
        candidate = round(origin + i)
        if candidate <= 0 or candidate >= len(grad_mag) - 1:
            continue
        if (grad_mag[candidate] > grad_mag[candidate - 1]
                and grad_mag[candidate] > grad_mag[candidate + 1]
                and grad_mag[candidate] >= rel_thr):
            peaks.append((grad_mag[candidate], candidate))
    if len(peaks) == 0:
        return best
    peaks.sort(key=lambda x: x[0], reverse=True)
    return peaks[0][1]


def sample_center(image, x_coords, y_coords):
    x = np.asarray(x_coords)
    y = np.asarray(y_coords)
    centers_x = np.clip((x[1:] + x[:-1]) * 0.5, 0, image.shape[1] - 1).astype(np.int32)
    centers_y = np.clip((y[1:] + y[:-1]) * 0.5, 0, image.shape[0] - 1).astype(np.int32)
    return image[centers_y[:, None], centers_x[None, :]]


def sample_median(image, x_coords, y_coords):
    img = image.astype(np.float32) if image.dtype != np.float32 else image
    H, W = img.shape[:2]
    if img.ndim == 2:
        img = img[..., None]
    C = img.shape[2]

    x = np.asarray(x_coords, dtype=np.int32)
    y = np.asarray(y_coords, dtype=np.int32)

    nx, ny = len(x) - 1, len(y) - 1
    out = np.empty((ny, nx, C), dtype=np.float32)

    for j in range(ny):
        y0, y1 = int(y[j]), int(y[j + 1])
        y0 = np.clip(y0, 0, H); y1 = np.clip(y1, 0, H)
        if y1 <= y0: y1 = min(y0 + 1, H)
        for i in range(nx):
            x0, x1 = int(x[i]), int(x[i + 1])
            x0 = np.clip(x0, 0, W); x1 = np.clip(x1, 0, W)
            if x1 <= x0: x1 = min(x0 + 1, W)
            cell = img[y0:y1, x0:x1].reshape(-1, C)
            if cell.shape[0] == 0:
                out[j, i] = 0
            else:
                out[j, i] = np.median(cell, axis=0)

    if image.dtype == np.uint8:
        return np.clip(np.rint(out), 0, 255).astype(np.uint8)
    return out


def sample_majority(image, x_coords, y_coords, ops, max_samples=128, iters=6, seed=42):
    rng = np.random.default_rng(seed)
    img = image.astype(np.float32) if image.dtype != np.float32 else image
    H, W = img.shape[:2]
    if img.ndim == 2:
        img = img[..., None]
    C = img.shape[2]

    x = np.asarray(x_coords, dtype=np.int32)
    y = np.asarray(y_coords, dtype=np.int32)

    nx, ny = len(x) - 1, len(y) - 1
    out = np.empty((ny, nx, C), dtype=np.float32)

    for j in range(ny):
        y0, y1 = int(y[j]), int(y[j + 1])
        y0 = np.clip(y0, 0, H); y1 = np.clip(y1, 0, H)
        if y1 <= y0: y1 = min(y0 + 1, H)
        for i in range(nx):
            x0, x1 = int(x[i]), int(x[i + 1])
            x0 = np.clip(x0, 0, W); x1 = np.clip(x1, 0, W)
            if x1 <= x0: x1 = min(x0 + 1, W)
            cell = img[y0:y1, x0:x1].reshape(-1, C)
            n = cell.shape[0]
            if n == 0:
                out[j, i] = 0
                continue
            if n > max_samples:
                cell = cell[rng.integers(0, n, size=max_samples)]
            if cell.shape[0] < 2:
                out[j, i] = cell[0]
            else:
                out[j, i] = ops.kmeans_2(cell, iters=iters)

    if image.dtype == np.uint8:
        return np.clip(np.rint(out), 0, 255).astype(np.uint8)
    return out


def refine_grids(image, grid_x, grid_y, ops, refine_intensity=0.25):
    H, W = image.shape[:2]
    cell_w = W / grid_x
    cell_h = H / grid_y

    gray = ops.to_gray(image)
    gx, gy = ops.sobel(gray)

    grad_x_sum = np.sum(np.abs(gx), axis=0).reshape(-1)
    grad_y_sum = np.sum(np.abs(gy), axis=1).reshape(-1)

    x_coords = []
    y_coords = []

    x = find_best_grid(W / 2, cell_w, cell_w, grad_x_sum)
    while x < W + cell_w / 2:
        x = find_best_grid(x, cell_w * refine_intensity, cell_w * refine_intensity, grad_x_sum)
        x_coords.append(x)
        x += cell_w
    x = find_best_grid(W / 2, cell_w, cell_w, grad_x_sum) - cell_w
    while x > -cell_w / 2:
        x = find_best_grid(x, cell_w * refine_intensity, cell_w * refine_intensity, grad_x_sum)
        x_coords.append(x)
        x -= cell_w

    y = find_best_grid(H / 2, cell_h, cell_h, grad_y_sum)
    while y < H + cell_h / 2:
        y = find_best_grid(y, cell_h * refine_intensity, cell_h * refine_intensity, grad_y_sum)
        y_coords.append(y)
        y += cell_h
    y = find_best_grid(H / 2, cell_h, cell_h, grad_y_sum) - cell_h
    while y > -cell_h / 2:
        y = find_best_grid(y, cell_h * refine_intensity, cell_h * refine_intensity, grad_y_sum)
        y_coords.append(y)
        y -= cell_h

    return sorted(x_coords), sorted(y_coords)


def estimate_grid_fft(gray, ops, peak_width=6):
    H, W = gray.shape
    mag = compute_fft_magnitude(gray)

    band_row = W // 2
    band_col = H // 2
    row_sum = np.sum(mag[:, W // 2 - band_row: W // 2 + band_row], axis=1)
    col_sum = np.sum(mag[H // 2 - band_col: H // 2 + band_col, :], axis=0)

    row_sum = ops.normalize_1d(row_sum)
    col_sum = ops.normalize_1d(col_sum)

    row_sum = smooth_1d(row_sum, k=17)
    col_sum = smooth_1d(col_sum, k=17)

    scale_row = detect_peak(row_sum, peak_width)
    scale_col = detect_peak(col_sum, peak_width)

    if scale_row is None or scale_col is None or scale_col <= 0:
        return None, None

    return int(round(scale_col)), int(round(scale_row))


def estimate_grid_gradient(gray, ops, rel_thr=0.2):
    H, W = gray.shape
    gx, gy = ops.sobel(gray)

    grad_x_sum = np.sum(np.abs(gx), axis=0).reshape(-1)
    grad_y_sum = np.sum(np.abs(gy), axis=1).reshape(-1)

    peak_x = []
    peak_y = []
    thr_x = float(rel_thr) * float(grad_x_sum.max())
    thr_y = float(rel_thr) * float(grad_y_sum.max())

    min_interval = 4
    for i in range(1, len(grad_x_sum) - 1):
        if (grad_x_sum[i] > grad_x_sum[i - 1]
                and grad_x_sum[i] > grad_x_sum[i + 1]
                and grad_x_sum[i] >= thr_x):
            if len(peak_x) == 0 or i - peak_x[-1] >= min_interval:
                peak_x.append(i)

    for i in range(1, len(grad_y_sum) - 1):
        if (grad_y_sum[i] > grad_y_sum[i - 1]
                and grad_y_sum[i] > grad_y_sum[i + 1]
                and grad_y_sum[i] >= thr_y):
            if len(peak_y) == 0 or i - peak_y[-1] >= min_interval:
                peak_y.append(i)

    if len(peak_x) < 4 or len(peak_y) < 4:
        return None, None

    intervals_x = [peak_x[i] - peak_x[i - 1] for i in range(1, len(peak_x))]
    intervals_y = [peak_y[i] - peak_y[i - 1] for i in range(1, len(peak_y))]

    scale_x = W / np.median(intervals_x)
    scale_y = H / np.median(intervals_y)

    log.debug("Detected grid size from gradient: (%.2f, %.2f)", scale_x, scale_y)
    return int(round(scale_x)), int(round(scale_y))


def detect_grid_scale(image, ops, peak_width=6, max_ratio=1.5, min_size=4.0):
    gray = ops.to_gray(image)
    H, W = gray.shape

    grid_w, grid_h = estimate_grid_fft(gray, ops, peak_width=peak_width)
    if grid_w is None or grid_h is None:
        log.info("FFT-based grid estimation failed, fallback to gradient-based method.")
        grid_w, grid_h = estimate_grid_gradient(gray, ops)
    else:
        pixel_size_x = W / grid_w
        pixel_size_y = H / grid_h
        max_pixel_size = 20.0
        if (min(pixel_size_x, pixel_size_y) < min_size
                or max(pixel_size_x, pixel_size_y) > max_pixel_size
                or pixel_size_x / pixel_size_y > max_ratio
                or pixel_size_y / pixel_size_x > max_ratio):
            log.info("Inconsistent grid size detected (FFT-based), fallback to gradient-based method.")
            grid_w, grid_h = estimate_grid_gradient(gray, ops)

    if grid_w is None or grid_h is None:
        log.warning("Gradient-based grid estimation failed.")
        return None, None

    pixel_size_x = W / grid_w
    pixel_size_y = H / grid_h

    if pixel_size_x / pixel_size_y > max_ratio or pixel_size_y / pixel_size_x > max_ratio:
        pixel_size = min(pixel_size_x, pixel_size_y)
    else:
        pixel_size = (pixel_size_x + pixel_size_y) / 2.0

    log.debug("Detected pixel size: %.2f", pixel_size)
    grid_w = int(round(W / pixel_size))
    grid_h = int(round(H / pixel_size))
    return grid_w, grid_h


def get_perfect_pixel(image, ops, sample_method="center", grid_size=None,
                      min_size=4.0, peak_width=6, refine_intensity=0.25,
                      fix_square=True):
    """
    Main entry point for grid detection and pixel art refinement.

    Args:
        image: RGB ndarray (H, W, 3)
        ops: ImageOps backend instance
        sample_method: "majority", "center", or "median"
        grid_size: Manual grid size (grid_w, grid_h) to override auto-detection
        min_size: Minimum pixel size to consider valid
        peak_width: Minimum peak width for peak detection
        refine_intensity: Grid line refinement intensity [0, 0.5]
        fix_square: Enforce square output when image is almost square

    Returns:
        (refined_w, refined_h, scaled_image) or (None, None, image) on failure
    """
    if grid_size is not None:
        scale_col, scale_row = grid_size
    else:
        scale_col, scale_row = detect_grid_scale(image, ops, peak_width=peak_width,
                                                  max_ratio=1.5, min_size=min_size)
        if scale_col is None or scale_row is None:
            log.warning("Failed to estimate grid size.")
            return None, None, image

    size_x = int(round(scale_col))
    size_y = int(round(scale_row))
    x_coords, y_coords = refine_grids(image, size_x, size_y, ops, refine_intensity)

    refined_size_x = len(x_coords) - 1
    refined_size_y = len(y_coords) - 1

    if sample_method == "majority":
        scaled_image = sample_majority(image, x_coords, y_coords, ops)
    elif sample_method == "median":
        scaled_image = sample_median(image, x_coords, y_coords)
    else:
        scaled_image = sample_center(image, x_coords, y_coords)

    if fix_square and abs(refined_size_x - refined_size_y) == 1:
        if refined_size_x > refined_size_y:
            if refined_size_x % 2 == 1:
                scaled_image = scaled_image[:, :-1]
            else:
                scaled_image = np.concatenate([scaled_image[:1, :], scaled_image], axis=0)
        else:
            if refined_size_y % 2 == 1:
                scaled_image = scaled_image[:-1, :]
            else:
                scaled_image = np.concatenate([scaled_image[:, :1], scaled_image], axis=1)

    refined_size_y, refined_size_x = scaled_image.shape[:2]
    log.info("Refined grid size: (%d, %d)", refined_size_x, refined_size_y)
    return refined_size_x, refined_size_y, scaled_image
```

**Step 2: Verify syntax**

Run: `python3 -c "import ast; ast.parse(open('src/perfect_pixel/core.py').read()); print('OK')"`

Expected: `OK`

**Step 3: Commit**

```bash
git add src/perfect_pixel/core.py
git commit -m "refactor: create core.py with shared algorithms and logging"
```

---

## Task 3: Rewire Legacy Files as Thin Wrappers

**Files:**
- Modify: `src/perfect_pixel/perfect_pixel.py` (replace entirely)
- Modify: `src/perfect_pixel/perfect_pixel_noCV2.py` (replace entirely)
- Modify: `src/perfect_pixel/__init__.py` (update imports)

**Step 1: Replace perfect_pixel.py with thin wrapper**

```python
# src/perfect_pixel/perfect_pixel.py
"""Backward-compatible wrapper — OpenCV backend.

Usage unchanged:
    from perfect_pixel import get_perfect_pixel
    w, h, out = get_perfect_pixel(rgb_image)
"""

from .core import get_perfect_pixel as _core_get
from .backend_cv2 import CV2Ops

_ops = CV2Ops()


def get_perfect_pixel(image, sample_method="center", grid_size=None,
                      min_size=4.0, peak_width=6, refine_intensity=0.25,
                      fix_square=True, debug=False):
    return _core_get(
        image, ops=_ops, sample_method=sample_method,
        grid_size=grid_size, min_size=min_size, peak_width=peak_width,
        refine_intensity=refine_intensity, fix_square=fix_square,
    )
```

**Step 2: Replace perfect_pixel_noCV2.py with thin wrapper**

```python
# src/perfect_pixel/perfect_pixel_noCV2.py
"""Backward-compatible wrapper — NumPy-only backend.

Usage unchanged:
    from perfect_pixel_noCV2 import get_perfect_pixel
    w, h, out = get_perfect_pixel(rgb_image)
"""

from .core import get_perfect_pixel as _core_get
from .backend_numpy import NumpyOps

_ops = NumpyOps()


def get_perfect_pixel(image, sample_method="center", grid_size=None,
                      min_size=4.0, peak_width=6, refine_intensity=0.25,
                      fix_square=True, debug=False):
    return _core_get(
        image, ops=_ops, sample_method=sample_method,
        grid_size=grid_size, min_size=min_size, peak_width=peak_width,
        refine_intensity=refine_intensity, fix_square=fix_square,
    )
```

**Step 3: Update __init__.py**

```python
# src/perfect_pixel/__init__.py
"""Perfect Pixel: A library for auto grid detection and pixel art refinement."""

__version__ = "0.2.0"

from .perfect_pixel_noCV2 import get_perfect_pixel as _get_numpy

try:
    import cv2  # noqa: F401
    from .perfect_pixel import get_perfect_pixel as _get_opencv
    get_perfect_pixel = _get_opencv
except ImportError:
    _get_opencv = None
    get_perfect_pixel = _get_numpy

__all__ = ["get_perfect_pixel"]
```

**Step 4: Verify backward compatibility**

Run: `cd /Users/cheongzhiyan/Developer/perfectPixel-Tools && python3 -c "
import sys; sys.path.insert(0, 'src')
from perfect_pixel import get_perfect_pixel
import numpy as np
# Create a simple test image
img = np.random.randint(0, 255, (64, 64, 3), dtype=np.uint8)
result = get_perfect_pixel(img)
print(f'Result type: {type(result)}, length: {len(result)}')
print('Backward compatibility OK')
"`

Expected: Output showing result is a tuple of length 3, "Backward compatibility OK"

**Step 5: Commit**

```bash
git add src/perfect_pixel/perfect_pixel.py src/perfect_pixel/perfect_pixel_noCV2.py src/perfect_pixel/__init__.py
git commit -m "refactor: rewire legacy files as thin wrappers over core.py"
```

---

## Task 4: Extract Shared CSS and Color Utilities for Frontend

**Files:**
- Create: `editor/shared.css`
- Create: `editor/js/color-utils.js`

**Step 1: Create shared.css**

Extract CSS variables and button styles that are duplicated between `web_ui.html` (lines 10-23, 95-106) and `editor.html` (lines 9-22, 39-46) into a shared file.

```css
/* editor/shared.css — Shared design tokens and button styles */

:root {
  --bg: #0f0f13;
  --surface: #1a1a22;
  --surface2: #22222e;
  --border: #2e2e3e;
  --accent: #7c6af7;
  --accent-hover: #9080ff;
  --text: #e8e6f0;
  --text-muted: #7a7890;
  --success: #4ade80;
  --error: #f87171;
  --warning: #fbbf24;
  --radius: 10px;
}

.btn {
  padding: 8px 12px; border-radius: 7px; border: none; font-size: 13px;
  font-weight: 600; cursor: pointer; transition: background .2s, opacity .2s; white-space: nowrap;
}
.btn:disabled { opacity: .4; cursor: not-allowed; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.btn-secondary { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }
.btn-secondary:hover:not(:disabled) { border-color: var(--accent); }
.btn-ghost { background: transparent; color: var(--text-muted); border: 1px solid var(--border); padding: 5px 9px; font-size: 12px; }
.btn-ghost:hover { color: var(--text); border-color: var(--accent); }
```

**Step 2: Create color-utils.js**

Extract duplicated color conversion functions from `web_ui.html` (lines 278-286) and `editor.html` (lines 1031-1062).

```javascript
/* editor/js/color-utils.js — Shared color conversion utilities */
/* Used by both editor.html and web_ui.html */

function rgbToHex(r, g, b) {
  return [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}
```

**Step 3: Create editor/ directory and verify files**

Run: `mkdir -p editor/js && ls editor/ editor/js/`

**Step 4: Commit**

```bash
git add editor/shared.css editor/js/color-utils.js
git commit -m "refactor: extract shared CSS tokens and color utility functions"
```

---

## Task 5: Extract Editor JS Modules from editor.html

**Files:**
- Create: `editor/js/state.js` — EditorState object
- Create: `editor/js/history.js` — Undo/redo system
- Create: `editor/js/selection.js` — Selection management, marching ants
- Create: `editor/js/palette.js` — Palette panel state and rendering
- Create: `editor/js/canvas-render.js` — Canvas initialization, pixel rendering, zoom/pan
- Create: `editor/js/tools.js` — All tool implementations (pencil, eraser, bucket, wand, marquee, move, eyedropper)
- Create: `editor/js/rotsprite.js` — RotSprite rotation algorithm
- Create: `editor/js/canvas-size.js` — Canvas Size tool
- Create: `editor/js/main.js` — Initialization, event binding, tool dispatch
- Create: `editor/editor.css` — Editor-specific styles (non-shared)
- Modify: `editor.html` → replace with skeleton HTML + `<script src>` tags

This is the largest task. The general approach:

1. Read the full editor.html to identify natural module boundaries
2. Extract each logical section into its own JS file
3. Mount modules to `window.PP` namespace for cross-module access
4. Replace inline `<style>` with `<link>` to editor.css and shared.css
5. Replace inline `<script>` with ordered `<script src>` tags
6. Keep HTML structure unchanged

**Step 1: Extract state.js (from editor.html lines ~1225-1261)**

Contains: `EditorState` object with pub/sub, palette state variables, `setActiveTool()`, canvas refs, eyedropper state.

**Step 2: Extract history.js (from editor.html lines ~1532-1600)**

Contains: `pushHistory()`, `undo()`, `redo()`, `_restoreHistoryEntry()`, `initHistoryButtons()`, `updateHistoryButtons()`

**Step 3: Extract selection.js (from editor.html lines ~1340-1530)**

Contains: `clearSelection()`, `setSelection()`, `isSelectedPixel()`, `computeBoundingBox()`, `unionMasks()`, `invertSelection()`, `deleteSelection()`, `fillSelection()`, `drawAnts()`, `scheduleAnts()`, `updateSelectionUI()`, `snapToGrid()`

**Step 4: Extract palette.js, canvas-render.js, tools.js, rotsprite.js, canvas-size.js**

Each extracts its logical section from the monolithic script.

**Step 5: Extract editor.css**

Move all `<style>` content from editor.html (lines 7-928) to `editor/editor.css`, removing the duplicated CSS variables and button styles (they're now in shared.css).

**Step 6: Rewrite editor.html as skeleton**

The new editor.html contains only:
- `<link>` to shared.css and editor.css
- HTML structure (unchanged from lines ~929-1028)
- `<script src>` tags loading modules in dependency order:

```html
<link rel="stylesheet" href="editor/shared.css">
<link rel="stylesheet" href="editor/editor.css">
<!-- ... HTML body unchanged ... -->
<script src="editor/js/color-utils.js"></script>
<script src="editor/js/state.js"></script>
<script src="editor/js/history.js"></script>
<script src="editor/js/selection.js"></script>
<script src="editor/js/canvas-render.js"></script>
<script src="editor/js/palette.js"></script>
<script src="editor/js/rotsprite.js"></script>
<script src="editor/js/canvas-size.js"></script>
<script src="editor/js/tools.js"></script>
<script src="editor/js/main.js"></script>
```

**Step 7: Verify in browser**

Run: `python3 web_app.py` and open `http://localhost:5010/editor`

All tools should work identically to the monolithic version.

**Step 8: Commit**

```bash
git add editor/ editor.html
git commit -m "refactor: modularize editor.html into separate JS/CSS files"
```

---

## Task 6: Update web_ui.html to Use Shared Assets

**Files:**
- Modify: `web_ui.html`

**Step 1: Replace inline CSS variables and button styles with link to shared.css**

In `web_ui.html`, replace the `:root { ... }` block (lines 10-23) and `.btn` styles (lines 95-106) with:

```html
<link rel="stylesheet" href="editor/shared.css">
```

Keep all other web_ui-specific styles inline.

**Step 2: Replace inline color utility functions with script src**

Replace `rgbToHex` and `hexToRgb` function definitions (lines 278-286) with:

```html
<script src="editor/js/color-utils.js"></script>
```

**Step 3: Remove stale comment**

Delete line 399: `// <!-- palette section removed in Phase 4 Plan 02 -->`

**Step 4: Update Flask routes to serve editor/ directory**

In `web_app.py`, add a route to serve static files from the `editor/` directory:

```python
@app.route("/editor/<path:filename>")
def editor_static(filename):
    return send_file(os.path.join(os.path.dirname(__file__), "editor", filename))
```

And update the editor route to serve the new editor.html location (if moved) or keep serving from root.

**Step 5: Verify web_ui.html still works**

Run: `python3 web_app.py` and open `http://localhost:5010`

**Step 6: Commit**

```bash
git add web_ui.html web_app.py
git commit -m "refactor: web_ui.html uses shared CSS/JS, remove stale comments"
```

---

## Task 7: Clean Up web_app.py

**Files:**
- Modify: `web_app.py`

**Step 1: Extract shared utility functions**

Add helper functions at the top of web_app.py (after imports):

```python
def _decode_b64_image(b64_str):
    """Decode base64 string to RGB numpy array."""
    data = base64.b64decode(b64_str)
    arr = np.frombuffer(data, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("Cannot decode image data")
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def _make_error(msg, code=400):
    """Uniform error response."""
    return jsonify({"error": msg}), code
```

**Step 2: Refactor routes to use shared helpers**

Replace duplicated base64 decode logic in `api_apply_palette()` (line 462) and other routes with calls to `_decode_b64_image()`.

Replace scattered `return jsonify({"error": ...}), NNN` with `_make_error()`.

**Step 3: Standardize HTTP status codes**

- Validation errors (missing params, empty palette) → 400
- Processing failures (grid detection failed) → 422
- Internal errors (quantization failed) → 500

**Step 4: Verify all API routes work**

Run: `python3 web_app.py` and test with browser.

**Step 5: Commit**

```bash
git add web_app.py
git commit -m "refactor: extract shared helpers, standardize error responses in web_app.py"
```

---

## Task 8: Fix ComfyUI Integration

**Files:**
- Modify: `integrations/comfyui/PerfectPixelComfy/nodes_perfect_pixel.py`

**Step 1: Fix bare except clause**

Change line 60 from `except Exception:` to `except ImportError:`.

**Step 2: Verify syntax**

Run: `python3 -c "import ast; ast.parse(open('integrations/comfyui/PerfectPixelComfy/nodes_perfect_pixel.py').read()); print('OK')"`

**Step 3: Commit**

```bash
git add integrations/comfyui/PerfectPixelComfy/nodes_perfect_pixel.py
git commit -m "fix: narrow bare except to ImportError in ComfyUI backend loader"
```

---

## Task 9: Final Verification and Cleanup

**Step 1: Run Python import check**

```bash
cd /Users/cheongzhiyan/Developer/perfectPixel-Tools
python3 -c "
import sys; sys.path.insert(0, 'src')
from perfect_pixel import get_perfect_pixel
from perfect_pixel.core import get_perfect_pixel as core_gpp
from perfect_pixel.backend_cv2 import CV2Ops
from perfect_pixel.backend_numpy import NumpyOps
print('All imports OK')
"
```

**Step 2: Verify web app starts**

```bash
python3 web_app.py &
sleep 2
curl -s http://localhost:5010/ | head -5
curl -s http://localhost:5010/editor | head -5
kill %1
```

**Step 3: Verify file count reduction**

Run: `wc -l editor.html editor/editor.css editor/shared.css editor/js/*.js`

Each JS module should be under 500 lines. editor.html should be ~200 lines (HTML skeleton only).

**Step 4: Final commit**

```bash
git add -A
git commit -m "refactor: complete codebase refactoring — eliminate redundancy and modularize"
```

---

## Summary

| Task | Description | Estimated Steps |
|------|-------------|----------------|
| 1 | ImageOps protocol + backend adapters | 5 |
| 2 | core.py shared algorithms | 3 |
| 3 | Rewire legacy files as wrappers | 5 |
| 4 | Extract shared CSS + color utils | 4 |
| 5 | Modularize editor.html (largest task) | 8 |
| 6 | Update web_ui.html to use shared assets | 6 |
| 7 | Clean up web_app.py | 5 |
| 8 | Fix ComfyUI integration | 3 |
| 9 | Final verification | 4 |
