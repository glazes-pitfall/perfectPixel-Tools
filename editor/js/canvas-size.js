// ── Canvas Size Tool ────────────────────────────────────────────────────────

// Baseline dimensions when canvas-size panel was last opened (for Restore)
var _cfgBaseW = 0, _cfgBaseH = 0;

function _getCanvasSizeParams() {
  var L  = parseInt(document.getElementById('cfg-left').value)   || 0;
  var R  = parseInt(document.getElementById('cfg-right').value)  || EditorState.width;
  var T  = parseInt(document.getElementById('cfg-top').value)    || 0;
  var B  = parseInt(document.getElementById('cfg-bottom').value) || EditorState.height;
  var newW = Math.max(1, R - L);
  var newH = Math.max(1, B - T);
  var offsetL = -L;
  var offsetT = -T;
  return { newW: newW, newH: newH, offsetL: offsetL, offsetT: offsetT, L: L, R: R, T: T, B: B };
}

function drawCanvasSizeGuides() {
  if (EditorState.activeTool !== 'canvas-size') return;
  var dpr = window.devicePixelRatio || 1;
  selCtx.clearRect(0, 0, selCanvas.width / dpr, selCanvas.height / dpr);

  if (!EditorState.pixels) return;

  var params = _getCanvasSizeParams();
  var L = params.L, R = params.R, T = params.T, B = params.B;

  var pixRect = pixelCanvas.getBoundingClientRect();
  var caRect  = document.getElementById('canvas-area').getBoundingClientRect();
  var originX = pixRect.left - caRect.left;
  var originY = pixRect.top  - caRect.top;
  var ps      = pixRect.width / EditorState.width;

  var left   = originX + L * ps;
  var right  = originX + R * ps;
  var top    = originY + T * ps;
  var bottom = originY + B * ps;

  var oldRight  = originX + EditorState.width  * ps;
  var oldBottom = originY + EditorState.height * ps;
  var caW = selCanvas.width / dpr;
  var caH = selCanvas.height / dpr;

  // Expansion area blue overlay
  selCtx.save();
  selCtx.fillStyle = 'rgba(100,140,220,0.15)';
  if (L < 0) selCtx.fillRect(left, top, originX - left, bottom - top);
  if (R > EditorState.width)  selCtx.fillRect(oldRight, top, right - oldRight, bottom - top);
  if (T < 0) selCtx.fillRect(left, top, right - left, originY - top);
  if (B > EditorState.height) selCtx.fillRect(left, oldBottom, right - left, bottom - oldBottom);
  selCtx.restore();

  // Purple solid reference lines
  selCtx.save();
  selCtx.strokeStyle = '#7c6af7';
  selCtx.lineWidth = 1;
  selCtx.setLineDash([]);
  selCtx.beginPath(); selCtx.moveTo(left,  0); selCtx.lineTo(left,  caH); selCtx.stroke();
  selCtx.beginPath(); selCtx.moveTo(right,  0); selCtx.lineTo(right,  caH); selCtx.stroke();
  selCtx.beginPath(); selCtx.moveTo(0, top);   selCtx.lineTo(caW, top);   selCtx.stroke();
  selCtx.beginPath(); selCtx.moveTo(0, bottom); selCtx.lineTo(caW, bottom); selCtx.stroke();
  selCtx.restore();
}

function applyCanvasSize() {
  if (!EditorState.pixels) return;
  var p = _getCanvasSizeParams();
  var oldPixels = EditorState.pixels;
  var oldW = EditorState.width;
  var oldH = EditorState.height;

  var newPixels = new Uint8ClampedArray(p.newW * p.newH * 4);

  var srcX0 = Math.max(0, -p.offsetL);
  var srcY0 = Math.max(0, -p.offsetT);
  var dstX0 = Math.max(0, p.offsetL);
  var dstY0 = Math.max(0, p.offsetT);
  var copyW = Math.min(oldW - srcX0, p.newW - dstX0);
  var copyH = Math.min(oldH - srcY0, p.newH - dstY0);

  if (copyW > 0 && copyH > 0) {
    for (var row = 0; row < copyH; row++) {
      var srcOff = ((srcY0 + row) * oldW + srcX0) * 4;
      var dstOff = ((dstY0 + row) * p.newW + dstX0) * 4;
      newPixels.set(oldPixels.subarray(srcOff, srcOff + copyW * 4), dstOff);
    }
  }

  EditorState.pixels = newPixels;
  clearSelection();
  initCanvases(p.newW, p.newH);
  flushPixels();
  pushHistory();
  setActiveTool('pencil');
  _closeCanvasSizePanel();
}

function _closeCanvasSizePanel() {
  var body = document.getElementById('canvasSizeBody');
  var header = document.getElementById('canvasSizeHeader');
  if (body) body.classList.add('hidden');
  if (header) header.classList.remove('open');
}

function cancelCanvasSize() {
  var dpr = window.devicePixelRatio || 1;
  selCtx.clearRect(0, 0, selCanvas.width / dpr, selCanvas.height / dpr);
  setActiveTool('pencil');
  _closeCanvasSizePanel();
}

