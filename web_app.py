import sys
import os
import base64
import io
import json
import struct

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

import cv2
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify, send_file, Response
from perfect_pixel import get_perfect_pixel

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024  # 32 MB


# ── Palette file parsers ────────────────────────────────────────────────────

def parse_gpl(text):
    """Parse GIMP Palette (.gpl) text → list of [r, g, b]"""
    colors = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("GIMP") \
                or line.startswith("Name:") or line.startswith("Columns:"):
            continue
        parts = line.split()
        if len(parts) >= 3:
            try:
                colors.append([int(parts[0]), int(parts[1]), int(parts[2])])
            except ValueError:
                continue
    return colors


def parse_pal(text):
    """Parse JASC-PAL (.pal) text → list of [r, g, b]"""
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if len(lines) < 3 or lines[0] != "JASC-PAL":
        return []
    try:
        n = int(lines[2])
    except ValueError:
        return []
    colors = []
    for line in lines[3:3 + n]:
        parts = line.split()
        if len(parts) >= 3:
            try:
                colors.append([int(parts[0]), int(parts[1]), int(parts[2])])
            except ValueError:
                continue
    return colors


def parse_act(data):
    """Parse Adobe Color Table (.act) binary → list of [r, g, b]
    Standard: 768 bytes (256 colors × 3).
    Extended: 772 bytes (+2 byte count, +2 byte transparent index).
    """
    n_colors = 256
    if len(data) >= 772:
        n_colors = (data[768] << 8) | data[769]
        if n_colors == 0:
            n_colors = 256
    colors = []
    for i in range(n_colors):
        offset = i * 3
        if offset + 3 <= len(data):
            colors.append([data[offset], data[offset + 1], data[offset + 2]])
    return colors


def parse_png_palette(rgb_array):
    """Extract unique colors from PNG image pixels → list of [r, g, b]"""
    pixels = rgb_array.reshape(-1, 3)
    unique = np.unique(pixels, axis=0)
    return unique.tolist()


# ── Palette file exporters ──────────────────────────────────────────────────

def export_gpl(palette, name="Custom Palette"):
    """Export to GIMP Palette (.gpl) text"""
    lines = ["GIMP Palette", f"Name: {name}", "#"]
    for r, g, b in palette:
        lines.append(f"{int(r):3d} {int(g):3d} {int(b):3d}\tUntitled")
    return "\n".join(lines) + "\n"


def export_pal(palette):
    """Export to JASC-PAL (.pal) text"""
    lines = ["JASC-PAL", "0100", str(len(palette))]
    for r, g, b in palette:
        lines.append(f"{int(r)} {int(g)} {int(b)}")
    return "\n".join(lines) + "\n"


def export_act(palette):
    """Export to Adobe Color Table (.act) binary (772-byte extended format)"""
    data = bytearray(772)
    for i, (r, g, b) in enumerate(palette[:256]):
        data[i * 3] = int(r)
        data[i * 3 + 1] = int(g)
        data[i * 3 + 2] = int(b)
    n = min(len(palette), 256)
    data[768] = (n >> 8) & 0xFF
    data[769] = n & 0xFF
    data[770] = 0xFF  # no transparent color
    data[771] = 0xFF
    return bytes(data)


# ── Color space conversion ──────────────────────────────────────────────────

def rgb_to_lab(rgb_array):
    """Convert (N, 3) uint8 RGB array → (N, 3) float32 CIE LAB array"""
    rgb = rgb_array.astype(np.float32) / 255.0

    # sRGB linearization
    mask = rgb <= 0.04045
    rgb_lin = np.where(mask, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)

    # Linear RGB → XYZ (D65)
    M = np.array([
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041],
    ], dtype=np.float32)
    xyz = rgb_lin @ M.T  # (N, 3)

    # Normalize by D65 white point
    xyz[:, 0] /= 0.95047
    # xyz[:, 1] already normalized (Y white = 1.0)
    xyz[:, 2] /= 1.08883

    # XYZ → LAB
    epsilon = 0.008856
    kappa = 903.3
    f = np.where(xyz > epsilon, xyz ** (1.0 / 3.0), (kappa * xyz + 16.0) / 116.0)

    L = 116.0 * f[:, 1] - 16.0
    a = 500.0 * (f[:, 0] - f[:, 1])
    b = 200.0 * (f[:, 1] - f[:, 2])
    return np.stack([L, a, b], axis=1)


