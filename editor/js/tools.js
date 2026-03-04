// ── Tool dispatch + implementations ─────────────────────────────────────────

var tools = {
  pencil:     { onDown: function(){}, onMove: function(){}, onUp: function(){}, onCursor: function(){} },
  eraser:     { onDown: function(){}, onMove: function(){}, onUp: function(){}, onCursor: function(){} },
  bucket:     { onDown: function(){}, onMove: function(){}, onUp: function(){}, onCursor: function(){} },
  eyedropper: { onDown: function(){}, onMove: function(){}, onUp: function(){}, onCursor: function(){} },
  marquee:    { onDown: function(){}, onMove: function(){}, onUp: function(){}, onCursor: function(){} },
  wand:       { onDown: function(){}, onMove: function(){}, onUp: function(){}, onCursor: function(){} },
};
var isDrawing = false;

// ── Transform helper state ─────────────────────────────────────────────────
var _scaleLinkActive = false;
var _scaleInputTimer = null;
var _rotateInputTimer = null;

// ── Pencil state ───────────────────────────────────────────────────────────
var _pencilStamp = null;
var _lastPencilX = null, _lastPencilY = null;

// ── Eraser state ───────────────────────────────────────────────────────────
var _eraserStamp = null;
var _lastEraserX = null, _lastEraserY = null;

// ── Marquee state ──────────────────────────────────────────────────────────
var _marqueeStartX = null, _marqueeStartY = null;
var _marqueeCurrentX = null, _marqueeCurrentY = null;

// ── Transform: helper functions ────────────────────────────────────────────

function _getSelCanvasCoords() {
  var caRect  = document.getElementById('canvas-area').getBoundingClientRect();
  var pixRect = pixelCanvas.getBoundingClientRect();
  return {
    originX: pixRect.left - caRect.left,
    originY: pixRect.top  - caRect.top,
    ps:      pixRect.width / EditorState.width,
  };
}

function _selCanvasPointerDown(e) {
  var ts = EditorState.transformState;
  if (!ts) return;
  e.preventDefault();

  var hitResult = hitTestHandle(e.clientX, e.clientY);
  if (hitResult !== null && hitResult.type === 'scale') {
    var handleIdx = hitResult.handleIdx;
    ts._origFloatPixels  = ts.floatPixels.slice();
    ts._origFloatW       = ts.floatW;
    ts._origFloatH       = ts.floatH;
    ts._dragStartScaleX  = ts.scaleX;
    ts._dragStartScaleY  = ts.scaleY;
    ts._dragMode         = 'handle-' + handleIdx;
    ts._dragStartClientX = e.clientX;
    ts._dragStartClientY = e.clientY;
    ts._dragStartFloatX  = ts.floatX;
    ts._dragStartFloatY  = ts.floatY;
    var anchorFrac = [[1,1],[0.5,1],[0,1],[1,0.5],[0,0.5],[1,0],[0.5,0],[0,0]];
    var af = anchorFrac[handleIdx];
    ts._dragAnchorX     = ts.floatX + af[0] * ts.floatW;
    ts._dragAnchorY     = ts.floatY + af[1] * ts.floatH;
    ts._dragAnchorFracX = af[0];
    ts._dragAnchorFracY = af[1];
  } else if (hitResult !== null && hitResult.type === 'rotate') {
    tools.move.onDown(0, 0, e);
  } else {
    ts._dragMode         = 'move';
    ts._dragStartClientX = e.clientX;
    ts._dragStartClientY = e.clientY;
    ts._dragStartFloatX  = ts.floatX;
    ts._dragStartFloatY  = ts.floatY;
  }
  selCanvas.setPointerCapture(e.pointerId);

  function onSelMove(ev) { tools.move.onMove(0, 0, ev); }
  function onSelUp(ev) {
    tools.move.onUp(0, 0, ev);
    selCanvas.removeEventListener('pointermove', onSelMove);
    selCanvas.removeEventListener('pointerup', onSelUp);
  }
  selCanvas.addEventListener('pointermove', onSelMove);
  selCanvas.addEventListener('pointerup', onSelUp);
}

function activateTransform() {
  if (!EditorState.selectionMask || !EditorState.selection) return;
  if (EditorState.transformState) return;

  var bb   = EditorState.selection;
  var W    = EditorState.width;
  var mask = EditorState.selectionMask;

  var originalPixels = EditorState.pixels.slice();

  var floatPx = new Uint8ClampedArray(bb.w * bb.h * 4);
  for (var fy = 0; fy < bb.h; fy++) {
    for (var fx = 0; fx < bb.w; fx++) {
      var cx = bb.x + fx, cy = bb.y + fy;
      if (mask[cx + cy * W]) {
        var srcI = (cy * W + cx) * 4;
        var dstI = (fy * bb.w + fx) * 4;
        floatPx[dstI]   = EditorState.pixels[srcI];
        floatPx[dstI+1] = EditorState.pixels[srcI+1];
        floatPx[dstI+2] = EditorState.pixels[srcI+2];
        floatPx[dstI+3] = EditorState.pixels[srcI+3];
      }
    }
  }

  for (var i = 0; i < mask.length; i++) {
    if (mask[i]) {
      var px = i % W, py = (i / W) | 0;
      setPixel(px, py, [0, 0, 0, 0]);
    }
  }
  flushPixels();

  if (antsRafId) { cancelAnimationFrame(antsRafId); antsRafId = null; }

  EditorState.transformState = {
    originalPixels: originalPixels,
    floatPixels:      floatPx,
    floatW:           bb.w,
    floatH:           bb.h,
    floatX:           bb.x,
    floatY:           bb.y,
    scaleX:           1.0,
    scaleY:           1.0,
    angleDeg:         0,
    origBbox:         { x: bb.x, y: bb.y, w: bb.w, h: bb.h },
    _baseFloatPixels: floatPx,
    _baseFloatW:      bb.w,
    _baseFloatH:      bb.h,
    _rotatePivot:     { x: Math.round(bb.x + bb.w / 2), y: Math.round(bb.y + bb.h / 2) },
    _dragMode:        null,
    _dragStartClientX: 0, _dragStartClientY: 0,
    _dragStartFloatX:  0, _dragStartFloatY:  0,
  };

  _drawTransformUI();
  _showTransformTopBar();

  selCanvas.style.pointerEvents = 'auto';
  selCanvas.addEventListener('pointerdown', _selCanvasPointerDown);
}

