"""Backward-compatible thin wrapper (pure-NumPy backend)."""

from .core import get_perfect_pixel as _core_get
from .backend_numpy import NumpyOps

_ops = NumpyOps()


def get_perfect_pixel(image, sample_method="center", grid_size=None, min_size=4.0,
                      peak_width=6, refine_intensity=0.25, fix_square=True, debug=False):
    return _core_get(image, ops=_ops, sample_method=sample_method, grid_size=grid_size,
                     min_size=min_size, peak_width=peak_width,
                     refine_intensity=refine_intensity, fix_square=fix_square)