# ── Color mapping algorithms ────────────────────────────────────────────────

def _nearest_indices(pixels_feat, palette_feat):
    """Return index of nearest palette color for each pixel (squared Euclidean)."""
    # pixels_feat: (N, 3), palette_feat: (K, 3)
    diffs = pixels_feat[:, None, :] - palette_feat[None, :, :]  # (N, K, 3)
    dists = np.sum(diffs ** 2, axis=2)  # (N, K)
    return np.argmin(dists, axis=1)  # (N,)


def apply_palette_vector(rgb_array, palette, use_lab=False):
    """Map each pixel to nearest palette color in RGB or LAB space."""
    palette_arr = np.array(palette, dtype=np.float32)
    pixels = rgb_array.reshape(-1, 3).astype(np.float32)
    if use_lab:
        pixels_f = rgb_to_lab(pixels)
        palette_f = rgb_to_lab(palette_arr)
    else:
        pixels_f = pixels
        palette_f = palette_arr
    idx = _nearest_indices(pixels_f, palette_f)
    result = palette_arr[idx].astype(np.uint8).reshape(rgb_array.shape)
    return result


def _pillow_quantize(rgb_array, n_colors, method):
    """Internal helper: quantize via a Pillow method → list of [r,g,b]"""
    img = Image.fromarray(rgb_array.astype(np.uint8))
    quantized = img.quantize(colors=n_colors, method=method, dither=0)
    palette_raw = quantized.getpalette()
    n = min(n_colors, len(palette_raw) // 3)
    return [[palette_raw[i * 3], palette_raw[i * 3 + 1], palette_raw[i * 3 + 2]]
            for i in range(n)]


def quantize_image(rgb_array, n_colors):
    """Quantize image to n_colors using Pillow FASTOCTREE → list of [r,g,b]"""
    return _pillow_quantize(rgb_array, n_colors, Image.Quantize.FASTOCTREE)


def _deduplicate_palette(palette, lab_threshold=5.0):
    """Remove near-duplicate colors (LAB distance < threshold) from palette list."""
    if not palette:
        return []
    result = [palette[0]]
    result_lab = rgb_to_lab(np.array([palette[0]], dtype=np.float32))
    for color in palette[1:]:
        c_lab = rgb_to_lab(np.array([color], dtype=np.float32))
        diffs = c_lab[0] - result_lab  # (K, 3)
        dists = np.sqrt(np.sum(diffs ** 2, axis=1))
        if np.min(dists) >= lab_threshold:
            result.append(color)
            result_lab = np.vstack([result_lab, c_lab])
    return result


def quantize_coverage_boost(rgb_array, n_colors, min_region_pct=1.0):
    """
    Coverage-Boost quantization (iterative slot replacement):
    1. Start with FASTOCTREE palette of exactly n_colors.
    2. Each iteration: find the largest spatially-coherent orphan region
       (pixels whose nearest palette color is LAB-distance > 15 away, forming a
       connected area >= min_region_pct% of the image).
    3. Replace the "least important" palette slot (the one whose removal causes
       the smallest total reassignment error) with a representative of that region.
    4. Repeat up to n_colors times; stop early when no significant orphan regions remain.
    Always returns exactly n_colors colors.

    min_region_pct: minimum region area as % of total pixels (e.g. 0.01 ~ 100).
    """
    H, W = rgb_array.shape[:2]
    total_px = H * W
    min_px = max(1, int(total_px * min_region_pct / 100.0))

    # ── Step 1: initialize palette with FASTOCTREE ───────────────────────────
    raw = _pillow_quantize(rgb_array, n_colors, Image.Quantize.FASTOCTREE)
    palette = np.array(raw, dtype=np.float32)
    # Pad to exactly n_colors if Pillow returned fewer unique colors
    while len(palette) < n_colors:
        palette = np.vstack([palette, palette[len(palette) % max(1, len(raw))]])

    pixels     = rgb_array.reshape(-1, 3).astype(np.float32)  # (N, 3)
    pixels_lab = rgb_to_lab(pixels)                            # (N, 3)
    kernel     = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))

    for _ in range(n_colors):
        # ── Compute pairwise LAB distances (N, K) ────────────────────────────
        palette_lab = rgb_to_lab(palette)                              # (K, 3)
        diffs       = pixels_lab[:, None, :] - palette_lab[None, :, :]  # (N,K,3)
        sq_dists    = np.sum(diffs ** 2, axis=2)                       # (N, K)
        sorted_sq   = np.sort(sq_dists, axis=1)                        # (N, K)
        min_dists   = np.sqrt(sorted_sq[:, 0])                         # (N,)

        # ── Identify orphan pixels (poorly covered) ───────────────────────────
        orphan_mask = (min_dists > 15).reshape(H, W).astype(np.uint8)
        if orphan_mask.sum() == 0:
            break

        # Morphological opening removes isolated noise pixels
        cleaned = cv2.morphologyEx(orphan_mask, cv2.MORPH_OPEN, kernel)
        if cleaned.sum() == 0:
            break

        # Keep only connected components >= min_px pixels
        n_lab, labels, stats, _ = cv2.connectedComponentsWithStats(
            cleaned, connectivity=8)
        for lbl in range(1, n_lab):
            if stats[lbl, cv2.CC_STAT_AREA] < min_px:
                cleaned[labels == lbl] = 0

        if cleaned.sum() == 0:
            break

        # Re-label to find the largest surviving region
        n_lab, labels, stats, _ = cv2.connectedComponentsWithStats(
            cleaned, connectivity=8)
        if n_lab <= 1:
            break

        areas    = [stats[lbl, cv2.CC_STAT_AREA] for lbl in range(1, n_lab)]
        best_lbl = 1 + int(np.argmax(areas))
        region_flat = (labels.reshape(-1) == best_lbl)
        candidate   = np.median(pixels[region_flat], axis=0)  # RGB float32

        # Skip if candidate is already well-represented in the palette (LAB < 5)
        cand_lab = rgb_to_lab(candidate[None])                         # (1, 3)
        pal_lab  = rgb_to_lab(palette)                                 # (K, 3)
        if float(np.min(np.sqrt(np.sum((cand_lab - pal_lab) ** 2, axis=1)))) < 5.0:
            break

        # ── Find "least important" palette slot ───────────────────────────────
        # Removal cost for slot k = extra LAB error pixels assigned to k would
        # incur if k were removed (reassigned to their second-nearest color).
        assignments = np.argmin(sq_dists, axis=1)                      # (N,)
        first_dist  = np.sqrt(sorted_sq[:, 0])
        second_dist = np.sqrt(sorted_sq[:, 1]) if n_colors > 1 else first_dist

        removal_costs = np.zeros(n_colors, dtype=np.float32)
        for k in range(n_colors):
            mask_k = (assignments == k)
            if mask_k.sum() > 0:
                removal_costs[k] = float(
                    np.sum(second_dist[mask_k] - first_dist[mask_k]))
            # Empty slots have cost 0 — they are cheapest to replace

        replace_idx = int(np.argmin(removal_costs))
        palette[replace_idx] = candidate

    return palette.clip(0, 255).astype(np.uint8).tolist()