// ── _applyRotationPreview ────────────────────────────────────────────────
function _applyRotationPreview() {
  var ts = EditorState.transformState;
  if (!ts) return;

  var angleDeg = ts.angleDeg;

  if (ts.origBbox.w * ts.origBbox.h > 128 * 128) {
    _showStatus('Selection too large for rotation \u2014 max 128\u00d7128px');
    return;
  }

  var srcPx = ts._baseFloatPixels;
  var srcW  = ts._baseFloatW;
  var srcH  = ts._baseFloatH;

  var scaledPx = srcPx;
  var scaledW  = srcW;
  var scaledH  = srcH;
  if (Math.abs(ts.scaleX - 1.0) > 0.001 || Math.abs(ts.scaleY - 1.0) > 0.001) {
    scaledW = Math.max(1, Math.round(ts.origBbox.w * ts.scaleX));
    scaledH = Math.max(1, Math.round(ts.origBbox.h * ts.scaleY));
    scaledPx = scaleNearestNeighbor(srcPx, srcW, srcH, scaledW, scaledH);
  }

  if (!ts._rotatePivot) {
    ts._rotatePivot = { x: Math.round(ts.floatX + ts.floatW / 2), y: Math.round(ts.floatY + ts.floatH / 2) };
  }

  var result = _rotSpriteExpanded(scaledPx, scaledW, scaledH, angleDeg);

  ts.floatPixels = result.pixels;
  ts.floatW      = result.w;
  ts.floatH      = result.h;
  ts.floatX      = Math.round(ts._rotatePivot.x - result.w / 2);
  ts.floatY      = Math.round(ts._rotatePivot.y - result.h / 2);
  ts._borderRect = {
    x: Math.round(ts._rotatePivot.x - scaledW / 2),
    y: Math.round(ts._rotatePivot.y - scaledH / 2),
    w: scaledW,
    h: scaledH,
  };

  _drawTransformUI();
}

function _finalizeRotationBbox() {
  var ts = EditorState.transformState;
  if (!ts || ts.angleDeg === 0) return;

  if (ts.origBbox.w * ts.origBbox.h > 128 * 128) return;

  var srcPx = ts._baseFloatPixels;
  var srcW  = ts._baseFloatW;
  var srcH  = ts._baseFloatH;

  var scaledPx = srcPx, scaledW = srcW, scaledH = srcH;
  if (Math.abs(ts.scaleX - 1.0) > 0.001 || Math.abs(ts.scaleY - 1.0) > 0.001) {
    scaledW = Math.max(1, Math.round(ts.origBbox.w * ts.scaleX));
    scaledH = Math.max(1, Math.round(ts.origBbox.h * ts.scaleY));
    scaledPx = scaleNearestNeighbor(srcPx, srcW, srcH, scaledW, scaledH);
  }

  var result = _rotSpriteExpanded(scaledPx, scaledW, scaledH, ts.angleDeg);

  var crop    = _tightCrop(result.pixels, result.w, result.h);

  var piv = ts._rotatePivot || { x: Math.round(ts.floatX + ts.floatW / 2), y: Math.round(ts.floatY + ts.floatH / 2) };
  var baseX = Math.round(piv.x - result.w / 2);
  var baseY = Math.round(piv.y - result.h / 2);

  ts.floatPixels = crop.pixels;
  ts.floatW      = crop.w;
  ts.floatH      = crop.h;
  ts.floatX      = baseX + crop.offX;
  ts.floatY      = baseY + crop.offY;
  ts._borderRect = null;

  _drawTransformUI();
}

