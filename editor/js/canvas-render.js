// ── Canvas Initialization & Rendering ─────────────────────────────────────

/**
 * Create and initialize the 3-canvas stack inside #zoom-container.
 */
function initCanvases(width, height) {
  EditorState.width  = width;
  EditorState.height = height;

  pixelCanvas.width  = width;
  pixelCanvas.height = height;
  pixelCanvas.style.width  = width  + 'px';
  pixelCanvas.style.height = height + 'px';
  pixelCtx = pixelCanvas.getContext('2d', { willReadFrequently: true, alpha: true });

  var dpr = window.devicePixelRatio || 1;

  var canvasAreaEl = document.getElementById('canvas-area');
  var caW = canvasAreaEl.clientWidth;
  var caH = canvasAreaEl.clientHeight;
  selCanvas.width  = caW * dpr;
  selCanvas.height = caH * dpr;
  selCanvas.style.width  = caW + 'px';
  selCanvas.style.height = caH + 'px';
  selCtx = selCanvas.getContext('2d');
  selCtx.scale(dpr, dpr);

  cursorCanvas.width  = width  * dpr;
  cursorCanvas.height = height * dpr;
  cursorCanvas.style.width  = width  + 'px';
  cursorCanvas.style.height = height + 'px';
  cursorCtx = cursorCanvas.getContext('2d');
  cursorCtx.scale(dpr, dpr);

  var zc = document.getElementById('zoom-container');
  zc.style.width  = width  + 'px';
  zc.style.height = height + 'px';
  centerCanvas();
}

/**
 * Write EditorState.pixels to pixel-canvas via putImageData.
 */
function flushPixels() {
  pixelCtx.putImageData(
    new ImageData(EditorState.pixels, EditorState.width, EditorState.height),
    0, 0
  );
}

/**
 * Convert browser pointer coordinates to canvas pixel coordinates.
 */
function viewportToCanvas(clientX, clientY) {
  var rect = cursorCanvas.getBoundingClientRect();
  var scaleX = EditorState.width  / rect.width;
  var scaleY = EditorState.height / rect.height;
  return [
    Math.max(0, Math.min(EditorState.width  - 1, Math.floor((clientX - rect.left) * scaleX))),
    Math.max(0, Math.min(EditorState.height - 1, Math.floor((clientY - rect.top)  * scaleY))),
  ];
}

/**
 * Read a pixel from EditorState.pixels (never from canvas element).
 */
function getPixel(x, y) {
  var i = (y * EditorState.width + x) * 4;
  return [
    EditorState.pixels[i],
    EditorState.pixels[i + 1],
    EditorState.pixels[i + 2],
    EditorState.pixels[i + 3],
  ];
}

/**
 * Write a pixel to EditorState.pixels. Does NOT call flushPixels().
 */
function setPixel(x, y, rgba) {
  var i = (y * EditorState.width + x) * 4;
  EditorState.pixels[i]     = rgba[0];
  EditorState.pixels[i + 1] = rgba[1];
  EditorState.pixels[i + 2] = rgba[2];
  EditorState.pixels[i + 3] = rgba[3];
}

// ── Zoom/Pan ─────────────────────────────────────────────────────────────

var PAD = 2000;

function clampScroll(area) {
  var zoom = EditorState.zoom;
  var W = EditorState.width  * zoom;
  var H = EditorState.height * zoom;
  var minVisible = 100;
  var minX = PAD - area.clientWidth  + Math.min(W, minVisible);
  var maxX = PAD + W - Math.min(W, minVisible);
  var minY = PAD - area.clientHeight + Math.min(H, minVisible);
  var maxY = PAD + H - Math.min(H, minVisible);
  area.scrollLeft = Math.max(minX, Math.min(maxX, area.scrollLeft));
  area.scrollTop  = Math.max(minY, Math.min(maxY, area.scrollTop));
}

