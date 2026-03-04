// ── Color Picker State ────────────────────────────────────────────────────
var pickerCanvas = null, pickerCtx = null;
var currentHue = 0, currentSat = 0, currentLit = 0;
var PICKER_CX = 80, PICKER_CY = 80;
var RING_OUTER = 75, RING_INNER = 55;
var SQ_X = 41, SQ_Y = 41, SQ_W = 78, SQ_H = 78;
var _pickerDragZone = null;
var _slCursorX = 0, _slCursorY = 0;
var _syncFromDrag = false;

function drawHueRing(ctx) {
  var grad = ctx.createConicGradient(-Math.PI / 2, PICKER_CX, PICKER_CY);
  var stops = [
    [0, '#ff0000'], [1/6, '#ffff00'], [2/6, '#00ff00'],
    [3/6, '#00ffff'], [4/6, '#0000ff'], [5/6, '#ff00ff'], [1, '#ff0000']
  ];
  stops.forEach(function(s) { grad.addColorStop(s[0], s[1]); });
  ctx.beginPath();
  ctx.arc(PICKER_CX, PICKER_CY, RING_OUTER, 0, 2 * Math.PI);
  ctx.arc(PICKER_CX, PICKER_CY, RING_INNER, 0, 2 * Math.PI, true);
  ctx.fillStyle = grad;
  ctx.fill('evenodd');
}

function drawSLSquare(ctx) {
  var satGrad = ctx.createLinearGradient(SQ_X, SQ_Y, SQ_X + SQ_W, SQ_Y);
  satGrad.addColorStop(0, 'hsl(' + currentHue + ', 0%, 50%)');
  satGrad.addColorStop(1, 'hsl(' + currentHue + ', 100%, 50%)');
  ctx.fillStyle = satGrad;
  ctx.fillRect(SQ_X, SQ_Y, SQ_W, SQ_H);
  var litGrad = ctx.createLinearGradient(SQ_X, SQ_Y, SQ_X, SQ_Y + SQ_H);
  litGrad.addColorStop(0, 'rgba(255,255,255,1)');
  litGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
  litGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
  litGrad.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = litGrad;
  ctx.fillRect(SQ_X, SQ_Y, SQ_W, SQ_H);
}