// ── hitTestHandle ────────────────────────────────────────────────────────
function hitTestHandle(clientX, clientY) {
  if (!EditorState.transformState) return null;
  var ts = EditorState.transformState;
  var caRect  = document.getElementById('canvas-area').getBoundingClientRect();
  var pixRect = pixelCanvas.getBoundingClientRect();
  var originX = pixRect.left - caRect.left;
  var originY = pixRect.top  - caRect.top;
  var ps      = pixRect.width / EditorState.width;

  var lx = clientX - caRect.left;
  var ly = clientY - caRect.top;

  var br = ts._borderRect || { x: ts.floatX, y: ts.floatY, w: ts.floatW, h: ts.floatH };
  var sx = originX + br.x * ps;
  var sy = originY + br.y * ps;
  var sw = br.w * ps;
  var sh = br.h * ps;

  var INNER = 6;
  var OUTER = 20;

  var cornerIndices = [0, 2, 5, 7];

  var handlePositions = [
    [sx,        sy       ],
    [sx + sw/2, sy       ],
    [sx + sw,   sy       ],
    [sx,        sy + sh/2],
    [sx + sw,   sy + sh/2],
    [sx,        sy + sh  ],
    [sx + sw/2, sy + sh  ],
    [sx + sw,   sy + sh  ],
  ];
  for (var i = 0; i < handlePositions.length; i++) {
    var hx = handlePositions[i][0];
    var hy = handlePositions[i][1];
    var dx = Math.abs(lx - hx);
    var dy = Math.abs(ly - hy);
    if (dx <= INNER && dy <= INNER) {
      return { type: 'scale', handleIdx: i };
    }
    if (cornerIndices.indexOf(i) !== -1 && dx <= OUTER && dy <= OUTER) {
      return { type: 'rotate', handleIdx: i };
    }
  }
  return null;
}

function _drawTransformUI() {
  if (!EditorState.transformState) return;
  var ts  = EditorState.transformState;
  var dpr = window.devicePixelRatio || 1;
  selCtx.clearRect(0, 0, selCanvas.width / dpr, selCanvas.height / dpr);

  var coords = _getSelCanvasCoords();
  var originX = coords.originX, originY = coords.originY, ps = coords.ps;

  var sx = originX + ts.floatX * ps;
  var sy = originY + ts.floatY * ps;
  var sw = ts.floatW * ps;
  var sh = ts.floatH * ps;

  var br = ts._borderRect || { x: ts.floatX, y: ts.floatY, w: ts.floatW, h: ts.floatH };
  var bx = originX + br.x * ps;
  var by = originY + br.y * ps;
  var bw = br.w * ps;
  var bh = br.h * ps;

  if (ts.floatW > 0 && ts.floatH > 0) {
    var off = document.createElement('canvas');
    off.width = ts.floatW; off.height = ts.floatH;
    var offCtx = off.getContext('2d');
    offCtx.putImageData(new ImageData(ts.floatPixels.slice(), ts.floatW, ts.floatH), 0, 0);
    selCtx.imageSmoothingEnabled = false;
    selCtx.drawImage(off, sx, sy, sw, sh);
  }

  selCtx.strokeStyle = 'rgba(160,150,220,0.9)';
  selCtx.lineWidth   = 2;
  selCtx.setLineDash([4, 3]);
  selCtx.beginPath();
  selCtx.strokeRect(bx - 1, by - 1, bw + 2, bh + 2);
  selCtx.setLineDash([]);

  var HALF = 4;
  var handlePositions = [
    [bx,        by       ],
    [bx + bw/2, by       ],
    [bx + bw,   by       ],
    [bx,        by + bh/2],
    [bx + bw,   by + bh/2],
    [bx,        by + bh  ],
    [bx + bw/2, by + bh  ],
    [bx + bw,   by + bh  ],
  ];
  selCtx.fillStyle   = '#7c6af7';
  selCtx.strokeStyle = '#fff';
  selCtx.lineWidth   = 1;
  selCtx.setLineDash([]);
  for (var j = 0; j < handlePositions.length; j++) {
    var hx = handlePositions[j][0];
    var hy = handlePositions[j][1];
    selCtx.fillRect(hx - HALF, hy - HALF, HALF * 2, HALF * 2);
    selCtx.strokeRect(hx - HALF, hy - HALF, HALF * 2, HALF * 2);
  }
}

function _showTransformTopBar() {
  var panel = document.getElementById('tool-settings-move');
  if (panel) panel.style.display = 'flex';
  var ts = EditorState.transformState;
  if (!ts) return;
  var sxEl = document.getElementById('opt-scale-x');
  var syEl = document.getElementById('opt-scale-y');
  var aEl  = document.getElementById('opt-rotate-angle');
  if (sxEl) sxEl.value = Math.round(ts.scaleX * 100);
  if (syEl) syEl.value = Math.round(ts.scaleY * 100);
  if (aEl)  aEl.value  = ts.angleDeg;
}

function _hideTransformTopBar() {
  var panel = document.getElementById('tool-settings-move');
  if (panel) panel.style.display = 'none';
}

function _hideDistanceLabel() {
  var label = document.getElementById('transform-distance-label');
  if (label) label.style.display = 'none';
}

function _updateDistanceLabel() {
  var ts = EditorState.transformState;
  if (!ts) return;
  var label = document.getElementById('transform-distance-label');
  if (!label) return;

  var br = ts._borderRect || { x: ts.floatX, y: ts.floatY, w: ts.floatW, h: ts.floatH };
  var left   = br.x;
  var top    = br.y;
  var right  = EditorState.width  - (br.x + br.w);
  var bottom = EditorState.height - (br.y + br.h);
  label.textContent = '\u2190' + left + ' \u2191' + top + ' \u2192' + right + ' \u2193' + bottom;

  var pixRect = pixelCanvas.getBoundingClientRect();
  var ps      = pixRect.width / EditorState.width;
  var screenX = pixRect.left + br.x * ps;
  var screenY = pixRect.top  + (br.y + br.h) * ps + 6;
  label.style.left    = screenX + 'px';
  label.style.top     = screenY + 'px';
  label.style.display = 'block';
}