function centerCanvas() {
  var area = document.getElementById('zoom-scroll-content');
  var sc   = document.getElementById('zoom-scroll-inner');
  var zoom = EditorState.zoom;
  var W = EditorState.width  * zoom;
  var H = EditorState.height * zoom;
  sc.style.width  = (2 * PAD + W) + 'px';
  sc.style.height = (2 * PAD + H) + 'px';
  var zc = document.getElementById('zoom-container');
  zc.style.left = PAD + 'px';
  zc.style.top  = PAD + 'px';
  document.getElementById('zoom-container').style.transform = 'scale(' + zoom + ')';
  var display = Number.isInteger(zoom) ? zoom + 'x' : zoom.toFixed(1) + 'x';
  document.getElementById('zoom-display').textContent = display;
  area.scrollLeft = PAD + W / 2 - area.clientWidth  / 2;
  area.scrollTop  = PAD + H / 2 - area.clientHeight / 2;
  clampScroll(area);
}

var SNAP_LEVELS = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64];
function snapZoomIn(current) {
  return SNAP_LEVELS.find(function(l) { return l > current + 0.01; }) || SNAP_LEVELS[SNAP_LEVELS.length - 1];
}
function snapZoomOut(current) {
  var rev = SNAP_LEVELS.slice().reverse();
  return rev.find(function(l) { return l < current - 0.01; }) || SNAP_LEVELS[0];
}

function applyZoom(newZoom, pivotClientX, pivotClientY) {
  var oldZoom = EditorState.zoom;
  newZoom = Math.max(0.25, Math.min(64, newZoom));
  var area = document.getElementById('zoom-scroll-content');
  var sc   = document.getElementById('zoom-scroll-inner');
  var newW = EditorState.width  * newZoom;
  var newH = EditorState.height * newZoom;
  sc.style.width  = (2 * PAD + newW) + 'px';
  sc.style.height = (2 * PAD + newH) + 'px';
  var areaRect = area.getBoundingClientRect();
  var pxInArea = pivotClientX - areaRect.left;
  var pyInArea = pivotClientY - areaRect.top;
  var px = area.scrollLeft + pxInArea;
  var py = area.scrollTop  + pyInArea;
  area.scrollLeft = (px - PAD) * (newZoom / oldZoom) + PAD - pxInArea;
  area.scrollTop  = (py - PAD) * (newZoom / oldZoom) + PAD - pyInArea;
  EditorState.zoom = newZoom;
  document.getElementById('zoom-container').style.transform = 'scale(' + newZoom + ')';
  clampScroll(area);
  var display = Number.isInteger(newZoom) ? newZoom + 'x' : newZoom.toFixed(1) + 'x';
  document.getElementById('zoom-display').textContent = display;
  _onZoomChangedListeners.forEach(function(fn) { fn(); });
}

// ── Brush helpers ─────────────────────────────────────────────────────────

function getBrushStamp(size, shape) {
  if (size === 1) return [[0, 0]];
  var offsets = [];
  if (shape === 'round') {
    var r = (size - 1) / 2;
    for (var dy = -Math.ceil(r); dy <= Math.ceil(r); dy++)
      for (var dx = -Math.ceil(r); dx <= Math.ceil(r); dx++)
        if (Math.sqrt(dx * dx + dy * dy) <= r) offsets.push([dx, dy]);
  } else {
    var half = Math.floor(size / 2);
    for (var dy2 = -half; dy2 <= half; dy2++)
      for (var dx2 = -half; dx2 <= half; dx2++)
        offsets.push([dx2, dy2]);
  }
  return offsets;
}

function applyStamp(cx, cy, stamp, color) {
  for (var k = 0; k < stamp.length; k++) {
    var dx = stamp[k][0], dy = stamp[k][1];
    var x = cx + dx, y = cy + dy;
    if (x >= 0 && x < EditorState.width && y >= 0 && y < EditorState.height) {
      if (isSelectedPixel(x, y)) setPixel(x, y, color);
    }
  }
  flushPixels();
}

function bresenhamLine(x0, y0, x1, y1) {
  var pts = [];
  var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  var err = dx - dy;
  while (true) {
    pts.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    var e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 <  dx) { err += dx; y0 += sy; }
  }
  return pts;
}