function drawPickerIndicators(ctx) {
  var ringR = (RING_OUTER + RING_INNER) / 2;
  var hueRad = (currentHue - 90) * Math.PI / 180;
  var rx = PICKER_CX + ringR * Math.cos(hueRad);
  var ry = PICKER_CY + ringR * Math.sin(hueRad);
  ctx.beginPath();
  ctx.arc(rx, ry, 5, 0, 2 * Math.PI);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();

  var sx = SQ_X + _slCursorX * SQ_W;
  var sy = SQ_Y + _slCursorY * SQ_H;
  ctx.beginPath();
  ctx.arc(sx, sy, 5, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function redrawPicker() {
  if (!pickerCtx) return;
  pickerCtx.clearRect(0, 0, 160, 160);
  drawHueRing(pickerCtx);
  drawSLSquare(pickerCtx);
  drawPickerIndicators(pickerCtx);
}

// ── syncColorUI — updates all panel styles ───────────────────────────────
var _syncLock = false;
function syncColorUI() {
  if (_syncLock) return;
  _syncLock = true;
  var fc = EditorState.foregroundColor;
  var r = fc[0], g = fc[1], b = fc[2];
  var hex   = '#' + [r, g, b].map(function(v) { return v.toString(16).padStart(2, '0'); }).join('');
  var hexNH = hex.slice(1);
  var rgb   = 'rgb(' + r + ',' + g + ',' + b + ')';

  var pcH = document.getElementById('pc-hex');
  if (pcH) {
    pcH.value = hexNH;
    pcH.style.borderColor = rgb;
    pcH.style.background = 'rgba(' + r + ',' + g + ',' + b + ',0.15)';
  }
  var pcR = document.getElementById('pc-r');      if (pcR) pcR.value = r;
  var pcG = document.getElementById('pc-g');      if (pcG) pcG.value = g;
  var pcB = document.getElementById('pc-b');      if (pcB) pcB.value = b;
  var brR = document.getElementById('pc-bar-r');  if (brR) brR.style.width = (r / 255 * 100).toFixed(1) + '%';
  var brG = document.getElementById('pc-bar-g');  if (brG) brG.style.width = (g / 255 * 100).toFixed(1) + '%';
  var brB = document.getElementById('pc-bar-b');  if (brB) brB.style.width = (b / 255 * 100).toFixed(1) + '%';
  var pcHash = document.querySelector('.pc-hash');
  if (pcHash) pcHash.style.background = rgb;
  var pcCopy = document.getElementById('pc-copy');
  if (pcCopy) pcCopy.style.borderColor = rgb;

  var hsl = rgbToHsl(r, g, b);
  currentLit = hsl[2];
  if (!_syncFromDrag) {
    if (hsl[2] > 0 && hsl[2] < 100) {
      currentHue = hsl[0];
      currentSat = hsl[1];
      _slCursorX = currentSat / 100;
    }
    _slCursorY = 1 - currentLit / 100;
  }
  redrawPicker();
  _syncLock = false;
  highlightMatchingSwatches();
}

// ── PAL-02: Highlight matching swatches ───────────────────────────────────
function highlightMatchingSwatches() {
  if (!EditorState.pixels) return;
  var fc = EditorState.foregroundColor;
  var fr = fc[0], fg = fc[1], fb = fc[2];
  document.querySelectorAll('#swatchesGrid .swatch').forEach(function(sw, idx) {
    if (idx >= currentPalette.length) return;
    var c = currentPalette[idx];
    if (c[0] === fr && c[1] === fg && c[2] === fb) {
      sw.style.boxShadow = '0 0 0 2px #fff, 0 0 8px 4px rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
      sw.style.zIndex = '3';
    } else {
      sw.style.boxShadow = '';
      sw.style.zIndex = '';
    }
  });
}

// ── getEditorImageB64: export current pixels as base64 PNG ───────────────
function getEditorImageB64() {
  if (!EditorState.pixels || !EditorState.width || !EditorState.height) return null;
  var off = document.createElement('canvas');
  off.width = EditorState.width;
  off.height = EditorState.height;
  var octx = off.getContext('2d');
  octx.putImageData(
    new ImageData(EditorState.pixels.slice(), EditorState.width, EditorState.height),
    0, 0
  );
  return off.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
}

// ── Palette Panel: showStatus helper ────────────────────────────────────
function palShowStatus(msg, type) {
  console.info('[palette]', type || 'info', msg);
}

// ── Palette Panel: core functions ───────────────────────────────────────

function setCurrentPalette(palette) {
  currentPalette = palette.map(function(c) {
    return [
      Math.max(0, Math.min(255, Math.round(c[0]))),
      Math.max(0, Math.min(255, Math.round(c[1]))),
      Math.max(0, Math.min(255, Math.round(c[2]))),
    ];
  });
  EditorState.palette = currentPalette.slice();
  renderSwatches();
  var applyBtn = document.getElementById('applyPaletteBtn');
  if (applyBtn) {
    applyBtn.disabled = !EditorState.pixels || currentPalette.length === 0;
  }
}

function renderSwatches() {
  var grid = document.getElementById('swatchesGrid');
  var countEl = document.getElementById('swatchCount');
  if (!grid) return;
  if (countEl) countEl.textContent = currentPalette.length + ' \u8272';
  if (currentPalette.length === 0) {
    grid.innerHTML = '<span class="swatches-empty">\u8272\u5361\u4E3A\u7A7A</span>';
    if (typeof highlightMatchingSwatches === 'function') highlightMatchingSwatches();
    return;
  }
  grid.innerHTML = '';
  currentPalette.forEach(function(color, idx) {
    var r = color[0], g = color[1], b = color[2];
    var hex = rgbToHex(r, g, b);
    var sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = '#' + hex;
    sw.title = '#' + hex;
    var del = document.createElement('button');
    del.className = 'del-btn'; del.textContent = '\u00d7';
    del.onclick = function(e) { e.stopPropagation(); deleteSwatch(idx); };
    sw.appendChild(del);
    sw.addEventListener('click', function() {
      var c = currentPalette[idx];
      EditorState.foregroundColor = [c[0], c[1], c[2], 255];
      syncColorUI();
    });
    sw.addEventListener('dblclick', function(e) { e.stopPropagation(); openColorEditor(idx, sw); });
    grid.appendChild(sw);
  });
  var addSwEl = document.createElement('div');
  addSwEl.className = 'add-swatch';
  addSwEl.title = '\u6DFB\u52A0\u5F53\u524D\u524D\u666F\u8272\u5230\u8272\u5361';
  addSwEl.textContent = '+';
  addSwEl.addEventListener('click', function() {
    var fc = EditorState.foregroundColor;
    currentPalette.push([fc[0], fc[1], fc[2]]);
    EditorState.palette = currentPalette.slice();
    renderSwatches();
  });
  grid.appendChild(addSwEl);
  if (typeof highlightMatchingSwatches === 'function') highlightMatchingSwatches();
}

function deleteSwatch(idx) {
  currentPalette.splice(idx, 1);
  EditorState.palette = currentPalette.slice();
  closeColorEditor();
  renderSwatches();
}

// ── Color editor popup ────────────────────────────────────────────────────
var _popupSyncLock = false;

function openColorEditor(idx, anchorEl) {
  editingSwatchIdx = idx;
  var c = currentPalette[idx];
  var r = c[0], g = c[1], b = c[2];
  var hex = rgbToHex(r, g, b);
  var popupColorPicker = document.getElementById('popupColorPicker');
  var popupR = document.getElementById('popupR');
  var popupG = document.getElementById('popupG');
  var popupB = document.getElementById('popupB');
  var popupHex = document.getElementById('popupHex');
  if (popupColorPicker) popupColorPicker.value = '#' + hex;
  if (popupR) popupR.value = r;
  if (popupG) popupG.value = g;
  if (popupB) popupB.value = b;
  if (popupHex) popupHex.value = hex;
  var popup = document.getElementById('colorPopup');
  if (!popup) return;
  var rect = anchorEl.getBoundingClientRect();
  var top = rect.bottom + 6, left = rect.left;
  if (left + 210 > window.innerWidth) left = window.innerWidth - 215;
  if (top + 220 > window.innerHeight) top = rect.top - 226;
  popup.style.top = top + 'px'; popup.style.left = left + 'px';
  popup.style.display = 'flex';
}

function closeColorEditor() {
  var popup = document.getElementById('colorPopup');
  if (popup) popup.style.display = 'none';
  editingSwatchIdx = null;
}

function _popupSyncFromRgb() {
  if (_popupSyncLock) return; _popupSyncLock = true;
  var r = Math.max(0, Math.min(255, parseInt(document.getElementById('popupR').value) || 0));
  var g = Math.max(0, Math.min(255, parseInt(document.getElementById('popupG').value) || 0));
  var b = Math.max(0, Math.min(255, parseInt(document.getElementById('popupB').value) || 0));
  var hex = rgbToHex(r, g, b);
  var pp = document.getElementById('popupColorPicker');
  var ph = document.getElementById('popupHex');
  if (pp) pp.value = '#' + hex;
  if (ph) ph.value = hex;
  if (editingSwatchIdx !== null) { currentPalette[editingSwatchIdx] = [r, g, b]; EditorState.palette = currentPalette.slice(); renderSwatches(); }
  _popupSyncLock = false;
}

function _popupSyncFromHex() {
  if (_popupSyncLock) return;
  var ph = document.getElementById('popupHex');
  if (!ph) return;
  var hex = ph.value.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return;
  _popupSyncLock = true;
  var rgb = hexToRgb(hex);
  var pp = document.getElementById('popupColorPicker');
  var pR = document.getElementById('popupR');
  var pG = document.getElementById('popupG');
  var pB = document.getElementById('popupB');
  if (pR) pR.value = rgb[0]; if (pG) pG.value = rgb[1]; if (pB) pB.value = rgb[2];
  if (pp) pp.value = '#' + hex.toUpperCase();
  if (editingSwatchIdx !== null) { currentPalette[editingSwatchIdx] = [rgb[0], rgb[1], rgb[2]]; EditorState.palette = currentPalette.slice(); renderSwatches(); }
  _popupSyncLock = false;
}

function _popupSyncFromPicker() {
  if (_popupSyncLock) return;
  var pp = document.getElementById('popupColorPicker');
  if (!pp) return;
  var hex = pp.value.replace('#', '');
  _popupSyncLock = true;
  var rgb = hexToRgb(hex);
  var pR = document.getElementById('popupR');
  var pG = document.getElementById('popupG');
  var pB = document.getElementById('popupB');
  var ph = document.getElementById('popupHex');
  if (pR) pR.value = rgb[0]; if (pG) pG.value = rgb[1]; if (pB) pB.value = rgb[2];
  if (ph) ph.value = hex.toUpperCase();
  if (editingSwatchIdx !== null) { currentPalette[editingSwatchIdx] = [rgb[0], rgb[1], rgb[2]]; EditorState.palette = currentPalette.slice(); renderSwatches(); }
  _popupSyncLock = false;
}

// ── Save / load palettes (localStorage) ──────────────────────────────────
var PAL_LS_KEY = 'pp_saved_palettes';
function getSavedPalettes() { try { return JSON.parse(localStorage.getItem(PAL_LS_KEY) || '{}'); } catch(e) { return {}; } }
function setSavedPalettes(obj) { localStorage.setItem(PAL_LS_KEY, JSON.stringify(obj)); }

function refreshSavedDropdown() {
  var saved = getSavedPalettes();
  var keys  = Object.keys(saved);
  var opts  = document.getElementById('savedPaletteOptions');
  if (!opts) return;
  opts.innerHTML = '';

  if (keys.length === 0) {
    opts.innerHTML = '<div class="custom-option-empty">\u6682\u65E0\u5DF2\u4FDD\u5B58\u7684\u8272\u5361</div>';
    var uploadOptEmptyEl = document.createElement('div');
    uploadOptEmptyEl.className = 'custom-option';
    uploadOptEmptyEl.style.borderTop = '1px solid var(--border)';
    uploadOptEmptyEl.innerHTML = '<span style="font-size:12px; color:var(--text-muted);">\uD83D\uDCC1 \u4ECE\u672C\u5730\u4E0A\u4F20</span>';
    uploadOptEmptyEl.addEventListener('click', function() {
      opts.style.display = 'none';
      var palFileInputEl = document.getElementById('palFileInput');
      if (palFileInputEl) palFileInputEl.click();
    });
    opts.appendChild(uploadOptEmptyEl);
    return;
  }

  keys.forEach(function(name) {
    var palette = saved[name];
    var div = document.createElement('div');
    div.className = 'custom-option' + (name === selectedPaletteKey ? ' selected' : '');
    div.dataset.key = name;

    var nameEl = document.createElement('div');
    nameEl.className = 'option-name';
    nameEl.textContent = name + '  (' + palette.length + ' \u8272)';

    var swatchesEl = document.createElement('div');
    swatchesEl.className = 'option-swatches';
    palette.slice(0, 20).forEach(function(c) {
      var s = document.createElement('span');
      s.style.background = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
      swatchesEl.appendChild(s);
    });

    div.appendChild(nameEl);
    div.appendChild(swatchesEl);
    div.addEventListener('click', function() {
      selectedPaletteKey = name;
      var paletteNameInputEl = document.getElementById('paletteName');
      if (paletteNameInputEl) paletteNameInputEl.value = name;
      setCurrentPalette(palette);
      var savedPaletteOptionsEl = document.getElementById('savedPaletteOptions');
      if (savedPaletteOptionsEl) savedPaletteOptionsEl.style.display = 'none';
      palShowStatus('\u5DF2\u52A0\u8F7D\u8272\u5361\u300C' + name + '\u300D\uFF1A' + palette.length + ' \u8272', 'success');
    });
    var delBtn = document.createElement('button');
    delBtn.className = 'pal-del-btn';
    delBtn.textContent = '\u2715';
    delBtn.title = '\u5220\u9664\u6B64\u8272\u5361';
    delBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var palettes = getSavedPalettes();
      delete palettes[name];
      setSavedPalettes(palettes);
      if (selectedPaletteKey === name) selectedPaletteKey = null;
      refreshSavedDropdown();
    });
    div.appendChild(delBtn);
    opts.appendChild(div);
  });

  var uploadOptEl = document.createElement('div');
  uploadOptEl.className = 'custom-option';
  uploadOptEl.style.borderTop = '1px solid var(--border)';
  uploadOptEl.innerHTML = '<span style="font-size:12px; color:var(--text-muted);">\uD83D\uDCC1 \u4ECE\u672C\u5730\u4E0A\u4F20</span>';
  uploadOptEl.addEventListener('click', function() {
    var savedPaletteOptionsEl = document.getElementById('savedPaletteOptions');
    if (savedPaletteOptionsEl) savedPaletteOptionsEl.style.display = 'none';
    var palFileInputEl = document.getElementById('palFileInput');
    if (palFileInputEl) palFileInputEl.click();
  });
  opts.appendChild(uploadOptEl);
}