function applyTransform() {
  var ts = EditorState.transformState;
  if (!ts) return;

  var W = EditorState.width, H = EditorState.height;
  var newMask = new Uint8Array(W * H);
  var hasAppliedPixels = false;
  for (var fy = 0; fy < ts.floatH; fy++) {
    for (var fx = 0; fx < ts.floatW; fx++) {
      var cx = (ts.floatX + fx) | 0, cy = (ts.floatY + fy) | 0;
      if (cx < 0 || cx >= W || cy < 0 || cy >= H) continue;
      var si = (fy * ts.floatW + fx) * 4;
      if (ts.floatPixels[si + 3] === 0) continue;
      setPixel(cx, cy, [
        ts.floatPixels[si], ts.floatPixels[si+1],
        ts.floatPixels[si+2], ts.floatPixels[si+3],
      ]);
      newMask[cy * W + cx] = 1;
      hasAppliedPixels = true;
    }
  }
  flushPixels();
  pushHistory();
  EditorState.transformState = null;
  _hideTransformTopBar();
  _hideDistanceLabel();
  selCanvas.style.pointerEvents = 'none';
  selCanvas.removeEventListener('pointerdown', _selCanvasPointerDown);

  if (hasAppliedPixels) {
    EditorState.selectionMask = newMask;
    EditorState.selection = computeBoundingBox(newMask, W, H);
    if (antsRafId) { cancelAnimationFrame(antsRafId); antsRafId = null; }
    if (selCtx) {
      var dpr = window.devicePixelRatio || 1;
      selCtx.clearRect(0, 0, selCanvas.width / dpr, selCanvas.height / dpr);
    }
    antsRafId = requestAnimationFrame(drawAnts);
  } else {
    clearSelection();
  }
  setActiveTool(null);
}

function cancelTransform() {
  var ts = EditorState.transformState;
  if (!ts) return;
  EditorState.pixels = ts.originalPixels;
  flushPixels();
  EditorState.transformState = null;
  clearSelection();
  _hideTransformTopBar();
  _hideDistanceLabel();
  selCanvas.style.pointerEvents = 'none';
  selCanvas.removeEventListener('pointerdown', _selCanvasPointerDown);
  if (EditorState.activeTool === 'move') setActiveTool('marquee');
}

function _applyScaleFromInputs() {
  var ts = EditorState.transformState;
  if (!ts) return;

  var sxEl = document.getElementById('opt-scale-x');
  var syEl = document.getElementById('opt-scale-y');
  var sxVal = parseFloat(sxEl ? sxEl.value : '100') || 100;
  var syVal = parseFloat(syEl ? syEl.value : '100') || 100;

  ts.scaleX = Math.max(0.0625, Math.min(16, sxVal / 100));
  ts.scaleY = Math.max(0.0625, Math.min(16, syVal / 100));

  var srcPx = ts._origFloatPixels || ts.floatPixels;
  var srcW  = ts._origFloatW      || ts.origBbox.w;
  var srcH  = ts._origFloatH      || ts.origBbox.h;

  var newW = Math.max(1, Math.round(ts.origBbox.w * ts.scaleX));
  var newH = Math.max(1, Math.round(ts.origBbox.h * ts.scaleY));

  ts.floatPixels = scaleNearestNeighbor(srcPx, srcW, srcH, newW, newH);
  ts.floatW      = newW;
  ts.floatH      = newH;

  _drawTransformUI();
}

// ── Marquee helper functions ──────────────────────────────────────────────

function _marqueeGetSnappedRect(ax, ay, bx, by) {
  var gW = EditorState.gridW || 1;
  var gH = EditorState.gridH || 1;
  var x0 = snapToGrid(ax, gW), y0 = snapToGrid(ay, gH);
  var x1 = snapToGrid(bx, gW), y1 = snapToGrid(by, gH);
  return {
    rx: Math.min(x0, x1), ry: Math.min(y0, y1),
    rw: Math.abs(x1 - x0), rh: Math.abs(y1 - y0)
  };
}

function _marqueeDrawPreview(rx, ry, rw, rh) {
  var dpr = window.devicePixelRatio || 1;
  selCtx.clearRect(0, 0, selCanvas.width / dpr, selCanvas.height / dpr);
  if (rw <= 0 || rh <= 0) return;

  var caRect  = document.getElementById('canvas-area').getBoundingClientRect();
  var pixRect = pixelCanvas.getBoundingClientRect();
  var originX = pixRect.left - caRect.left;
  var originY = pixRect.top  - caRect.top;
  var ps = pixRect.width / EditorState.width;

  var border = [];
  var x0 = rx, y0 = ry, x1 = rx + rw - 1, y1 = ry + rh - 1;
  for (var px = x0; px <= x1; px++) {
    border.push([px, y0]);
    if (rh > 1) border.push([px, y1]);
  }
  for (var py = y0 + 1; py <= y1 - 1; py++) {
    border.push([x0, py]);
    if (rw > 1) border.push([x1, py]);
  }

  selCtx.globalCompositeOperation = 'source-over';
  selCtx.setLineDash([]);
  for (var k = 0; k < border.length; k++) {
    var bpx = border[k][0], bpy = border[k][1];
    if (bpx < 0 || bpy < 0 || bpx >= EditorState.width || bpy >= EditorState.height) continue;
    var pix = getPixel(bpx, bpy);
    selCtx.fillStyle = 'rgb(' + (255 - pix[0]) + ',' + (255 - pix[1]) + ',' + (255 - pix[2]) + ')';
    selCtx.fillRect(originX + bpx * ps, originY + bpy * ps, ps, ps);
  }
}

