// ── RotSprite rotation algorithm ─────────────────────────────────────────

function _showStatus(msg) {
  var toast = document.getElementById('editor-status-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'editor-status-toast';
    toast.style.cssText = [
      'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
      'background:rgba(40,38,58,0.95)', 'color:#e0ddf8',
      'border:1px solid #7c6af7', 'border-radius:8px',
      'padding:8px 18px', 'font-size:13px', 'z-index:9999',
      'pointer-events:none', 'white-space:nowrap',
    ].join(';');
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.display = 'block';
  clearTimeout(_showStatus._timer);
  _showStatus._timer = setTimeout(function() { toast.style.display = 'none'; }, 3000);
  console.info('[status]', msg);
}
_showStatus._timer = null;

function colorEq(pixels, i1, i2) {
  if (pixels[i1+3] === 0 && pixels[i2+3] === 0) return true;
  if (pixels[i1+3] === 0 || pixels[i2+3] === 0) return false;
  return pixels[i1]   === pixels[i2]   &&
         pixels[i1+1] === pixels[i2+1] &&
         pixels[i1+2] === pixels[i2+2] &&
         pixels[i1+3] === pixels[i2+3];
}

function scale2x(pixels, w, h) {
  var OW  = w * 2;
  var out = new Uint8ClampedArray(OW * h * 2 * 4);

  function copyPixel(src, dst) {
    out[dst]   = pixels[src];
    out[dst+1] = pixels[src+1];
    out[dst+2] = pixels[src+2];
    out[dst+3] = pixels[src+3];
  }

  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var B = (Math.max(0, y-1) * w + x)              * 4;
      var D = (y * w + Math.max(0, x-1))               * 4;
      var E = (y * w + x)                               * 4;
      var F = (y * w + Math.min(w-1, x+1))             * 4;
      var H = (Math.min(h-1, y+1) * w + x)             * 4;

      var oy = y * 2, ox = x * 2;
      var E0 = (oy * OW + ox)         * 4;
      var E1 = (oy * OW + ox + 1)     * 4;
      var E2 = ((oy+1) * OW + ox)     * 4;
      var E3 = ((oy+1) * OW + ox + 1) * 4;

      if (!colorEq(pixels, B, H) && !colorEq(pixels, D, F)) {
        copyPixel(colorEq(pixels, D, B) && pixels[D+3] > 0 ? D : E, E0);
        copyPixel(colorEq(pixels, B, F) && pixels[B+3] > 0 ? F : E, E1);
        copyPixel(colorEq(pixels, D, H) && pixels[D+3] > 0 ? D : E, E2);
        copyPixel(colorEq(pixels, H, F) && pixels[H+3] > 0 ? F : E, E3);
      } else {
        copyPixel(E, E0); copyPixel(E, E1);
        copyPixel(E, E2); copyPixel(E, E3);
      }
    }
  }
  return out;
}

function scaleNearestNeighbor(pixels, srcW, srcH, dstW, dstH) {
  var out = new Uint8ClampedArray(dstW * dstH * 4);
  var xRatio = srcW / dstW;
  var yRatio = srcH / dstH;
  for (var dy = 0; dy < dstH; dy++) {
    var sy = Math.min(srcH - 1, Math.floor(dy * yRatio));
    for (var dx = 0; dx < dstW; dx++) {
      var sx = Math.min(srcW - 1, Math.floor(dx * xRatio));
      var srcI = (sy * srcW + sx) * 4;
      var dstI = (dy * dstW + dx) * 4;
      out[dstI]   = pixels[srcI];
      out[dstI+1] = pixels[srcI+1];
      out[dstI+2] = pixels[srcI+2];
      out[dstI+3] = pixels[srcI+3];
    }
  }
  return out;
}