def apply_palette_swap(rgb_array, custom_palette):
    """
    Palette-swap mode:
    1. Quantize image → palette B (same size as A)
    2. Match each B color → nearest A color in LAB space
    3. Map pixels: pixel → B index → A color
    """
    n = len(custom_palette)
    palette_a = np.array(custom_palette, dtype=np.float32)

    # Step 1: generate image palette B via quantization
    palette_b_list = quantize_image(rgb_array, n)
    palette_b = np.array(palette_b_list, dtype=np.float32)

    # Step 2: match B → A in LAB space
    palette_a_lab = rgb_to_lab(palette_a)
    palette_b_lab = rgb_to_lab(palette_b)
    b_to_a = _nearest_indices(palette_b_lab, palette_a_lab)  # (K,)

    # Step 3: map pixels → B index → A color
    pixels = rgb_array.reshape(-1, 3).astype(np.float32)
    b_idx = _nearest_indices(pixels, palette_b)  # (N,)
    a_idx = b_to_a[b_idx]  # (N,)
    result = palette_a[a_idx].astype(np.uint8).reshape(rgb_array.shape)
    return result


# ── Image encoding helpers ──────────────────────────────────────────────────

def encode_png_b64(rgb_array):
    bgr = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)
    _, buf = cv2.imencode(".png", bgr)
    return base64.b64encode(buf).decode("utf-8")


