"""Pure-NumPy implementation of ImageOps (no OpenCV dependency)."""

from __future__ import annotations

from typing import Tuple

import numpy as np
from numpy import ndarray


# ---------------------------------------------------------------------------
# Internal helpers (ported from perfect_pixel_noCV2.py)
# ---------------------------------------------------------------------------

def _rgb_to_gray(image_rgb: ndarray) -> ndarray:
    """RGB uint8/float -> gray float32."""
    img = image_rgb.astype(np.float32)
    if img.ndim == 2:
        return img
    return (0.299 * img[..., 0] + 0.587 * img[..., 1] + 0.114 * img[..., 2]).astype(np.float32)


def _conv2d_same(image: ndarray, kernel: ndarray) -> ndarray:
    """2-D convolution (same) for grayscale float32."""
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
            out += w * pad[dy : dy + img.shape[0], dx : dx + img.shape[1]]
    return out


def _normalize_minmax(x: ndarray, a: float = 0.0, b: float = 1.0) -> ndarray:
    x = x.astype(np.float32, copy=False)
    mn = float(x.min())
    mx = float(x.max())
    if mx - mn < 1e-8:
        return np.zeros_like(x, dtype=np.float32) + a
    y = (x - mn) / (mx - mn)
    return (a + (b - a) * y).astype(np.float32)


def _sobel_xy(gray: ndarray, ksize: int = 3) -> Tuple[ndarray, ndarray]:
    """Return (gx, gy) float32 using manual Sobel kernels."""
    if ksize == 3:
        kx = np.array([[-1, 0, 1],
                        [-2, 0, 2],
                        [-1, 0, 1]], dtype=np.float32)
        ky = np.array([[-1, -2, -1],
                        [ 0,  0,  0],
                        [ 1,  2,  1]], dtype=np.float32)
    elif ksize == 5:
        kx = np.array([[-5,  -4,  0,  4,  5],
                        [-8, -10,  0, 10,  8],
                        [-10, -20, 0, 20, 10],
                        [-8, -10,  0, 10,  8],
                        [-5,  -4,  0,  4,  5]], dtype=np.float32)
        ky = kx.T
    else:
        raise ValueError("ksize must be 3 or 5")
    return _conv2d_same(gray, kx), _conv2d_same(gray, ky)


# ---------------------------------------------------------------------------
# Public adapter
# ---------------------------------------------------------------------------

class NumpyOps:
    """ImageOps adapter using only NumPy."""

    def to_gray(self, image: ndarray) -> ndarray:
        return _rgb_to_gray(image)

    def sobel(self, gray: ndarray) -> Tuple[ndarray, ndarray]:
        return _sobel_xy(gray, ksize=3)

    def normalize_1d(self, v: ndarray) -> ndarray:
        return _normalize_minmax(v, 0.0, 1.0).flatten()

    def kmeans_2(self, pixels: ndarray, iters: int) -> ndarray:
        """Manual 2-means clustering; return the majority centre."""
        cell = pixels.astype(np.float32, copy=False)
        c0 = cell[0]
        c1 = cell[np.argmax(((cell - c0) ** 2).sum(1))]
        for _ in range(iters):
            d0 = ((cell - c0) ** 2).sum(1)
            d1 = ((cell - c1) ** 2).sum(1)
            m1 = d1 < d0
            if np.any(~m1):
                c0 = cell[~m1].mean(0)
            if np.any(m1):
                c1 = cell[m1].mean(0)
        return c1 if m1.sum() >= (~m1).sum() else c0