// ── Palette file upload ────────────────────────────────────────────────────
async function uploadPaletteFile(file) {
  palShowStatus('\u89E3\u6790\u8272\u5361\u6587\u4EF6...');
  var fd = new FormData();
  fd.append('file', file);
  try {
    var res = await fetch('/api/parse-palette', { method: 'POST', body: fd });
    var data = await res.json();
    if (!res.ok) { palShowStatus('\u89E3\u6790\u5931\u8D25\uFF1A' + (data.error || ''), 'error'); return; }
    currentPaletteMeta = { name: data.name, source: 'upload', algorithm: '', count: data.palette.length };
    setCurrentPalette(data.palette);
    var palFilenameEl = document.getElementById('palFilename');
    if (palFilenameEl) palFilenameEl.textContent = file.name;
    var paletteNameEl = document.getElementById('paletteName');
    if (data.name && paletteNameEl) paletteNameEl.value = data.name;
    palShowStatus('\u5DF2\u52A0\u8F7D\u8272\u5361\u300C' + data.name + '\u300D\uFF1A' + data.palette.length + ' \u8272', 'success');
  } catch (err) {
    palShowStatus('\u4E0A\u4F20\u5931\u8D25\uFF1A' + err.message, 'error');
  }
}

// ── Palette export ─────────────────────────────────────────────────────────
async function exportPalette(fmt) {
  if (currentPalette.length === 0) { palShowStatus('\u8272\u5361\u4E3A\u7A7A\uFF0C\u65E0\u6CD5\u5BFC\u51FA', 'warning'); return; }
  var fd = new FormData();
  fd.append('palette', JSON.stringify(currentPalette));
  fd.append('format', fmt);
  var nameEl = document.getElementById('paletteName');
  fd.append('name', (nameEl ? nameEl.value.trim() : '') || 'Custom Palette');
  try {
    var res = await fetch('/api/export-palette', { method: 'POST', body: fd });
    if (!res.ok) { palShowStatus('\u5BFC\u51FA\u5931\u8D25', 'error'); return; }
    var blob = await res.blob();
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var nm = nameEl ? nameEl.value.trim() : 'palette';
    a.href = url; a.download = (nm || 'palette') + '.' + fmt;
    a.click(); URL.revokeObjectURL(url);
    palShowStatus('\u5DF2\u5BFC\u51FA .' + fmt + ' \u6587\u4EF6', 'success');
  } catch (err) { palShowStatus('\u5BFC\u51FA\u5931\u8D25\uFF1A' + err.message, 'error'); }
}