function drawCursorPreview(cx, cy, color) {
  cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
  if (!EditorState.pixels) return;
  var stamp = getBrushStamp(EditorState.toolOptions.brushSize, EditorState.toolOptions.brushShape);
  var r = color[0], g = color[1], b = color[2], a = color[3];
  for (var k = 0; k < stamp.length; k++) {
    cursorCtx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (a / 255) + ')';
    cursorCtx.fillRect(cx + stamp[k][0], cy + stamp[k][1], 1, 1);
  }
}

function clearCursorPreview() {
  if (cursorCtx) cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
}

var _ppHistory = [];

function resetPixelPerfect() { _ppHistory = []; }

function shouldSkipPixelPerfect(cx, cy) {
  if (_ppHistory.length < 2) { _ppHistory.push([cx, cy]); return false; }
  var p2 = _ppHistory[0], p1 = _ppHistory[1];
  var sharesAxisWithP2 = (p1[0] === p2[0] || p1[1] === p2[1]);
  var sharesAxisWithCur = (p1[0] === cx || p1[1] === cy);
  var curDiffersFromP2  = (p2[0] !== cx && p2[1] !== cy);
  var skip = sharesAxisWithP2 && sharesAxisWithCur && curDiffersFromP2;
  if (!skip) { _ppHistory = [p1, [cx, cy]]; }
  return skip;
}

// ── Flood fill ────────────────────────────────────────────────────────────

function floodFill(startX, startY, fillColor, tolerance, contiguous) {
  var target = getPixel(startX, startY);
  if (target[3] === 0 && fillColor[3] === 0) return;

  function matches(px, py) {
    var c = getPixel(px, py);
    if (target[3] === 0 && c[3] === 0) return true;
    if (target[3] === 0 || c[3] === 0) return false;
    return Math.abs(c[0] - target[0]) <= tolerance &&
           Math.abs(c[1] - target[1]) <= tolerance &&
           Math.abs(c[2] - target[2]) <= tolerance &&
           Math.abs(c[3] - target[3]) <= tolerance;
  }

  if (contiguous) {
    var visited = new Uint8Array(EditorState.width * EditorState.height);
    var startIdx = startX + startY * EditorState.width;
    visited[startIdx] = 1;
    var stack = [startIdx];
    while (stack.length) {
      var idx = stack.pop();
      var px = idx % EditorState.width;
      var py = (idx / EditorState.width) | 0;
      if (isSelectedPixel(px, py)) setPixel(px, py, fillColor);
      var neighbors = [[px-1,py],[px+1,py],[px,py-1],[px,py+1]];
      for (var k = 0; k < neighbors.length; k++) {
        var nx = neighbors[k][0], ny = neighbors[k][1];
        if (nx < 0 || nx >= EditorState.width || ny < 0 || ny >= EditorState.height) continue;
        var ni = nx + ny * EditorState.width;
        if (!visited[ni] && matches(nx, ny)) {
          visited[ni] = 1;
          stack.push(ni);
        }
      }
    }
  } else {
    for (var y = 0; y < EditorState.height; y++)
      for (var x = 0; x < EditorState.width; x++)
        if (matches(x, y) && isSelectedPixel(x, y)) setPixel(x, y, fillColor);
  }
  flushPixels();
}

function wandSelect(startX, startY, tolerance, contiguous) {
  var W = EditorState.width, H = EditorState.height;
  var mask = new Uint8Array(W * H);
  var target = getPixel(startX, startY);

  function matches(px, py) {
    var c = getPixel(px, py);
    if (target[3] === 0 && c[3] === 0) return true;
    if (target[3] === 0 || c[3] === 0) return false;
    return Math.abs(c[0] - target[0]) <= tolerance &&
           Math.abs(c[1] - target[1]) <= tolerance &&
           Math.abs(c[2] - target[2]) <= tolerance &&
           Math.abs(c[3] - target[3]) <= tolerance;
  }

  if (contiguous) {
    var startIdx = startX + startY * W;
    mask[startIdx] = 1;
    var stack = [startIdx];
    while (stack.length) {
      var idx = stack.pop();
      var px = idx % W, py = (idx / W) | 0;
      var neighbors = [[px-1,py],[px+1,py],[px,py-1],[px,py+1]];
      for (var k = 0; k < neighbors.length; k++) {
        var nx = neighbors[k][0], ny = neighbors[k][1];
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        var ni = nx + ny * W;
        if (!mask[ni] && matches(nx, ny)) {
          mask[ni] = 1;
          stack.push(ni);
        }
      }
    }
  } else {
    for (var y = 0; y < H; y++)
      for (var x = 0; x < W; x++)
        if (matches(x, y)) mask[x + y * W] = 1;
  }

  var bbox = computeBoundingBox(mask, W, H);
  if (!bbox) return null;
  return { mask: mask, bbox: bbox };
}

