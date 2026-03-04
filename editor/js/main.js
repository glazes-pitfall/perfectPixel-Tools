// ── DOMContentLoaded: initialization, keyboard shortcuts, UI bindings ────────

document.addEventListener('DOMContentLoaded', function() {
  // Acquire canvas element references
  pixelCanvas  = document.getElementById('pixel-canvas');
  selCanvas    = document.getElementById('selection-canvas');
  cursorCanvas = document.getElementById('cursor-canvas');

  // ── sessionStorage handoff from web_ui.html ────────────────────────────
  var _storedImage    = sessionStorage.getItem('editorImage');
  var _storedFilename = sessionStorage.getItem('editorFilename');
  if (_storedImage) {
    sessionStorage.removeItem('editorImage');
    sessionStorage.removeItem('editorFilename');
    EditorState.filename = _storedFilename || '';
    loadImageFromB64(_storedImage).then(function() {
      pushHistory();
      bindPostLoadEvents();
    });
  } else {
    showDropZone();
  }

  // Initialize history button references and event listeners
  initHistoryButtons();

  // Initialize tool implementations and pointer event dispatch
  initTools();

  // ── Color Picker Panel init ────────────────────────────────────────────
  pickerCanvas = document.getElementById('picker-canvas');
  pickerCtx = pickerCanvas.getContext('2d');
  var hsl = rgbToHsl(EditorState.foregroundColor[0], EditorState.foregroundColor[1], EditorState.foregroundColor[2]);
  currentHue = hsl[0]; currentSat = hsl[1]; currentLit = hsl[2];
  _slCursorX = currentSat / 100;
  _slCursorY = 1 - currentLit / 100;
  redrawPicker();

  function handlePickerDrag(px, py) {
    if (_pickerDragZone === 'ring') {
      var dx = px - PICKER_CX, dy = py - PICKER_CY;
      currentHue = ((Math.atan2(dy, dx) * 180 / Math.PI) + 90 + 360) % 360;
      EditorState.foregroundColor = [hslToRgb(currentHue, currentSat, currentLit)[0], hslToRgb(currentHue, currentSat, currentLit)[1], hslToRgb(currentHue, currentSat, currentLit)[2], 255];
      syncColorUI();
    } else if (_pickerDragZone === 'square') {
      _slCursorX = Math.max(0, Math.min(1, (px - SQ_X) / SQ_W));
      _slCursorY = Math.max(0, Math.min(1, (py - SQ_Y) / SQ_H));
      currentSat = _slCursorX * 100;
      currentLit = (1 - _slCursorY) * 100;
      var rgb = hslToRgb(currentHue, currentSat, currentLit);
      EditorState.foregroundColor = [rgb[0], rgb[1], rgb[2], 255];
      _syncFromDrag = true;
      syncColorUI();
      _syncFromDrag = false;
    }
  }

  pickerCanvas.addEventListener('pointerdown', function(e) {
    e.preventDefault();
    pickerCanvas.setPointerCapture(e.pointerId);
    var rect = pickerCanvas.getBoundingClientRect();
    var px = e.clientX - rect.left, py = e.clientY - rect.top;
    var dx = px - PICKER_CX, dy = py - PICKER_CY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= RING_INNER && dist <= RING_OUTER) {
      _pickerDragZone = 'ring';
    } else if (px >= SQ_X && px <= SQ_X + SQ_W && py >= SQ_Y && py <= SQ_Y + SQ_H) {
      _pickerDragZone = 'square';
    } else {
      _pickerDragZone = null;
    }
    handlePickerDrag(px, py);
  });
  pickerCanvas.addEventListener('pointermove', function(e) {
    if (!_pickerDragZone) return;
    var rect = pickerCanvas.getBoundingClientRect();
    handlePickerDrag(e.clientX - rect.left, e.clientY - rect.top);
  });
  pickerCanvas.addEventListener('pointerup', function() { _pickerDragZone = null; });
  pickerCanvas.addEventListener('pointercancel', function() { _pickerDragZone = null; });

  // ── Multi-panel color picker bindings ──────────────────────────────────

  function applyHexStr(rawHex) {
    var v = rawHex.trim().replace(/^#/, '');
    if (!/^[0-9a-fA-F]{6}$/.test(v)) { syncColorUI(); return; }
    EditorState.foregroundColor = [
      parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16), 255,
    ];
    syncColorUI();
  }

  function bindHexInput(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('keydown', function(e) { if (e.key === 'Enter') applyHexStr(el.value); });
    el.addEventListener('blur', function() { applyHexStr(el.value); });
  }

  function bindRgbGroup(rId, gId, bId) {
    [rId, gId, bId].forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function() {
        var rr = Math.max(0, Math.min(255, parseInt(document.getElementById(rId).value) || 0));
        var gg = Math.max(0, Math.min(255, parseInt(document.getElementById(gId).value) || 0));
        var bb = Math.max(0, Math.min(255, parseInt(document.getElementById(bId).value) || 0));
        EditorState.foregroundColor = [rr, gg, bb, 255];
        syncColorUI();
      });
    });
  }

  function bindCopyBtn(btnId) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', function() {
      var fc = EditorState.foregroundColor;
      var hex = '#' + [fc[0], fc[1], fc[2]].map(function(v) { return v.toString(16).padStart(2, '0'); }).join('');
      navigator.clipboard.writeText(hex).catch(function() {
        var ta = document.createElement('textarea');
        ta.value = hex;
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      });
    });
  }

  bindHexInput('pc-hex'); bindRgbGroup('pc-r', 'pc-g', 'pc-b'); bindCopyBtn('pc-copy');

  // Style C RGB channel drag
  function attachPcChannelDrag(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var startX = 0;
    var startValue = 0;
    var SPEED = 0.5;

    el.addEventListener('pointerdown', function(e) {
      if (e.button !== 0) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startValue = parseInt(el.value, 10) || 0;
    });

    el.addEventListener('pointermove', function(e) {
      if (!el.hasPointerCapture(e.pointerId)) return;
      var dx = e.clientX - startX;
      var next = Math.round(startValue + dx * SPEED);
      next = Math.max(0, Math.min(255, next));
      if (parseInt(el.value, 10) === next) return;
      el.value = next;
      var rr = Math.max(0, Math.min(255, parseInt(document.getElementById('pc-r').value, 10) || 0));
      var gg = Math.max(0, Math.min(255, parseInt(document.getElementById('pc-g').value, 10) || 0));
      var bb = Math.max(0, Math.min(255, parseInt(document.getElementById('pc-b').value, 10) || 0));
      EditorState.foregroundColor = [rr, gg, bb, 255];
      syncColorUI();
    });

    function endDrag(e) {
      if (el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
    }

    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
  }

  ['pc-r', 'pc-g', 'pc-b'].forEach(attachPcChannelDrag);

  syncColorUI();

  var pcHashEl = document.querySelector('.pc-hash');
  if (pcHashEl) {
    pcHashEl.addEventListener('click', function() {
      setActiveTool('eyedropper');
    });
  }

  // ── Tool settings UI bindings ──────────────────────────────────────────

  document.getElementById('opt-brush-size').addEventListener('input', function(e) {
    EditorState.toolOptions.brushSize = Math.max(1, Math.min(32, parseInt(e.target.value) || 1));
  });
  document.getElementById('opt-brush-shape').addEventListener('change', function(e) {
    EditorState.toolOptions.brushShape = e.target.value;
  });
  document.getElementById('opt-pixel-perfect').addEventListener('change', function(e) {
    EditorState.toolOptions.pixelPerfect = e.target.checked;
  });
  document.getElementById('opt-eraser-size').addEventListener('input', function(e) {
    EditorState.toolOptions.brushSize = Math.max(1, Math.min(32, parseInt(e.target.value) || 1));
  });
  document.getElementById('opt-eraser-shape').addEventListener('change', function(e) {
    EditorState.toolOptions.brushShape = e.target.value;
  });
  document.getElementById('opt-eraser-pixel-perfect').addEventListener('change', function(e) {
    EditorState.toolOptions.eraserPixelPerfect = e.target.checked;
  });
  document.getElementById('opt-bucket-tolerance').addEventListener('input', function(e) {
    EditorState.toolOptions.bucketTolerance = Math.max(0, Math.min(255, parseInt(e.target.value) || 0));
  });
  document.getElementById('opt-contiguous').addEventListener('change', function(e) {
    EditorState.toolOptions.contiguous = e.target.checked;
  });

  var optWandTol = document.getElementById('opt-wand-tolerance');
  var optWandCont = document.getElementById('opt-wand-contiguous');
  if (optWandTol) optWandTol.addEventListener('input', function() {
    EditorState.toolOptions.wandTolerance = parseInt(optWandTol.value) || 0;
  });
  if (optWandCont) optWandCont.addEventListener('change', function() {
    EditorState.toolOptions.wandContiguous = optWandCont.checked;
  });

  var btnDeselect = document.getElementById('btn-deselect');
  var btnInverse  = document.getElementById('btn-inverse');
  if (btnDeselect) btnDeselect.addEventListener('click', function() { clearSelection(); });
  if (btnInverse)  btnInverse.addEventListener('click', function() { invertSelection(); });

  // ── Canvas Size bindings ───────────────────────────────────────────────
  initCanvasSizeBindings();

  // ── Download modal bindings ────────────────────────────────────────────
  document.getElementById('btn-download-open').addEventListener('click', openDownloadModal);
  document.getElementById('dl-btn-cancel').addEventListener('click', closeDownloadModal);
  document.getElementById('btn-go-home').addEventListener('click', goHome);
  document.getElementById('dl-btn-download').addEventListener('click', function() {
    var scale = Math.max(1, Math.min(100, parseInt(document.getElementById('dl-scale-num').value) || 1));
    triggerDownload(scale);
  });

  var dlSlider = document.getElementById('dl-scale-slider');
  var dlNum    = document.getElementById('dl-scale-num');
  dlSlider.addEventListener('input', function() { dlNum.value = dlSlider.value; });
  dlNum.addEventListener('input', function() {
    var v = Math.max(1, Math.min(100, parseInt(dlNum.value) || 1));
    dlSlider.value = v;
  });

  document.getElementById('download-modal').addEventListener('click', function(e) {
    if (e.target === document.getElementById('download-modal')) closeDownloadModal();
  });

  // ── Zoom controls ─────────────────────────────────────────────────────
  var canvasArea   = document.getElementById('canvas-area');
  var zoomScrollEl = document.getElementById('zoom-scroll-content');

  // Eyedropper: EyeDropper API on pointer leave
  canvasArea.addEventListener('pointerleave', function() {
    if (EditorState.activeTool === 'eyedropper' && window.EyeDropper && !_eyedropperAborter) {
      _eyedropperAborter = new AbortController();
      new window.EyeDropper().open({ signal: _eyedropperAborter.signal })
        .then(function(result) {
          _eyedropperAborter = null;
          var h = result.sRGBHex.replace('#', '');
          EditorState.foregroundColor = [
            parseInt(h.slice(0, 2), 16),
            parseInt(h.slice(2, 4), 16),
            parseInt(h.slice(4, 6), 16),
            255,
          ];
          syncColorUI();
        })
        .catch(function() { _eyedropperAborter = null; });
    }
  });

  canvasArea.addEventListener('wheel', function(e) {
    e.preventDefault();

    if (e.ctrlKey) {
      var factor = e.deltaY < 0 ? 1.05 : 1 / 1.05;
      applyZoom(EditorState.zoom * factor, e.clientX, e.clientY);
      return;
    }

    var pixelDeltaX = e.deltaMode === 0 ? e.deltaX : e.deltaX * 20;
    var pixelDeltaY = e.deltaMode === 0 ? e.deltaY : e.deltaY * 20;
    zoomScrollEl.scrollLeft += pixelDeltaX;
    zoomScrollEl.scrollTop  += pixelDeltaY;
    clampScroll(zoomScrollEl);
  }, { passive: false });

  zoomScrollEl.addEventListener('scroll', function() {
    if (EditorState.transformState) _drawTransformUI();
  }, { passive: true });

  document.getElementById('btn-zoom-in').addEventListener('click', function() {
    var rect = zoomScrollEl.getBoundingClientRect();
    applyZoom(snapZoomIn(EditorState.zoom), rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
  document.getElementById('btn-zoom-out').addEventListener('click', function() {
    var rect = zoomScrollEl.getBoundingClientRect();
    applyZoom(snapZoomOut(EditorState.zoom), rect.left + rect.width / 2, rect.top + rect.height / 2);
  });

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  document.addEventListener('keydown', function(e) {
    if (e.target.matches('input, textarea')) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      var rect = zoomScrollEl.getBoundingClientRect();
      applyZoom(snapZoomIn(EditorState.zoom), rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === '-') {
      e.preventDefault();
      var rect2 = zoomScrollEl.getBoundingClientRect();
      applyZoom(snapZoomOut(EditorState.zoom), rect2.left + rect2.width / 2, rect2.top + rect2.height / 2);
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      undo();
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
      e.preventDefault();
      redo();
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'd') {
      e.preventDefault();
      if (EditorState.activeTool !== 'move') clearSelection();
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'i') {
      e.preventDefault();
      if (EditorState.activeTool !== 'move') invertSelection();
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.altKey && EditorState.selectionMask) {
      e.preventDefault();
      deleteSelection();
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && e.altKey && EditorState.selectionMask) {
      e.preventDefault();
      fillSelection();
    }
    if (!e.ctrlKey && !e.metaKey) {
      if (e.key === 'b' || e.key === 'B') setActiveTool('pencil');
      if (e.key === 'e' || e.key === 'E') setActiveTool('eraser');
      if (e.key === 'g' || e.key === 'G') setActiveTool('bucket');
      if (e.key === 'i' || e.key === 'I') setActiveTool('eyedropper');
      if (e.key === 'm' || e.key === 'M') setActiveTool('marquee');
      if (e.key === 'w' || e.key === 'W') setActiveTool('wand');
      if (e.key === 'v' || e.key === 'V') {
        if (EditorState.selectionMask || EditorState.transformState) setActiveTool('move');
      }
      if (e.key === 's' || e.key === 'S') {
        if (EditorState.pixels) toggleCanvasSizePanel(true);
      }
    }
    if (e.key === 'Enter' && EditorState.transformState) {
      e.preventDefault();
      applyTransform();
    }
    if (e.key === 'Escape' && EditorState.activeTool === 'canvas-size') {
      cancelCanvasSize(); return;
    }
    if (e.key === 'Escape' && EditorState.activeTool === 'eyedropper') {
      setActiveTool(EditorState._prevTool || 'pencil');
    }
    if (e.key === 'Escape' && EditorState.transformState && EditorState.activeTool !== 'eyedropper') {
      cancelTransform();
    }
    if (e.key === 'Escape' && EditorState.selectionMask && !EditorState.transformState && EditorState.activeTool !== 'eyedropper') {
      var modalOpen = document.getElementById('shortcut-modal');
      if (!modalOpen || modalOpen.style.display !== 'flex') { e.preventDefault(); clearSelection(); }
    }
    if (e.key === 'Escape' && !EditorState.selectionMask && !EditorState.transformState && EditorState.activeTool !== 'eyedropper') {
      var modalOpen2 = document.getElementById('shortcut-modal');
      if (!modalOpen2 || modalOpen2.style.display !== 'flex') { e.preventDefault(); setActiveTool(null); }
    }
  });

  // ── Keyboard shortcut help modal ──────────────────────────────────────
  (function() {
    var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    var mod   = isMac ? '\u2318' : 'Ctrl';
    var alt   = isMac ? '\u2325' : 'Alt';
    var shift = isMac ? '\u21e7' : 'Shift';

    var SECTIONS = [
      {
        title: '\u5de5\u5177',
        rows: [
          { desc: '\u9009\u6846\uff08\u77e9\u5f62\uff09', keys: ['M'], icon: '/icons/Marquee_icon.png' },
          { desc: '\u9b54\u68d2',         keys: ['W'], icon: '/icons/Wand_icon.png' },
          { desc: '\u79fb\u52a8',         keys: ['V'], icon: '/icons/Move_icon.png' },
          { desc: '\u94c5\u7b14',         keys: ['B'], icon: '/icons/Pencil_icon.png' },
          { desc: '\u6cb9\u6f06\u6876',       keys: ['G'], icon: '/icons/Bucket_icon.png' },
          { desc: '\u6a61\u76ae\u64e6',       keys: ['E'], icon: '/icons/Eraser_icon.png' },
          { desc: '\u5438\u7ba1\uff08\u53d6\u8272\uff09', keys: ['I'], icon: '/icons/Eyedropper_icon.png' },
          { desc: '\u53d6\u6d88',         keys: ['Esc'] },
        ],
      },
      {
        title: '\u5386\u53f2',
        rows: [
          { desc: '\u64a4\u9500', keys: [mod, 'Z'] },
          { desc: '\u91cd\u505a', keys: [mod, shift, 'Z'] },
        ],
      },
      {
        title: '\u89c6\u56fe',
        rows: [
          { desc: '\u653e\u5927', keys: [mod, '+'] },
          { desc: '\u7f29\u5c0f', keys: [mod, '\u2212'] },
        ],
      },
      {
        title: '\u9009\u533a',
        rows: [
          { desc: '\u53d6\u6d88\u9009\u533a',         keys: [mod, 'D'] },
          { desc: '\u53cd\u9009',             keys: [mod, shift, 'I'] },
          { desc: '\u5220\u9664\u9009\u533a\u5185\u50cf\u7d20',   keys: ['Delete', '/', 'Backspace'] },
          { desc: '\u7528\u524d\u666f\u8272\u586b\u5145\u9009\u533a', keys: [alt, 'Delete', '/', alt, 'Backspace'] },
        ],
      },
    ];

    function buildShortcutList() {
      var container = document.getElementById('shortcut-list');
      if (!container) return;
      container.innerHTML = '';
      SECTIONS.forEach(function(section) {
        var title = document.createElement('div');
        title.className = 'sc-section-title';
        title.textContent = section.title;
        container.appendChild(title);
        section.rows.forEach(function(row) {
          var rowEl = document.createElement('div');
          rowEl.className = 'sc-row';
          var descEl = document.createElement('span');
          descEl.className = 'sc-desc';
          if (row.icon) {
            var iconEl = document.createElement('img');
            iconEl.src = row.icon;
            iconEl.width = 16; iconEl.height = 16;
            iconEl.style.cssText = 'vertical-align:middle;margin-right:6px;opacity:0.75';
            descEl.appendChild(iconEl);
          }
          descEl.appendChild(document.createTextNode(row.desc));
          var keysEl = document.createElement('span');
          keysEl.className = 'sc-keys';
          row.keys.forEach(function(k) {
            if (k === '/') {
              var sep = document.createElement('span');
              sep.textContent = '/';
              sep.style.cssText = 'color:var(--text-muted);align-self:center;padding:0 2px';
              keysEl.appendChild(sep);
            } else {
              var keyEl = document.createElement('kbd');
              keyEl.className = 'sc-key';
              keyEl.textContent = k;
              keysEl.appendChild(keyEl);
            }
          });
          rowEl.appendChild(descEl);
          rowEl.appendChild(keysEl);
          container.appendChild(rowEl);
        });
      });
    }

    function showHelpModal() {
      buildShortcutList();
      var modal = document.getElementById('shortcut-modal');
      if (modal) { modal.style.display = 'flex'; }
    }
    function closeHelpModal() {
      var modal = document.getElementById('shortcut-modal');
      if (modal) { modal.style.display = 'none'; }
    }

    var helpBtn = document.getElementById('help-btn');
    if (helpBtn) helpBtn.addEventListener('click', showHelpModal);

    var helpCloseBtn = document.getElementById('help-close-btn');
    if (helpCloseBtn) helpCloseBtn.addEventListener('click', closeHelpModal);

    var modal = document.getElementById('shortcut-modal');
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) closeHelpModal();
      });
    }

    document.addEventListener('keydown', function(e) {
      if (e.target.matches('input, textarea')) return;
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        var isOpen = document.getElementById('shortcut-modal');
        if (isOpen && isOpen.style.display === 'flex') closeHelpModal(); else showHelpModal();
      }
      if (e.key === 'Escape') {
        closeHelpModal();
      }
    });
  })();

  // ── Right-panel instant tooltip ────────────────────────────────────────
  (function() {
    var tip     = document.getElementById('tool-tip');
    var tipName = document.getElementById('tool-tip-name');
    var tipDesc = document.getElementById('tool-tip-desc');
    if (!tip) return;

    document.querySelectorAll('.tool-btn[data-tip-zh]').forEach(function(btn) {
      btn.addEventListener('mouseenter', function() {
        var zh   = btn.dataset.tipZh  || '';
        var en   = btn.dataset.tipEn  || '';
        var key  = btn.dataset.tipKey || '';
        var desc = btn.dataset.tipDesc || '';

        tipName.innerHTML =
          zh + ' <span class="tool-tip-en">' + en + '</span>' +
          (key ? ' <span class="tool-tip-key">' + key + '</span>' : '');
        tipDesc.textContent = desc;
        tipDesc.style.display = desc ? '' : 'none';

        tip.style.display = 'block';
        var rect = btn.getBoundingClientRect();
        var tipH = tip.offsetHeight;
        var tipW = tip.offsetWidth;
        tip.style.top  = Math.round(rect.top + rect.height / 2 - tipH / 2) + 'px';
        tip.style.left = Math.round(rect.left - tipW - 8) + 'px';
      });
      btn.addEventListener('mouseleave', function() { tip.style.display = 'none'; });
    });
  })();

  // ── Palette Panel: DOM event bindings ──────────────────────────────────

  var paletteHeader = document.getElementById('paletteHeader');
  var paletteBody   = document.getElementById('paletteBody');
  if (paletteHeader && paletteBody) {
    paletteHeader.addEventListener('click', function() {
      var isOpen = !paletteBody.classList.contains('hidden');
      paletteBody.classList.toggle('hidden', isOpen);
      paletteHeader.classList.toggle('open', !isOpen);
    });
  }

  var nColorsSlider = document.getElementById('nColors');
  var nColorsInput  = document.getElementById('nColorsInput');
  if (nColorsSlider && nColorsInput) {
    nColorsSlider.addEventListener('input', function() { nColorsInput.value = nColorsSlider.value; });
    nColorsInput.addEventListener('input', function() {
      var v = parseInt(nColorsInput.value);
      if (!isNaN(v) && v >= 1) nColorsSlider.value = Math.min(64, Math.max(2, v));
    });
  }

  var minRegPctSlider = document.getElementById('minRegionPct');
  var minRegPctInput  = document.getElementById('minRegionPctInput');
  if (minRegPctSlider && minRegPctInput) {
    minRegPctSlider.addEventListener('input', function() { minRegPctInput.value = parseFloat(minRegPctSlider.value).toFixed(2); });
    minRegPctInput.addEventListener('input', function() {
      var v = parseFloat(minRegPctInput.value);
      if (!isNaN(v) && v >= 0.01) minRegPctSlider.value = Math.min(5, Math.max(0.01, v));
    });
  }

  var genAlgorithmEl = document.getElementById('genAlgorithm');
  var boostParamsEl  = document.getElementById('boostParams');
  if (genAlgorithmEl && boostParamsEl) {
    genAlgorithmEl.addEventListener('change', function() {
      boostParamsEl.style.display = genAlgorithmEl.value === 'boost' ? 'block' : 'none';
    });
  }

  var generateBtn = document.getElementById('generateBtn');
  if (generateBtn) {
    var ALGO_NAMES = { fastoctree: '\u516b\u53c9\u6811', mediancut: '\u4e2d\u503c\u5207\u5272', boost: '\u8986\u76d6\u589e\u5f3a' };
    generateBtn.addEventListener('click', function() {
      var algo = genAlgorithmEl ? genAlgorithmEl.value : 'fastoctree';
      palShowStatus('\u6b63\u5728\u751f\u6210\u8272\u5361\uff08' + (ALGO_NAMES[algo] || algo) + '\uff09...');
      var n = nColorsInput ? (parseInt(nColorsInput.value) || 16) : 16;
      var fd = new FormData();
      fd.append('algorithm', algo);
      fd.append('n_colors', n);
      if (algo === 'boost' && minRegPctInput) {
        fd.append('min_region_pct', minRegPctInput.value || '1.0');
      }
      if (!EditorState.pixels) {
        palShowStatus('\u8bf7\u5148\u52a0\u8f7d\u56fe\u50cf', 'warning'); return;
      }
      var offCanvas = document.createElement('canvas');
      offCanvas.width = EditorState.width; offCanvas.height = EditorState.height;
      var offCtx = offCanvas.getContext('2d');
      var src = EditorState.pixels;
      var filtered = new Uint8ClampedArray(src.length);
      for (var i = 0; i < src.length; i += 4) {
        var a = src[i + 3];
        if (a >= 128) {
          filtered[i]   = src[i];
          filtered[i+1] = src[i+1];
          filtered[i+2] = src[i+2];
          filtered[i+3] = 255;
        } else {
          filtered[i] = filtered[i+1] = filtered[i+2] = filtered[i+3] = 0;
        }
      }
      offCtx.putImageData(new ImageData(filtered, EditorState.width, EditorState.height), 0, 0);
      var b64 = offCanvas.toDataURL('image/png').split(',')[1];
      fd.append('image', b64);
      fetch('/api/generate-palette', { method: 'POST', body: fd })
        .then(function(res) {
          return res.json().then(function(data) {
            if (!res.ok) { palShowStatus('\u751f\u6210\u5931\u8d25\uff1a' + (data.error || ''), 'error'); return; }
            currentPaletteMeta = { name: '', source: 'generate', algorithm: algo, count: data.count };
            setCurrentPalette(data.palette);
            palShowStatus('\u8272\u5361\u5df2\u751f\u6210\uff1a' + data.count + ' \u8272\uff08' + (ALGO_NAMES[algo] || algo) + '\uff09', 'success');
            var paletteNameEl = document.getElementById('paletteName');
            if (paletteNameEl) paletteNameEl.value = '\u672a\u547d\u540d\u8272\u5361';
          });
        })
        .catch(function(err) {
          palShowStatus('\u751f\u6210\u8272\u5361\u5931\u8d25\uff1a' + err.message, 'error');
        });
    });
  }

  var palFileInputEl = document.getElementById('palFileInput');
  if (palFileInputEl) {
    palFileInputEl.addEventListener('change', function() {
      var file = palFileInputEl.files[0];
      if (file) uploadPaletteFile(file);
    });
  }

  var popupColorPickerEl = document.getElementById('popupColorPicker');
  var popupREl = document.getElementById('popupR');
  var popupGEl = document.getElementById('popupG');
  var popupBEl = document.getElementById('popupB');
  var popupHexEl = document.getElementById('popupHex');
  var popupDoneEl = document.getElementById('popupDone');
  var popupDeleteEl = document.getElementById('popupDelete');
  if (popupColorPickerEl) popupColorPickerEl.addEventListener('input', _popupSyncFromPicker);
  if (popupREl) popupREl.addEventListener('input', _popupSyncFromRgb);
  if (popupGEl) popupGEl.addEventListener('input', _popupSyncFromRgb);
  if (popupBEl) popupBEl.addEventListener('input', _popupSyncFromRgb);
  if (popupHexEl) popupHexEl.addEventListener('input', _popupSyncFromHex);
  if (popupDoneEl) popupDoneEl.addEventListener('click', closeColorEditor);
  if (popupDeleteEl) popupDeleteEl.addEventListener('click', function() {
    if (editingSwatchIdx !== null) deleteSwatch(editingSwatchIdx);
  });

  document.addEventListener('click', function(e) {
    var popup = document.getElementById('colorPopup');
    if (popup && !popup.contains(e.target) && !e.target.classList.contains('swatch')) {
      closeColorEditor();
    }
  });

  var palDropBtnEl = document.getElementById('palDropBtn');
  var savedPaletteOptionsEl = document.getElementById('savedPaletteOptions');
  if (palDropBtnEl && savedPaletteOptionsEl) {
    palDropBtnEl.addEventListener('click', function(e) {
      e.stopPropagation();
      refreshSavedDropdown();
      var isOpen = savedPaletteOptionsEl.style.display !== 'none';
      savedPaletteOptionsEl.style.display = isOpen ? 'none' : 'block';
    });
    document.addEventListener('click', function(e) {
      if (!e.target.closest('#savedPaletteOptions') && e.target !== palDropBtnEl)
        savedPaletteOptionsEl.style.display = 'none';
    });
  }

  var savePaletteBtnEl = document.getElementById('savePaletteBtn');
  if (savePaletteBtnEl) {
    savePaletteBtnEl.addEventListener('click', function() {
      var nameEl = document.getElementById('paletteName');
      var name = nameEl ? nameEl.value.trim() : '';
      if (!name) { palShowStatus('\u8bf7\u8f93\u5165\u8272\u5361\u540d\u79f0', 'warning'); return; }
      if (currentPalette.length === 0) { palShowStatus('\u5f53\u524d\u8272\u5361\u4e3a\u7a7a', 'warning'); return; }
      var saved = getSavedPalettes();
      saved[name] = currentPalette;
      setSavedPalettes(saved);
      selectedPaletteKey = name;
      var trigText = document.getElementById('savedPaletteTriggerText');
      if (trigText) trigText.textContent = name + '  (' + currentPalette.length + ' \u8272)';
      refreshSavedDropdown();
      palShowStatus('\u8272\u5361\u300c' + name + '\u300d\u5df2\u4fdd\u5b58', 'success');
    });
  }

  var exportDropBtnEl = document.getElementById('exportDropBtn');
  var exportMenuEl = document.getElementById('exportMenu');
  if (exportDropBtnEl && exportMenuEl) {
    exportDropBtnEl.addEventListener('click', function(e) {
      e.stopPropagation();
      exportMenuEl.style.display = exportMenuEl.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', function() { exportMenuEl.style.display = 'none'; });
  }

  var exportActEl = document.getElementById('exportAct');
  var exportGplEl = document.getElementById('exportGpl');
  var exportPalEl = document.getElementById('exportPal');
  if (exportActEl) exportActEl.addEventListener('click', function() { exportPalette('act'); });
  if (exportGplEl) exportGplEl.addEventListener('click', function() { exportPalette('gpl'); });
  if (exportPalEl) exportPalEl.addEventListener('click', function() { exportPalette('pal'); });

  var applyPaletteBtnEl = document.getElementById('applyPaletteBtn');
  if (applyPaletteBtnEl) {
    applyPaletteBtnEl.addEventListener('click', applyPalette);
  }

  refreshSavedDropdown();
});
