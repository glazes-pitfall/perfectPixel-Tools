// ── Selection state ───────────────────────────────────────────────────────
var antsRafId = null;

function snapToGrid(v, gridSize) {
  if (gridSize <= 1) return v;
  return Math.round(v / gridSize) * gridSize;
}

function updateSelectionUI() {
  var hasSelection = !!EditorState.selectionMask;
  var isMoveActive = EditorState.activeTool === 'move';
  var btnDeselect = document.getElementById('btn-deselect');
  var btnInverse  = document.getElementById('btn-inverse');
  if (btnDeselect) btnDeselect.style.display = (hasSelection && !isMoveActive) ? '' : 'none';
  if (btnInverse)  btnInverse.style.display  = (hasSelection && !isMoveActive) ? '' : 'none';
  var btnMove = document.querySelector('.tool-btn[data-tool="move"]');
  if (btnMove) btnMove.disabled = !(hasSelection || !!EditorState.transformState);
}

function clearSelection() {
  EditorState.selectionMask = null;
  EditorState.selection = null;
  if (antsRafId) { cancelAnimationFrame(antsRafId); antsRafId = null; }
  if (selCtx) {
    var dpr = window.devicePixelRatio || 1;
    selCtx.clearRect(0, 0, selCanvas.width / dpr, selCanvas.height / dpr);
  }
  updateSelectionUI();
}

function computeBoundingBox(mask, W, H) {
  var minX = W, minY = H, maxX = -1, maxY = -1;
  for (var y = 0; y < H; y++) {
    for (var x = 0; x < W; x++) {
      if (mask[x + y * W]) {
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX === -1) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function setSelection(mask, bbox) {
  EditorState.selectionMask = mask;
  EditorState.selection = bbox;
  updateSelectionUI();
  scheduleAnts();
}

function isSelectedPixel(x, y) {
  if (!EditorState.selectionMask) return true;
  var bb = EditorState.selection;
  if (!bb || x < bb.x || x >= bb.x + bb.w || y < bb.y || y >= bb.y + bb.h) return false;
  return EditorState.selectionMask[x + y * EditorState.width] === 1;
}

function unionMasks(existingMask, newMask, totalPixels) {
  if (!existingMask) return newMask;
  var result = new Uint8Array(totalPixels);
  for (var i = 0; i < totalPixels; i++)
    result[i] = existingMask[i] | newMask[i];
  return result;
}

function invertSelection() {
  var W = EditorState.width, H = EditorState.height;
  var total = W * H;
  if (!EditorState.selectionMask) {
    var allMask = new Uint8Array(total).fill(1);
    setSelection(allMask, { x: 0, y: 0, w: W, h: H });
  } else {
    var newMask = new Uint8Array(total);
    for (var i = 0; i < total; i++) newMask[i] = EditorState.selectionMask[i] ? 0 : 1;
    var bbox = computeBoundingBox(newMask, W, H);
    if (bbox) {
      setSelection(newMask, bbox);
    } else {
      clearSelection();
    }
  }
}

function deleteSelection() {
  if (!EditorState.selectionMask) return;
  pushHistory();
  var W = EditorState.width;
  for (var i = 0; i < EditorState.selectionMask.length; i++) {
    if (EditorState.selectionMask[i]) {
      var x = i % W, y = (i / W) | 0;
      setPixel(x, y, [0, 0, 0, 0]);
    }
  }
  flushPixels();
}

function fillSelection() {
  if (!EditorState.selectionMask) return;
  pushHistory();
  var W = EditorState.width;
  var color = [EditorState.foregroundColor[0], EditorState.foregroundColor[1], EditorState.foregroundColor[2], EditorState.foregroundColor[3]];
  color[3] = 255;
  for (var i = 0; i < EditorState.selectionMask.length; i++) {
    if (EditorState.selectionMask[i]) {
      var x = i % W, y = (i / W) | 0;
      setPixel(x, y, color);
    }
  }
  flushPixels();
}

function drawAnts() {
  if (!EditorState.selection) { antsRafId = null; return; }

  var dpr = window.devicePixelRatio || 1;
  selCtx.clearRect(0, 0, selCanvas.width / dpr, selCanvas.height / dpr);
  selCtx.globalCompositeOperation = 'source-over';
  selCtx.setLineDash([]);

  var caRect  = document.getElementById('canvas-area').getBoundingClientRect();
  var pixRect = pixelCanvas.getBoundingClientRect();
  var originX = pixRect.left - caRect.left;
  var originY = pixRect.top  - caRect.top;
  var ps = pixRect.width / EditorState.width;

  var bright = Math.floor(Date.now() / 500) % 2 === 0;
  selCtx.strokeStyle = bright ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.15)';
  selCtx.lineWidth = 2;
  var off = 1;

  var mask = EditorState.selectionMask;
  var bx = EditorState.selection.x, by = EditorState.selection.y;
  var bw = EditorState.selection.w, bh = EditorState.selection.h;

  if (mask) {
    var W = EditorState.width, H = EditorState.height;
    var path = new Path2D();

    for (var py = by; py < by + bh; py++) {
      for (var px = bx; px < bx + bw; px++) {
        if (!mask[px + py * W]) continue;

        var sx = originX + px * ps;
        var sy = originY + py * ps;

        if (py === 0 || !mask[px + (py - 1) * W]) {
          path.moveTo(sx - off, sy - off);
          path.lineTo(sx + ps + off, sy - off);
        }
        if (py === H - 1 || !mask[px + (py + 1) * W]) {
          path.moveTo(sx - off, sy + ps + off);
          path.lineTo(sx + ps + off, sy + ps + off);
        }
        if (px === 0 || !mask[(px - 1) + py * W]) {
          path.moveTo(sx - off, sy - off);
          path.lineTo(sx - off, sy + ps + off);
        }
        if (px === W - 1 || !mask[(px + 1) + py * W]) {
          path.moveTo(sx + ps + off, sy - off);
          path.lineTo(sx + ps + off, sy + ps + off);
        }
      }
    }
    selCtx.stroke(path);
  } else {
    selCtx.strokeRect(
      originX + bx * ps - off,
      originY + by * ps - off,
      bw * ps + off * 2,
      bh * ps + off * 2
    );
  }

  antsRafId = requestAnimationFrame(drawAnts);
}

function scheduleAnts() {
  if (antsRafId) { cancelAnimationFrame(antsRafId); antsRafId = null; }
  antsRafId = requestAnimationFrame(drawAnts);
}
