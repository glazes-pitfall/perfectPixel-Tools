"""Shared core algorithms for perfect_pixel (backend-agnostic)."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Optional, Tuple

import numpy as np
from numpy import ndarray

if TYPE_CHECKING:
    from .ops import ImageOps

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Pure-NumPy helpers (identical in both legacy backends)
# ---------------------------------------------------------------------------

def compute_fft_magnitude(gray_image: ndarray) -> ndarray:
    f = np.fft.fft2(gray_image.astype(np.float32))
    fshift = np.fft.fftshift(f)
    mag = np.abs(fshift)
    mag = 1 - np.log1p(mag)
    mn, mx = float(mag.min()), float(mag.max())
    if mx - mn < 1e-8:
        return np.zeros_like(mag, dtype=np.float32)
    mag = (mag - mn) / (mx - mn)
    return mag


def smooth_1d(v: ndarray, k: int = 17) -> ndarray:
    """Simple 1-D smoothing with a Gaussian-like kernel."""
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


def detect_peak(proj: ndarray, peak_width: int = 6, rel_thr: float = 0.35, min_dist: int = 6):
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


def find_best_grid(origin, range_val_min, range_val_max, grad_mag, thr: float = 0):
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


# ---------------------------------------------------------------------------
# Sampling helpers
# ---------------------------------------------------------------------------

def sample_center(image: ndarray, x_coords, y_coords) -> ndarray:
    x = np.asarray(x_coords)
    y = np.asarray(y_coords)
    centers_x = np.clip((x[1:] + x[:-1]) * 0.5, 0, image.shape[1] - 1).astype(np.int32)
    centers_y = np.clip((y[1:] + y[:-1]) * 0.5, 0, image.shape[0] - 1).astype(np.int32)
    return image[centers_y[:, None], centers_x[None, :]]


def sample_majority(image: ndarray, x_coords, y_coords, ops: "ImageOps",
                    max_samples: int = 128, iters: int = 6, seed: int = 42) -> ndarray:
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
        if y1 <= y0:
            y1 = min(y0 + 1, H)

        for i in range(nx):
            x0, x1 = int(x[i]), int(x[i + 1])
            x0 = np.clip(x0, 0, W); x1 = np.clip(x1, 0, W)
            if x1 <= x0:
                x1 = min(x0 + 1, W)

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
                out[j, i] = ops.kmeans_2(cell, iters)

    if image.dtype == np.uint8:
        return np.clip(np.rint(out), 0, 255).astype(np.uint8)
    return out


def sample_median(image: ndarray, x_coords, y_coords) -> ndarray:
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
        if y1 <= y0:
            y1 = min(y0 + 1, H)

        for i in range(nx):
            x0, x1 = int(x[i]), int(x[i + 1])
            x0 = np.clip(x0, 0, W); x1 = np.clip(x1, 0, W)
            if x1 <= x0:
                x1 = min(x0 + 1, W)

            cell = img[y0:y1, x0:x1].reshape(-1, C)
            if cell.shape[0] == 0:
                out[j, i] = 0
            else:
                out[j, i] = np.median(cell, axis=0)

    if image.dtype == np.uint8:
        return np.clip(np.rint(out), 0, 255).astype(np.uint8)
    return out


# ---------------------------------------------------------------------------
# Grid estimation / refinement (ops-dependent)
# ---------------------------------------------------------------------------

def refine_grids(image: ndarray, grid_x: int, grid_y: int, ops: "ImageOps",
                 refine_intensity: float = 0.25):
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

    x_coords = sorted(x_coords)
    y_coords = sorted(y_coords)
    return x_coords, y_coords


def estimate_grid_fft(gray: ndarray, ops: "ImageOps", peak_width: int = 6):
    """Return (grid_w, grid_h) or (None, None)."""
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

    grid_w = int(round(scale_col))
    grid_h = int(round(scale_row))
    return grid_w, grid_h


def estimate_grid_gradient(gray: ndarray, ops: "ImageOps", rel_thr: float = 0.2):
    H, W = gray.shape

    grad_x, grad_y = ops.sobel(gray)

    grad_x_sum = np.sum(np.abs(grad_x), axis=0).reshape(-1)
    grad_y_sum = np.sum(np.abs(grad_y), axis=1).reshape(-1)

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


def detect_grid_scale(image: ndarray, ops: "ImageOps", peak_width: int = 6,
                      max_ratio: float = 1.5, min_size: float = 4.0):
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

    log.info("Detected pixel size: %.2f", pixel_size)

    grid_w = int(round(W / pixel_size))
    grid_h = int(round(H / pixel_size))

    return grid_w, grid_h


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def get_perfect_pixel(image: ndarray, ops: "ImageOps",
                      sample_method: str = "center",
                      grid_size=None,
                      min_size: float = 4.0,
                      peak_width: int = 6,
                      refine_intensity: float = 0.25,
                      fix_square: bool = True):
    """
    Args:
        image: RGB/BGR image ndarray (H, W, 3).
        ops: Backend adapter implementing ImageOps protocol.
        sample_method: "majority", "center", or "median".
        grid_size: Manually set grid size (grid_w, grid_h) to override auto-detection.
        min_size: Minimum pixel size to consider valid.
        peak_width: Minimum peak width for peak detection.
        refine_intensity: Intensity for grid line refinement [0, 0.5].
        fix_square: Enforce square output when detected image is almost square.

    Returns:
        (refined_w, refined_h, scaled_image)
    """
    H, W = image.shape[:2]
    if grid_size is not None:
        scale_col, scale_row = grid_size
    else:
        scale_col, scale_row = detect_grid_scale(
            image, ops, peak_width=peak_width, max_ratio=1.5, min_size=min_size
        )
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

    # fix square
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