// ── Image loading ─────────────────────────────────────────────────────────

async function loadImageFromB64(b64OrDataUrl) {
  var src = b64OrDataUrl.startsWith('data:')
    ? b64OrDataUrl
    : 'data:image/png;base64,' + b64OrDataUrl;
  await new Promise(function(resolve, reject) {
    var img = new Image();
    img.onload = function() {
      var width = img.naturalWidth, height = img.naturalHeight;
      initCanvases(width, height);
      pixelCtx.drawImage(img, 0, 0);
      var imageData = pixelCtx.getImageData(0, 0, width, height);
      EditorState.pixels = imageData.data.slice();
      clearSelection();
      flushPixels();
      resolve();
    };
    img.onerror = function() { reject(new Error('Image decode failed')); };
    img.src = src;
  });
}

function showDropZone() {
  var canvasArea = document.getElementById('canvas-area');
  var zone = document.createElement('div');
  zone.id = 'drop-zone';
  zone.style.cssText = 'position:absolute;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;cursor:pointer;background:var(--surface);';
  zone.innerHTML = '<div style="font-size:48px;">\uD83D\uDDBC\uFE0F</div><div style="font-size:16px;color:var(--text-muted);">\u70B9\u51FB\u6216\u62D6\u62FD\u56FE\u7247\u5230\u6B64\u5904</div><div style="font-size:12px;color:var(--text-muted);">\u652F\u6301 PNG / JPG / WEBP \u7B49\u683C\u5F0F</div>';
  canvasArea.appendChild(zone);

  var fileInput = document.createElement('input');
  fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.style.display = 'none';
  canvasArea.appendChild(fileInput);

  zone.addEventListener('click', function() { fileInput.click(); });
  fileInput.addEventListener('change', function() {
    if (fileInput.files[0]) handleFileUpload(fileInput.files[0]);
  });
  zone.addEventListener('dragover', function(e) { e.preventDefault(); zone.style.background = 'rgba(124,106,247,.08)'; });
  zone.addEventListener('dragleave', function() { zone.style.background = 'var(--surface)'; });
  zone.addEventListener('drop', function(e) {
    e.preventDefault();
    var f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) handleFileUpload(f);
  });
}

async function handleFileUpload(file) {
  EditorState.filename = file.name;
  var reader = new FileReader();
  reader.onload = async function(e) {
    var dropZone = document.getElementById('drop-zone');
    if (dropZone) dropZone.remove();
    await loadImageFromB64(e.target.result);
    pushHistory();
    bindPostLoadEvents();
  };
  reader.readAsDataURL(file);
}

var _postLoadEventsBound = false;
function bindPostLoadEvents() {
  if (_postLoadEventsBound) return;
  _postLoadEventsBound = true;
  cursorCanvas.addEventListener('pointermove', function(e) {
    if (!EditorState.pixels) return;
    var coords = viewportToCanvas(e.clientX, e.clientY);
    var cx = coords[0], cy = coords[1];
    var c = getPixel(cx, cy);
    document.getElementById('insp-x').textContent = cx;
    document.getElementById('insp-y').textContent = cy;
    document.getElementById('insp-r').textContent = c[0];
    document.getElementById('insp-g').textContent = c[1];
    document.getElementById('insp-b').textContent = c[2];
    document.getElementById('insp-a').textContent = c[3];
    document.getElementById('insp-swatch').style.background =
      'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (c[3] / 255) + ')';
  });
  cursorCanvas.addEventListener('pointerleave', function() {
    ['insp-x','insp-y','insp-r','insp-g','insp-b','insp-a'].forEach(function(id) {
      document.getElementById(id).textContent = '\u2014';
    });
    document.getElementById('insp-swatch').style.background = 'transparent';
  });
}