// ── PAL-04: nearest palette color matching ────────────────────────────────
function nearestPaletteColor(r, g, b, palette) {
  var bestIdx = 0, bestDist = Infinity;
  for (var i = 0; i < palette.length; i++) {
    var dr = r - palette[i][0], dg = g - palette[i][1], db = b - palette[i][2];
    var dist = dr*dr + dg*dg + db*db;
    if (dist < bestDist) { bestDist = dist; bestIdx = i; }
  }
  return palette[bestIdx];
}

// ── PAL-LAB: sRGB -> CIE LAB ─────────────────────────────────────────────
function rgbToLab(r, g, b) {
  var R = r / 255, G = g / 255, B = b / 255;
  R = R > 0.04045 ? Math.pow((R + 0.055) / 1.055, 2.4) : R / 12.92;
  G = G > 0.04045 ? Math.pow((G + 0.055) / 1.055, 2.4) : G / 12.92;
  B = B > 0.04045 ? Math.pow((B + 0.055) / 1.055, 2.4) : B / 12.92;
  var X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  var Y = (R * 0.2126729 + G * 0.7151522 + B * 0.0721750) / 1.00000;
  var Z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / 1.08883;
  var f = function(t) { return t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116); };
  var L = 116 * f(Y) - 16;
  var A = 500 * (f(X) - f(Y));
  var Bv = 200 * (f(Y) - f(Z));
  return [L, A, Bv];
}