def b64_to_rgb(b64_str):
    data = base64.b64decode(b64_str)
    arr = np.frombuffer(data, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


# ── Flask routes ────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return send_file(os.path.join(os.path.dirname(__file__), "web_ui.html"))


@app.route("/editor")
def editor():
    return send_file(os.path.join(os.path.dirname(__file__), "editor.html"))



@app.route("/icons/<path:filename>")
def icons(filename):
    return send_file(os.path.join(os.path.dirname(__file__), "icons", filename))


@app.route("/output.png")
def output_png():
    return send_file(os.path.join(os.path.dirname(__file__), "output.png"))


@app.route("/api/process", methods=["POST"])
def process():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files["image"]
    sample_method = request.form.get("sample_method", "center")
    refine_intensity = float(request.form.get("refine_intensity", 0.3))
    fix_square = request.form.get("fix_square", "true").lower() == "true"
    export_scale = int(request.form.get("export_scale", 8))

    file_bytes = np.frombuffer(file.read(), dtype=np.uint8)
    bgr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    if bgr is None:
        return jsonify({"error": "Cannot decode image"}), 400
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

    grid_w, grid_h, out = get_perfect_pixel(
        rgb,
        sample_method=sample_method,
        refine_intensity=refine_intensity,
        fix_square=fix_square,
        debug=False,
    )

    if grid_w is None or grid_h is None:
        return jsonify({"error": "Grid detection failed. Try a clearer pixel art image."}), 422

    out_b64 = encode_png_b64(out)
    scaled = cv2.resize(
        cv2.cvtColor(out, cv2.COLOR_RGB2BGR),
        (grid_w * export_scale, grid_h * export_scale),
        interpolation=cv2.INTER_NEAREST,
    )
    scaled_b64 = encode_png_b64(cv2.cvtColor(scaled, cv2.COLOR_BGR2RGB))

    return jsonify({
        "grid_w": grid_w,
        "grid_h": grid_h,
        "output": out_b64,
        "output_scaled": scaled_b64,
    })


@app.route("/api/generate-palette", methods=["POST"])
def api_generate_palette():
    """Generate a palette from a base64 image using selectable quantization algorithm."""
    image_b64 = request.form.get("image")
    n_colors = int(request.form.get("n_colors", 16))
    n_colors = max(2, min(512, n_colors))
    algorithm = request.form.get("algorithm", "fastoctree")
    min_region_pct = float(request.form.get("min_region_pct", 1.0))

    if not image_b64:
        return jsonify({"error": "No image data"}), 400

    try:
        # Decode with RGBA to avoid transparent pixels being composited to black
        # by cv2.IMREAD_COLOR, which would inject fake black into the palette.
        raw_data = base64.b64decode(image_b64)
        pil_rgba = Image.open(io.BytesIO(raw_data)).convert('RGBA')
        rgba_arr = np.array(pil_rgba, dtype=np.uint8)
        alpha_mask = rgba_arr[:, :, 3] >= 128
        opaque_pixels = rgba_arr[:, :, :3][alpha_mask]   # (N, 3)
        if opaque_pixels.shape[0] == 0:
            return jsonify({"error": "No opaque pixels to quantize"}), 400
        rgb = opaque_pixels.reshape(-1, 1, 3)   # (N, 1, 3) strip — quantizers work on pixel color, not layout
    except Exception as e:
        return jsonify({"error": f"Cannot decode image: {e}"}), 400

    try:
        if algorithm == "mediancut":
            palette = _pillow_quantize(rgb, n_colors, Image.Quantize.MEDIANCUT)
        elif algorithm == "boost":
            palette = quantize_coverage_boost(rgb, n_colors, min_region_pct=min_region_pct)
        else:  # fastoctree (default)
            palette = _pillow_quantize(rgb, n_colors, Image.Quantize.FASTOCTREE)
    except Exception as e:
        return jsonify({"error": f"Quantization failed: {e}"}), 500

    return jsonify({"palette": palette, "count": len(palette)})


@app.route("/api/apply-palette", methods=["POST"])
def api_apply_palette():
    """Apply a palette to a base64 image and return the result."""
    image_b64 = request.form.get("image")
    palette_json = request.form.get("palette")
    mode = request.form.get("mode", "vector")
    export_scale = int(request.form.get("scale", 8))

    if not image_b64 or not palette_json:
        return jsonify({"error": "Missing image or palette"}), 400

    try:
        rgb = b64_to_rgb(image_b64)
        palette = json.loads(palette_json)
    except Exception as e:
        return jsonify({"error": f"Invalid input: {e}"}), 400

    if not palette:
        return jsonify({"error": "Empty palette"}), 400

    if mode == "swap":
        result = apply_palette_swap(rgb, palette)
    elif mode == "perceptual":
        result = apply_palette_vector(rgb, palette, use_lab=True)
    else:  # "vector" (default)
        result = apply_palette_vector(rgb, palette, use_lab=False)

    out_b64 = encode_png_b64(result)

    h, w = result.shape[:2]
    scaled = cv2.resize(
        cv2.cvtColor(result, cv2.COLOR_RGB2BGR),
        (w * export_scale, h * export_scale),
        interpolation=cv2.INTER_NEAREST,
    )
    scaled_b64 = encode_png_b64(cv2.cvtColor(scaled, cv2.COLOR_BGR2RGB))

    return jsonify({"output": out_b64, "output_scaled": scaled_b64})


@app.route("/api/parse-palette", methods=["POST"])
def api_parse_palette():
    """Parse an uploaded palette file (.act, .gpl, .pal, .png)."""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    f = request.files["file"]
    filename = f.filename.lower()
    name = os.path.splitext(f.filename)[0]

    try:
        if filename.endswith(".gpl"):
            text = f.read().decode("utf-8", errors="replace")
            palette = parse_gpl(text)
        elif filename.endswith(".pal"):
            text = f.read().decode("utf-8", errors="replace")
            palette = parse_pal(text)
        elif filename.endswith(".act"):
            data = f.read()
            palette = parse_act(data)
        elif filename.endswith(".png"):
            file_bytes = np.frombuffer(f.read(), dtype=np.uint8)
            bgr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            palette = parse_png_palette(rgb)
        else:
            return jsonify({"error": "Unsupported file format"}), 400
    except Exception as e:
        return jsonify({"error": f"Parse error: {e}"}), 400

    if not palette:
        return jsonify({"error": "No colors found in file"}), 400

    return jsonify({"palette": palette, "name": name})


@app.route("/api/export-palette", methods=["POST"])
def api_export_palette():
    """Export palette to .act / .gpl / .pal and return as file download."""
    palette_json = request.form.get("palette")
    fmt = request.form.get("format", "gpl").lower()
    name = request.form.get("name", "Custom Palette")

    if not palette_json:
        return jsonify({"error": "No palette data"}), 400

    try:
        palette = json.loads(palette_json)
    except Exception:
        return jsonify({"error": "Invalid palette JSON"}), 400

    if fmt == "act":
        data = export_act(palette)
        return Response(
            data,
            mimetype="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{name}.act"'},
        )
    elif fmt == "pal":
        text = export_pal(palette)
        return Response(
            text,
            mimetype="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{name}.pal"'},
        )
    else:  # gpl
        text = export_gpl(palette, name)
        return Response(
            text,
            mimetype="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{name}.gpl"'},
        )


if __name__ == "__main__":
    print("Perfect Pixel Web UI running at http://localhost:5010")
    app.run(host="0.0.0.0", port=5010, debug=False)