function toggleCanvasSizePanel(forceOpen) {
  var body = document.getElementById('canvasSizeBody');
  var header = document.getElementById('canvasSizeHeader');
  var isOpen = !body.classList.contains('hidden');
  var shouldOpen = forceOpen !== undefined ? forceOpen : !isOpen;
  if (shouldOpen === isOpen) return;
  if (shouldOpen) {
    body.classList.remove('hidden');
    header.classList.add('open');
    if (EditorState.pixels) {
      _cfgBaseW = EditorState.width;
      _cfgBaseH = EditorState.height;
      setActiveTool('canvas-size');
    }
  } else {
    _closeCanvasSizePanel();
    if (EditorState.activeTool === 'canvas-size') {
      var dpr = window.devicePixelRatio || 1;
      selCtx.clearRect(0, 0, selCanvas.width / dpr, selCanvas.height / dpr);
      setActiveTool('pencil');
    }
  }
}

function makeScrubber(input) {
  var scrubStart = null, hasMoved = false;
  input.addEventListener('pointerdown', function(e) {
    scrubStart = { x: e.clientX, val: parseFloat(input.value) || 0 };
    hasMoved = false;
    input.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  input.addEventListener('pointermove', function(e) {
    if (!scrubStart) return;
    var delta = Math.round((e.clientX - scrubStart.x) / 2);
    if (Math.abs(delta) >= 1) {
      hasMoved = true;
      input.value = scrubStart.val + delta;
      input.dispatchEvent(new Event('input'));
    }
  });
  input.addEventListener('pointerup', function() {
    if (!scrubStart) return;
    var moved = hasMoved;
    scrubStart = null;
    if (!moved) {
      input.style.cursor = 'text';
      input.focus();
      input.select();
    }
  });
  input.addEventListener('pointercancel', function() { scrubStart = null; });
  input.addEventListener('blur', function() { input.style.cursor = 'ew-resize'; });
}

function _syncFromLR() {
  var L = parseInt(document.getElementById('cfg-left').value)  || 0;
  var R = parseInt(document.getElementById('cfg-right').value) || 0;
  document.getElementById('cfg-width').value = Math.max(1, R - L);
  drawCanvasSizeGuides();
}
function _syncFromTB() {
  var T = parseInt(document.getElementById('cfg-top').value)    || 0;
  var B = parseInt(document.getElementById('cfg-bottom').value) || 0;
  document.getElementById('cfg-height').value = Math.max(1, B - T);
  drawCanvasSizeGuides();
}
function _syncFromW() {
  var L = parseInt(document.getElementById('cfg-left').value)  || 0;
  var W = parseInt(document.getElementById('cfg-width').value) || 1;
  document.getElementById('cfg-right').value = L + Math.max(1, W);
  drawCanvasSizeGuides();
}
function _syncFromH() {
  var T = parseInt(document.getElementById('cfg-top').value)    || 0;
  var H = parseInt(document.getElementById('cfg-height').value) || 1;
  document.getElementById('cfg-bottom').value = T + Math.max(1, H);
  drawCanvasSizeGuides();
}

function initCanvasSizeBindings() {
  // Attach scrubbers
  ['cfg-width','cfg-height','cfg-left','cfg-right','cfg-top','cfg-bottom'].forEach(function(id) {
    makeScrubber(document.getElementById(id));
  });

  // Auto-sync
  document.getElementById('cfg-left').addEventListener('input', _syncFromLR);
  document.getElementById('cfg-right').addEventListener('input', _syncFromLR);
  document.getElementById('cfg-top').addEventListener('input', _syncFromTB);
  document.getElementById('cfg-bottom').addEventListener('input', _syncFromTB);
  document.getElementById('cfg-width').addEventListener('input', _syncFromW);
  document.getElementById('cfg-height').addEventListener('input', _syncFromH);

  document.getElementById('canvasSizeHeader').addEventListener('click', function() { toggleCanvasSizePanel(); });
  document.getElementById('btn-cfg-apply').addEventListener('click', function() {
    applyCanvasSize();
    _cfgBaseW = EditorState.width;
    _cfgBaseH = EditorState.height;
  });
  document.getElementById('btn-cfg-restore').addEventListener('click', function() {
    document.getElementById('cfg-left').value   = 0;
    document.getElementById('cfg-right').value  = _cfgBaseW;
    document.getElementById('cfg-top').value    = 0;
    document.getElementById('cfg-bottom').value = _cfgBaseH;
    document.getElementById('cfg-width').value  = _cfgBaseW;
    document.getElementById('cfg-height').value = _cfgBaseH;
    drawCanvasSizeGuides();
  });

  // Reference lines follow canvas scroll
  document.getElementById('zoom-scroll-content').addEventListener('scroll', function() {
    if (EditorState.activeTool === 'canvas-size') drawCanvasSizeGuides();
  }, { passive: true });
}