function nearestPaletteColorLab(r, g, b, palette) {
  var lab1 = rgbToLab(r, g, b);
  var bestIdx = 0, bestDist = Infinity;
  for (var i = 0; i < palette.length; i++) {
    var lab2 = rgbToLab(palette[i][0], palette[i][1], palette[i][2]);
    var dL = lab1[0] - lab2[0], dA = lab1[1] - lab2[1], dB = lab1[2] - lab2[2];
    var dist = dL*dL + dA*dA + dB*dB;
    if (dist < bestDist) { bestDist = dist; bestIdx = i; }
  }
  return palette[bestIdx];
}

// ── PAL-04: apply palette — three modes ────────────────────────────────
async function applyPalette() {
  if (!EditorState.pixels || currentPalette.length === 0) return;
  var modeEl = document.getElementById('mappingModeSelect');
  var mode = modeEl ? modeEl.value : 'vector';
  var px = EditorState.pixels;
  var pal = currentPalette;

  if (mode === 'vector') {
    for (var i = 0; i < px.length; i += 4) {
      if (px[i + 3] <= 127) {
        px[i] = 0; px[i+1] = 0; px[i+2] = 0; px[i+3] = 0;
      } else {
        var nc = nearestPaletteColor(px[i], px[i+1], px[i+2], pal);
        px[i] = nc[0]; px[i+1] = nc[1]; px[i+2] = nc[2]; px[i+3] = 255;
      }
    }
    flushPixels();
    pushHistory();
    palShowStatus('\u8272\u5361\u5DF2\u5E94\u7528\uFF08\u5411\u91CF\u5339\u914D\uFF09', 'success');

  } else if (mode === 'perceptual') {
    for (var j = 0; j < px.length; j += 4) {
      if (px[j + 3] <= 127) {
        px[j] = 0; px[j+1] = 0; px[j+2] = 0; px[j+3] = 0;
      } else {
        var nc2 = nearestPaletteColorLab(px[j], px[j+1], px[j+2], pal);
        px[j] = nc2[0]; px[j+1] = nc2[1]; px[j+2] = nc2[2]; px[j+3] = 255;
      }
    }
    flushPixels();
    pushHistory();
    palShowStatus('\u8272\u5361\u5DF2\u5E94\u7528\uFF08\u611F\u77E5\u5339\u914D\uFF09', 'success');

  } else {
    palShowStatus('\u6B63\u5728\u5904\u7406\uFF08\u8272\u5361\u66FF\u6362\uFF09\u2026', 'info');
    try {
      var offscreen = document.createElement('canvas');
      offscreen.width = EditorState.width;
      offscreen.height = EditorState.height;
      var offCtx = offscreen.getContext('2d', { alpha: true });
      offCtx.putImageData(new ImageData(px.slice(), EditorState.width, EditorState.height), 0, 0);
      var imageB64 = offscreen.toDataURL('image/png').split(',')[1];

      var origAlpha = new Uint8Array(EditorState.width * EditorState.height);
      for (var k = 0; k < px.length; k += 4) {
        origAlpha[k >> 2] = px[k + 3];
      }

      var fd = new FormData();
      fd.append('image', imageB64);
      fd.append('palette', JSON.stringify(pal));
      fd.append('mode', 'swap');
      var resp = await fetch('/api/apply-palette', { method: 'POST', body: fd });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var data = await resp.json();
      if (data.error) throw new Error(data.error);

      var img = new Image();
      await new Promise(function(resolve, reject) {
        img.onload = resolve; img.onerror = reject;
        img.src = 'data:image/png;base64,' + data.output;
      });
      var resultCanvas = document.createElement('canvas');
      resultCanvas.width = EditorState.width;
      resultCanvas.height = EditorState.height;
      var rCtx = resultCanvas.getContext('2d', { willReadFrequently: true });
      rCtx.drawImage(img, 0, 0);
      var resultData = rCtx.getImageData(0, 0, EditorState.width, EditorState.height).data;

      for (var m = 0; m < px.length; m += 4) {
        var a = origAlpha[m >> 2];
        if (a <= 127) {
          px[m] = 0; px[m+1] = 0; px[m+2] = 0; px[m+3] = 0;
        } else {
          px[m] = resultData[m]; px[m+1] = resultData[m+1]; px[m+2] = resultData[m+2]; px[m+3] = 255;
        }
      }
      flushPixels();
      pushHistory();
      palShowStatus('\u8272\u5361\u5DF2\u5E94\u7528\uFF08\u8272\u5361\u66FF\u6362\uFF09', 'success');
    } catch (err) {
      palShowStatus('\u8272\u5361\u66FF\u6362\u5931\u8D25\uFF1A' + err.message, 'error');
    }
  }
}

