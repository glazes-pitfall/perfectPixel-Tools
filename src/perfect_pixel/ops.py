"""ImageOps protocol — pluggable backend interface for perfect_pixel."""

from __future__ import annotations

from typing import Protocol, Tuple

import numpy as np
from numpy import ndarray


class ImageOps(Protocol):
    """Minimal set of image operations needed by the core algorithms."""

    def to_gray(self, image: ndarray) -> ndarray:
        """Convert an RGB (or BGR) image to float32 grayscale."""
        ...

    def sobel(self, gray: ndarray) -> Tuple[ndarray, ndarray]:
        """Return (grad_x, grad_y) as float32 arrays (same shape as *gray*)."""
        ...

    def normalize_1d(self, v: ndarray) -> ndarray:
        """Min-max normalize a 1-D array to [0, 1] float32."""
        ...

    def kmeans_2(self, pixels: ndarray, iters: int) -> ndarray:
        """2-means on *pixels* (N, C) float32.  Return the majority centre (C,)."""
        ...
