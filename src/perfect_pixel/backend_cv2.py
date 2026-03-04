"""OpenCV-backed implementation of ImageOps."""

from __future__ import annotations

from typing import Tuple

import cv2
import numpy as np
from numpy import ndarray


class CV2Ops:
    """ImageOps adapter using OpenCV."""

    # -- protocol methods --------------------------------------------------

    def to_gray(self, image: ndarray) -> ndarray:
        if image.ndim == 2:
            return image.astype(np.float32)
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY).astype(np.float32)

    def sobel(self, gray: ndarray) -> Tuple[ndarray, ndarray]:
        gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
        return gx, gy

    def normalize_1d(self, v: ndarray) -> ndarray:
        return cv2.normalize(v.astype(np.float32), None, 0, 1, cv2.NORM_MINMAX).flatten()

    def kmeans_2(self, pixels: ndarray, iters: int) -> ndarray:
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, iters, 1.0)
        _, labels, centers = cv2.kmeans(
            pixels.astype(np.float32), 2, None, criteria, 1, cv2.KMEANS_RANDOM_CENTERS
        )
        count1 = int(np.sum(labels))
        count0 = len(labels) - count1
        return centers[1] if count1 >= count0 else centers[0]