// ── Download ──────────────────────────────────────────────────────────────
var _lastBlobUrl = null;

function triggerDownload(scale) {
  if (!EditorState.pixels || !EditorState.width) return;
  var newW = EditorState.width  * scale;
  var newH = EditorState.height * scale;

  var src = document.createElement('canvas');
  src.width = EditorState.width; src.height = EditorState.height;
  src.getContext('2d').putImageData(
    new ImageData(EditorState.pixels.slice(), EditorState.width, EditorState.height), 0, 0
  );

  var off = document.createElement('canvas');
  off.width = newW; off.height = newH;
  var dctx = off.getContext('2d');
  dctx.imageSmoothingEnabled = false;
  dctx.drawImage(src, 0, 0, newW, newH);

  off.toBlob(function(blob) {
    if (_lastBlobUrl) { URL.revokeObjectURL(_lastBlobUrl); _lastBlobUrl = null; }
    var blobUrl = URL.createObjectURL(blob);
    _lastBlobUrl = blobUrl;

    var previewImg = document.getElementById('dl-preview-img');
    previewImg.src = blobUrl;
    previewImg.style.width  = '';
    previewImg.style.height = '';
    document.getElementById('dl-size-info').textContent = newW + ' \u00d7 ' + newH + ' px';
    document.getElementById('dl-preview').style.display = 'block';

    var baseName = (EditorState.filename || '').replace(/\.[^.]+$/, '') || 'output';
    var filename = baseName + '_pixelated_' + scale + 'x.png';
    var a = document.createElement('a');
    a.href = blobUrl; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }, 'image/png');
}

function goHome() {
  if (EditorState.pixels) {
    if (!confirm('\u5C06\u4E22\u5931\u5F53\u524D\u8FDB\u5EA6\uFF0C\u662F\u5426\u7EE7\u7EED\uFF1F')) return;
  }
  window.location.href = '/';
}

function openDownloadModal() {
  document.getElementById('dl-preview').style.display = 'none';
  document.getElementById('dl-scale-slider').value = 1;
  document.getElementById('dl-scale-num').value = 1;
  var modal = document.getElementById('download-modal');
  modal.style.display = 'flex';
}

function closeDownloadModal() {
  document.getElementById('download-modal').style.display = 'none';
  if (_lastBlobUrl) { URL.revokeObjectURL(_lastBlobUrl); _lastBlobUrl = null; }
}