function rotSprite(pixels, w, h, angleDeg) {
  var buf = pixels, bw = w, bh = h;
  for (var pass = 0; pass < 3; pass++) {
    buf = scale2x(buf, bw, bh);
    bw *= 2; bh *= 2;
  }
  var rad = -angleDeg * Math.PI / 180;
  var cos = Math.cos(rad), sin = Math.sin(rad);
  var cx = bw / 2, cy = bh / 2;
  var rotBuf = new Uint8ClampedArray(bw * bh * 4);

  for (var dy = 0; dy < bh; dy++) {
    for (var dx = 0; dx < bw; dx++) {
      var relX = dx - cx, relY = dy - cy;
      var srcX = Math.round(relX * cos - relY * sin + cx);
      var srcY = Math.round(relX * sin + relY * cos + cy);
      if (srcX >= 0 && srcX < bw && srcY >= 0 && srcY < bh) {
        var si = (srcY * bw + srcX) * 4;
        var di = (dy * bw + dx) * 4;
        rotBuf[di]   = buf[si];
        rotBuf[di+1] = buf[si+1];
        rotBuf[di+2] = buf[si+2];
        rotBuf[di+3] = buf[si+3];
      }
    }
  }

  var out = new Uint8ClampedArray(w * h * 4);
  for (var oy = 0; oy < h; oy++) {
    for (var ox = 0; ox < w; ox++) {
      var sx2 = ox * 8 + 4;
      var sy2 = oy * 8 + 4;
      if (sx2 < bw && sy2 < bh) {
        var si2 = (sy2 * bw + sx2) * 4;
        var di2 = (oy * w + ox) * 4;
        out[di2]   = rotBuf[si2];
        out[di2+1] = rotBuf[si2+1];
        out[di2+2] = rotBuf[si2+2];
        out[di2+3] = rotBuf[si2+3];
      }
    }
  }
  return out;
}

function _tightCrop(pixels, w, h) {
  var minX = w, maxX = -1, minY = h, maxY = -1;
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      if (pixels[(y * w + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { pixels: pixels, w: w, h: h, offX: 0, offY: 0 };
  if (minX === 0 && minY === 0 && maxX === w - 1 && maxY === h - 1) {
    return { pixels: pixels, w: w, h: h, offX: 0, offY: 0 };
  }
  var cw = maxX - minX + 1, ch = maxY - minY + 1;
  var out = new Uint8ClampedArray(cw * ch * 4);
  for (var y2 = 0; y2 < ch; y2++) {
    for (var x2 = 0; x2 < cw; x2++) {
      var si = ((y2 + minY) * w + (x2 + minX)) * 4;
      var di = (y2 * cw + x2) * 4;
      out[di] = pixels[si]; out[di+1] = pixels[si+1];
      out[di+2] = pixels[si+2]; out[di+3] = pixels[si+3];
    }
  }
  return { pixels: out, w: cw, h: ch, offX: minX, offY: minY };
}

function _rotSpriteExpanded(pixels, w, h, angleDeg) {
  var buf = pixels, bw = w, bh = h;
  for (var pass = 0; pass < 3; pass++) {
    buf = scale2x(buf, bw, bh);
    bw *= 2; bh *= 2;
  }
  var rad = -angleDeg * Math.PI / 180;
  var cos = Math.cos(rad), sin = Math.sin(rad);
  var absCos = Math.abs(cos), absSin = Math.abs(sin);
  var EPS = 1e-9;
  var outW = Math.ceil(w * absCos + h * absSin - EPS);
  var outH = Math.ceil(w * absSin + h * absCos - EPS);
  var outBw = outW * 8;
  var outBh = outH * 8;
  var icx = bw / 2, icy = bh / 2;
  var ocx = outBw / 2, ocy = outBh / 2;

  var rotBuf = new Uint8ClampedArray(outBw * outBh * 4);
  for (var dy = 0; dy < outBh; dy++) {
    for (var dx = 0; dx < outBw; dx++) {
      var relX = dx - ocx, relY = dy - ocy;
      var srcX = Math.round(relX * cos - relY * sin + icx);
      var srcY = Math.round(relX * sin + relY * cos + icy);
      if (srcX >= 0 && srcX < bw && srcY >= 0 && srcY < bh) {
        var si = (srcY * bw + srcX) * 4;
        var di = (dy * outBw + dx) * 4;
        rotBuf[di]   = buf[si];   rotBuf[di+1] = buf[si+1];
        rotBuf[di+2] = buf[si+2]; rotBuf[di+3] = buf[si+3];
      }
    }
  }
  var out = new Uint8ClampedArray(outW * outH * 4);
  for (var oy = 0; oy < outH; oy++) {
    for (var ox = 0; ox < outW; ox++) {
      var sx = ox * 8 + 4, sy = oy * 8 + 4;
      if (sx < outBw && sy < outBh) {
        var si2 = (sy * outBw + sx) * 4, di2 = (oy * outW + ox) * 4;
        out[di2]   = rotBuf[si2];   out[di2+1] = rotBuf[si2+1];
        out[di2+2] = rotBuf[si2+2]; out[di2+3] = rotBuf[si2+3];
      }
    }
  }
  return { pixels: out, w: outW, h: outH };
}