// ── initTools: sets up all tool implementations and event bindings ────────
function initTools() {
  // ── Pencil ──────────────────────────────────────────────────────────────
  tools.pencil = {
    onDown: function(x, y) {
      _pencilStamp = getBrushStamp(EditorState.toolOptions.brushSize, EditorState.toolOptions.brushShape);
      resetPixelPerfect();
      _lastPencilX = x; _lastPencilY = y;
      applyStamp(x, y, _pencilStamp, [EditorState.foregroundColor[0], EditorState.foregroundColor[1], EditorState.foregroundColor[2], EditorState.foregroundColor[3]]);
      _ppHistory.push([x, y]);
    },
    onMove: function(x, y) {
      if (_lastPencilX === null) return;
      var pts = bresenhamLine(_lastPencilX, _lastPencilY, x, y);
      for (var i = 1; i < pts.length; i++) {
        var px = pts[i][0], py = pts[i][1];
        if (EditorState.toolOptions.pixelPerfect && shouldSkipPixelPerfect(px, py)) continue;
        applyStamp(px, py, _pencilStamp, [EditorState.foregroundColor[0], EditorState.foregroundColor[1], EditorState.foregroundColor[2], EditorState.foregroundColor[3]]);
      }
      _lastPencilX = x; _lastPencilY = y;
    },
    onUp: function() {
      pushHistory();
      _lastPencilX = null; _lastPencilY = null;
      resetPixelPerfect();
    },
    onCursor: function(x, y) { drawCursorPreview(x, y, EditorState.foregroundColor); },
  };

  // ── Eraser ──────────────────────────────────────────────────────────────
  tools.eraser = {
    onDown: function(x, y) {
      _eraserStamp = getBrushStamp(EditorState.toolOptions.brushSize, EditorState.toolOptions.brushShape);
      if (EditorState.toolOptions.eraserPixelPerfect) { resetPixelPerfect(); _ppHistory.push([x, y]); }
      _lastEraserX = x; _lastEraserY = y;
      applyStamp(x, y, _eraserStamp, [0, 0, 0, 0]);
    },
    onMove: function(x, y) {
      if (_lastEraserX === null) return;
      var pts = bresenhamLine(_lastEraserX, _lastEraserY, x, y);
      for (var i = 1; i < pts.length; i++) {
        var px = pts[i][0], py = pts[i][1];
        if (EditorState.toolOptions.eraserPixelPerfect && shouldSkipPixelPerfect(px, py)) continue;
        applyStamp(px, py, _eraserStamp, [0, 0, 0, 0]);
      }
      _lastEraserX = x; _lastEraserY = y;
    },
    onUp: function() {
      pushHistory();
      _lastEraserX = null; _lastEraserY = null;
      if (EditorState.toolOptions.eraserPixelPerfect) resetPixelPerfect();
    },
    onCursor: function(x, y) {
      drawCursorPreview(x, y, [200, 200, 200, 128]);
    },
  };

  // ── Bucket ──────────────────────────────────────────────────────────────
  tools.bucket = {
    onDown: function(x, y) {
      pushHistory();
      floodFill(
        x, y,
        [EditorState.foregroundColor[0], EditorState.foregroundColor[1], EditorState.foregroundColor[2], EditorState.foregroundColor[3]],
        EditorState.toolOptions.bucketTolerance,
        EditorState.toolOptions.contiguous
      );
    },
    onMove: function() {},
    onUp: function() {},
    onCursor: function(x, y) {
      cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
      if (!EditorState.pixels) return;
      var fc = EditorState.foregroundColor;
      cursorCtx.fillStyle = 'rgba(' + fc[0] + ',' + fc[1] + ',' + fc[2] + ',' + (fc[3] / 255) + ')';
      cursorCtx.fillRect(x, y, 1, 1);
    },
  };

  // ── Eyedropper ──────────────────────────────────────────────────────────
  tools.eyedropper = {
    onDown: function(x, y) {
      var pix = getPixel(x, y);
      if (pix[3] === 0) return;
      EditorState.foregroundColor = [pix[0], pix[1], pix[2], 255];
      syncColorUI();
    },
    onMove: function() {},
    onUp: function() {},
    onCursor: function(x, y) {
      clearCursorPreview();
    },
  };

  // ── Marquee ─────────────────────────────────────────────────────────────
  tools.marquee = {
    onDown: function(x, y, e) {
      if (!e.shiftKey) {
        if (antsRafId) { cancelAnimationFrame(antsRafId); antsRafId = null; }
        var _dpr = window.devicePixelRatio || 1;
        selCtx.clearRect(0, 0, selCanvas.width / _dpr, selCanvas.height / _dpr);
      }
      _marqueeStartX = x; _marqueeStartY = y;
      _marqueeCurrentX = x; _marqueeCurrentY = y;
    },
    onMove: function(x, y) {
      if (_marqueeStartX === null) return;
      _marqueeCurrentX = x; _marqueeCurrentY = y;
      var r = _marqueeGetSnappedRect(_marqueeStartX, _marqueeStartY, x, y);
      if (r.rw > 0 && r.rh > 0) _marqueeDrawPreview(r.rx, r.ry, r.rw, r.rh);
    },
    onUp: function(x, y, e) {
      if (_marqueeStartX === null) return;
      var r = _marqueeGetSnappedRect(_marqueeStartX, _marqueeStartY, x, y);
      _marqueeStartX = null; _marqueeCurrentX = null;

      if (r.rw === 0 || r.rh === 0) {
        clearSelection();
        return;
      }

      var W = EditorState.width, H = EditorState.height;
      var newMask = new Uint8Array(W * H);
      for (var py = r.ry; py < r.ry + r.rh; py++) {
        for (var px = r.rx; px < r.rx + r.rw; px++) {
          if (px >= 0 && px < W && py >= 0 && py < H) {
            newMask[px + py * W] = 1;
          }
        }
      }

      var finalMask = e.shiftKey
        ? unionMasks(EditorState.selectionMask, newMask, W * H)
        : newMask;
      var bbox = computeBoundingBox(finalMask, W, H);
      if (bbox) setSelection(finalMask, bbox);
    },
    onCursor: function(x, y) {
      cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
    },
  };

  // ── Wand ────────────────────────────────────────────────────────────────
  tools.wand = {
    onDown: function(x, y, e) {
      if (!EditorState.pixels) return;
      var tolerance = EditorState.toolOptions.wandTolerance;
      var contiguous = EditorState.toolOptions.wandContiguous;
      var result = wandSelect(x, y, tolerance, contiguous);
      if (!result) {
        if (!e.shiftKey) clearSelection();
        return;
      }
      var W = EditorState.width, H = EditorState.height;
      if (e.shiftKey) {
        var unified = unionMasks(EditorState.selectionMask, result.mask, W * H);
        var bbox = computeBoundingBox(unified, W, H);
        if (bbox) setSelection(unified, bbox);
      } else {
        setSelection(result.mask, result.bbox);
      }
    },
    onMove: function() {},
    onUp: function() {},
    onCursor: function(x, y) {
      cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
    },
  };

  // ── Move ────────────────────────────────────────────────────────────────
  tools.move = {
    onDown: function(x, y, e) {
      var existingTs = EditorState.transformState;
      if (existingTs) {
        var hitResult = hitTestHandle(e.clientX, e.clientY);
        if (hitResult !== null && hitResult.type === 'scale') {
          var handleIdx = hitResult.handleIdx;
          existingTs._origFloatPixels  = existingTs.floatPixels.slice();
          existingTs._origFloatW       = existingTs.floatW;
          existingTs._origFloatH       = existingTs.floatH;
          existingTs._dragMode         = 'handle-' + handleIdx;
          existingTs._dragStartClientX = e.clientX;
          existingTs._dragStartClientY = e.clientY;
          existingTs._dragStartScaleX  = existingTs.scaleX;
          existingTs._dragStartScaleY  = existingTs.scaleY;
          existingTs._dragStartFloatX  = existingTs.floatX;
          existingTs._dragStartFloatY  = existingTs.floatY;
          var anchorFrac = [
            [1, 1], [0.5, 1], [0, 1], [1, 0.5], [0, 0.5], [1, 0], [0.5, 0], [0, 0],
          ];
          var af = anchorFrac[handleIdx];
          existingTs._dragAnchorX     = existingTs.floatX + af[0] * existingTs.floatW;
          existingTs._dragAnchorY     = existingTs.floatY + af[1] * existingTs.floatH;
          existingTs._dragAnchorFracX = af[0];
          existingTs._dragAnchorFracY = af[1];
          return;
        } else if (hitResult !== null && hitResult.type === 'rotate') {
          var pivCanvasX = Math.round(existingTs.floatX + existingTs.floatW / 2);
          var pivCanvasY = Math.round(existingTs.floatY + existingTs.floatH / 2);
          existingTs._rotatePivot = { x: pivCanvasX, y: pivCanvasY };

          var pixRect = pixelCanvas.getBoundingClientRect();
          var ps = pixRect.width / EditorState.width;
          var centerClientX = pixRect.left + pivCanvasX * ps;
          var centerClientY = pixRect.top  + pivCanvasY * ps;

          existingTs._dragMode         = 'rotate';
          existingTs._rotCenterX       = centerClientX;
          existingTs._rotCenterY       = centerClientY;
          existingTs._rotRefAngle      = Math.atan2(e.clientY - centerClientY, e.clientX - centerClientX);
          existingTs._rotStartAngleDeg = existingTs.angleDeg;
          return;
        }
        existingTs._dragMode         = 'move';
        existingTs._dragStartClientX = e.clientX;
        existingTs._dragStartClientY = e.clientY;
        existingTs._dragStartFloatX  = existingTs.floatX;
        existingTs._dragStartFloatY  = existingTs.floatY;
        return;
      }
      if (!EditorState.selection) return;
      activateTransform();
      if (EditorState.transformState) {
        EditorState.transformState._dragMode         = 'move';
        EditorState.transformState._dragStartClientX = e.clientX;
        EditorState.transformState._dragStartClientY = e.clientY;
        EditorState.transformState._dragStartFloatX  = EditorState.transformState.floatX;
        EditorState.transformState._dragStartFloatY  = EditorState.transformState.floatY;
      }
    },
    onMove: function(x, y, e) {
      var ts = EditorState.transformState;
      if (!ts) return;

      if (ts._dragMode === 'move') {
        var pixRect = pixelCanvas.getBoundingClientRect();
        var ps      = pixRect.width / EditorState.width;
        var dx = Math.round((e.clientX - ts._dragStartClientX) / ps);
        var dy = Math.round((e.clientY - ts._dragStartClientY) / ps);
        ts.floatX = ts._dragStartFloatX + dx;
        ts.floatY = ts._dragStartFloatY + dy;
        _drawTransformUI();
        _updateDistanceLabel();
        return;
      }

      if (ts._dragMode && ts._dragMode.indexOf('handle-') === 0) {
        var handleIdx = parseInt(ts._dragMode.split('-')[1], 10);
        var pixRect2   = pixelCanvas.getBoundingClientRect();
        var ps2        = pixRect2.width / EditorState.width;

        var dxPx = Math.round((e.clientX - ts._dragStartClientX) / ps2);
        var dyPx = Math.round((e.clientY - ts._dragStartClientY) / ps2);

        var origW = ts.origBbox.w;
        var origH = ts.origBbox.h;
        var lockAspect = _scaleLinkActive;

        var newScaleX = ts._dragStartScaleX;
        var newScaleY = ts._dragStartScaleY;

        var corners = [0, 2, 5, 7];
        var yOnlyH  = [1, 6];
        var xOnlyH  = [3, 4];

        if (corners.indexOf(handleIdx) !== -1) {
          var xSign = [2, 4, 7].indexOf(handleIdx) !== -1 ? 1 : -1;
          var ySign = [5, 6, 7].indexOf(handleIdx) !== -1 ? 1 : -1;
          newScaleX = Math.max(0.0625, (origW * ts._dragStartScaleX + dxPx * xSign) / origW);
          newScaleY = Math.max(0.0625, (origH * ts._dragStartScaleY + dyPx * ySign) / origH);
          if (lockAspect) {
            var relX = Math.abs(newScaleX - ts._dragStartScaleX);
            var relY = Math.abs(newScaleY - ts._dragStartScaleY);
            if (relX > relY) newScaleY = newScaleX;
            else             newScaleX = newScaleY;
          }
        } else if (yOnlyH.indexOf(handleIdx) !== -1) {
          var ySign2 = handleIdx === 6 ? 1 : -1;
          newScaleY = Math.max(0.0625, (origH * ts._dragStartScaleY + dyPx * ySign2) / origH);
          if (lockAspect) newScaleX = newScaleY;
        } else if (xOnlyH.indexOf(handleIdx) !== -1) {
          var xSign2 = handleIdx === 4 ? 1 : -1;
          newScaleX = Math.max(0.0625, (origW * ts._dragStartScaleX + dxPx * xSign2) / origW);
          if (lockAspect) newScaleY = newScaleX;
        }

        ts.scaleX = newScaleX;
        ts.scaleY = newScaleY;

        var newW = Math.max(1, Math.round(ts.origBbox.w * ts.scaleX));
        var newH = Math.max(1, Math.round(ts.origBbox.h * ts.scaleY));
        ts.floatPixels = scaleNearestNeighbor(ts._origFloatPixels, ts._origFloatW, ts._origFloatH, newW, newH);
        ts.floatW = newW;
        ts.floatH = newH;
        if (ts._dragAnchorFracX !== undefined) {
          ts.floatX = ts._dragAnchorX - ts._dragAnchorFracX * newW;
          ts.floatY = ts._dragAnchorY - ts._dragAnchorFracY * newH;
        }

        var sxEl = document.getElementById('opt-scale-x');
        var syEl = document.getElementById('opt-scale-y');
        if (sxEl) sxEl.value = Math.round(ts.scaleX * 100);
        if (syEl) syEl.value = Math.round(ts.scaleY * 100);

        _drawTransformUI();
        return;
      }

      if (ts._dragMode === 'rotate') {
        var curAngle = Math.atan2(
          e.clientY - ts._rotCenterY,
          e.clientX - ts._rotCenterX
        );
        var deltaDeg = (curAngle - ts._rotRefAngle) * 180 / Math.PI;
        ts.angleDeg = ts._rotStartAngleDeg + deltaDeg;

        var aEl = document.getElementById('opt-rotate-angle');
        if (aEl) aEl.value = Math.round(ts.angleDeg);

        _applyRotationPreview();
        return;
      }
    },
    onUp: function(x, y, e) {
      var ts = EditorState.transformState;
      if (!ts) return;
      var prevMode = ts._dragMode;
      ts._dragMode = null;

      if (prevMode === 'rotate') {
        _finalizeRotationBbox();
        ts._rotatePivot = { x: Math.round(ts.floatX + ts.floatW / 2), y: Math.round(ts.floatY + ts.floatH / 2) };
      } else if (prevMode === 'move') {
        ts._rotatePivot = { x: Math.round(ts.floatX + ts.floatW / 2), y: Math.round(ts.floatY + ts.floatH / 2) };
      }
      _updateDistanceLabel();
    },
    onCursor: function(x, y, e) {
      if (!EditorState.transformState || !e) return;
      var hit = hitTestHandle(e.clientX, e.clientY);
      if (!hit) {
        cursorCanvas.style.cursor = 'move';
        return;
      }
      if (hit.type === 'rotate') {
        cursorCanvas.style.cursor = 'crosshair';
        return;
      }
      var scaleCursors = [
        'nw-resize', 'n-resize', 'ne-resize',
        'w-resize',              'e-resize',
        'sw-resize', 's-resize', 'se-resize',
      ];
      cursorCanvas.style.cursor = scaleCursors[hit.handleIdx] || 'move';
    },
  };

  // ── Pointer event dispatch on cursorCanvas ─────────────────────────────
  cursorCanvas.addEventListener('pointerdown', function(e) {
    e.preventDefault();
    cursorCanvas.setPointerCapture(e.pointerId);
    if (!EditorState.pixels) return;
    isDrawing = true;
    var coords = viewportToCanvas(e.clientX, e.clientY);
    var cx = coords[0], cy = coords[1];
    var selTool = EditorState.activeTool === 'marquee' || EditorState.activeTool === 'wand';
    if (selTool && EditorState.selectionMask && !EditorState.transformState && isSelectedPixel(cx, cy)) {
      setActiveTool('move');
      if (tools.move) tools.move.onDown(cx, cy, e);
      return;
    }
    if (tools[EditorState.activeTool]) tools[EditorState.activeTool].onDown(cx, cy, e);
  });
  cursorCanvas.addEventListener('pointermove', function(e) {
    if (!EditorState.pixels) return;
    var coords = viewportToCanvas(e.clientX, e.clientY);
    var cx = coords[0], cy = coords[1];
    if (tools[EditorState.activeTool]) tools[EditorState.activeTool].onCursor(cx, cy, e);
    if (isDrawing && tools[EditorState.activeTool]) tools[EditorState.activeTool].onMove(cx, cy, e);
  });
  cursorCanvas.addEventListener('pointerup', function(e) {
    if (!isDrawing) return;
    isDrawing = false;
    var coords = viewportToCanvas(e.clientX, e.clientY);
    if (tools[EditorState.activeTool]) tools[EditorState.activeTool].onUp(coords[0], coords[1], e);
  });
  cursorCanvas.addEventListener('pointercancel', function() { isDrawing = false; });
  cursorCanvas.addEventListener('pointerleave', function() { clearCursorPreview(); });

  // Tool button clicks
  document.querySelectorAll('.tool-btn[data-tool]').forEach(function(btn) {
    btn.addEventListener('click', function() { setActiveTool(btn.dataset.tool); });
  });
  setActiveTool('pencil');

  // Apply/Cancel transform button bindings
  var btnApplyTransform  = document.getElementById('btn-apply-transform');
  var btnCancelTransform = document.getElementById('btn-cancel-transform');
  if (btnApplyTransform)  btnApplyTransform.addEventListener('click', applyTransform);
  if (btnCancelTransform) btnCancelTransform.addEventListener('click', cancelTransform);

  // ── Scale input bindings ───────────────────────────────────────────────
  var scaleXInput  = document.getElementById('opt-scale-x');
  var scaleYInput  = document.getElementById('opt-scale-y');
  var scaleLinkBtn = document.getElementById('btn-scale-link');

  if (scaleLinkBtn) {
    scaleLinkBtn.addEventListener('click', function() {
      _scaleLinkActive = !_scaleLinkActive;
      scaleLinkBtn.style.background    = _scaleLinkActive ? 'var(--accent)' : 'transparent';
      scaleLinkBtn.style.borderColor   = _scaleLinkActive ? 'var(--accent)' : 'var(--border)';
      scaleLinkBtn.style.color         = _scaleLinkActive ? '#fff' : 'var(--text-muted)';
    });
  }

  if (scaleXInput) {
    scaleXInput.addEventListener('input', function() {
      if (_scaleLinkActive && scaleYInput) scaleYInput.value = scaleXInput.value;
      clearTimeout(_scaleInputTimer);
      _scaleInputTimer = setTimeout(_applyScaleFromInputs, 300);
    });
  }
  if (scaleYInput) {
    scaleYInput.addEventListener('input', function() {
      if (_scaleLinkActive && scaleXInput) scaleXInput.value = scaleYInput.value;
      clearTimeout(_scaleInputTimer);
      _scaleInputTimer = setTimeout(_applyScaleFromInputs, 300);
    });
  }

  // ── Angle input binding ────────────────────────────────────────────────
  var rotateAngleInput = document.getElementById('opt-rotate-angle');
  if (rotateAngleInput) {
    rotateAngleInput.addEventListener('input', function() {
      var ts = EditorState.transformState;
      if (!ts) return;
      ts.angleDeg = parseFloat(rotateAngleInput.value) || 0;
      clearTimeout(_rotateInputTimer);
      _rotateInputTimer = setTimeout(_applyRotationPreview, 300);
    });
  }

  // ── Zoom hook: redraw transform UI on zoom ─────────────────────────────
  _onZoomChangedListeners.push(function() {
    if (EditorState.transformState) _drawTransformUI();
  });
  _onZoomChangedListeners.push(function() {
    if (EditorState.activeTool === 'canvas-size' && typeof drawCanvasSizeGuides === 'function') drawCanvasSizeGuides();
  });

  // Wire move-tool hook
  _onMoveToolSelected = function() {
    if (EditorState.selectionMask && !EditorState.transformState) activateTransform();
  };
}
