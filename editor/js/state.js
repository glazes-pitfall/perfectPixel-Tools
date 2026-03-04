// ── EditorState — Single Source of Truth ─────────────────────────────
// Source: CLAUDE.md "EditorState" section / RESEARCH.md Pattern 4
var EditorState = {
  width: 0, height: 0,
  pixels: null,               // Uint8ClampedArray, RGBA, length = w*h*4
  gridW: 0, gridH: 0,         // pixel art grid cell size (from Ver 1.1)
  zoom: 4, panX: 0, panY: 0,
  activeTool: 'pencil',       // 'pencil'|'eraser'|'bucket'|'wand'|'marquee'|'move'
  foregroundColor: [0, 0, 0, 255],
  toolOptions: {
    brushSize: 1, brushShape: 'round',
    pixelPerfect: false,
    eraserPixelPerfect: false,
    bucketTolerance: 15, wandTolerance: 15,
    contiguous: true,
    wandContiguous: true,
  },
  selection: null,            // null | {x, y, w, h} in canvas pixels
  selectionMask: null,        // Uint8Array, length = width*height; 1=selected, 0=not
  selectionPixels: null,      // Uint8ClampedArray for move/transform
  transformState: null,
  history: [],                // Uint8ClampedArray snapshots
  historyIndex: -1,
  MAX_HISTORY: 100,
  palette: [],                // [[r,g,b], ...] — same format as web_ui.html
  filename: '',               // original filename for download naming

  // Minimal pub/sub (no library needed)
  _listeners: {},
  on: function(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  },
  emit: function(event, data) {
    (this._listeners[event] || []).forEach(function(fn) { fn(data); });
  },
};

// ── Palette Panel State ───────────────────────────────────────────────────
var currentPalette     = [];   // [[r,g,b], ...]
var editingSwatchIdx   = null;
var selectedPaletteKey = '';
var currentPaletteMeta = { name: '', source: 'upload', algorithm: '', count: 0 };

// ── Canvas context refs (set by initCanvases, used by all tools) ─────────
var pixelCanvas = null;
var selCanvas = null;
var cursorCanvas = null;
var pixelCtx = null;
var selCtx = null;
var cursorCtx = null;

// ── Eyedropper: AbortController for open EyeDropper API session ──────────
var _eyedropperAborter = null;

// Hook: called by setActiveTool (outer scope) to activate transform when switching to
// Move tool. activateTransform is defined inside DOMContentLoaded so it needs bridging.
var _onMoveToolSelected = null;

// B2 fix: hook set by DOMContentLoaded to redraw transform overlay on zoom change.
// Multicast array replaces single _onZoomChanged reference.
var _onZoomChangedListeners = [];

// ── Tool activation ───────────────────────────────────────────────────────
function setActiveTool(name) {
  // If leaving move tool with active transform, cancel it (Plan 06-03)
  // cancelTransform is defined inside DOMContentLoaded; guard with typeof check
  if (EditorState.activeTool === 'move' && name !== 'move' && EditorState.transformState) {
    if (typeof cancelTransform === 'function') cancelTransform();
  }
  // Eyedropper: canvas picks use getPixel(EditorState.pixels); off-canvas
  // auto-triggers EyeDropper API after cursor leaves canvas for 300 ms.
  if (name === 'eyedropper' && EditorState.activeTool !== 'eyedropper') {
    EditorState._prevTool = EditorState.activeTool;
    document.body.classList.add('eyedropper-active');
  } else if (name !== 'eyedropper' && EditorState.activeTool === 'eyedropper') {
    document.body.classList.remove('eyedropper-active');
    // Abort any open EyeDropper API session
    if (_eyedropperAborter) { _eyedropperAborter.abort(); _eyedropperAborter = null; }
  }

  EditorState.activeTool = name;
  document.querySelectorAll('.tool-btn[data-tool]').forEach(function(btn) {
    btn.classList.toggle('tool-btn-active', btn.dataset.tool === name);
  });
  // Auto-activate transform when switching to move tool (hook bridges outer->inner scope)
  if (name === 'move' && _onMoveToolSelected) _onMoveToolSelected();
  updateSelectionUI();
  // Show/hide tool settings panels
  var panelIds = ['tool-settings-pencil', 'tool-settings-eraser', 'tool-settings-bucket',
                    'tool-settings-marquee', 'tool-settings-wand', 'tool-settings-move'];
  panelIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  var activePanel = document.getElementById('tool-settings-' + name);
  if (activePanel) activePanel.style.display = 'flex';
  // canvas-size: initialize inputs and draw guides
  if (name === 'canvas-size') {
    var W = EditorState.width  || 0;
    var H = EditorState.height || 0;
    var set = function(id) { return function(v) { var el = document.getElementById(id); if (el) el.value = v; }; };
    set('cfg-left')(0);   set('cfg-right')(W);
    set('cfg-top')(0);    set('cfg-bottom')(H);
    set('cfg-width')(W);  set('cfg-height')(H);
    clearSelection();  // clear existing selection, selection-canvas reserved for guides
    setTimeout(function() { if (typeof drawCanvasSizeGuides === 'function') drawCanvasSizeGuides(); }, 0);
  }
  // Cursor style follows active tool (eyedropper-active body class handles global cursor)
  if (cursorCanvas) {
    if (name === 'marquee' || name === 'wand' || name === 'eyedropper') {
      cursorCanvas.style.cursor = 'crosshair';
    } else if (name === 'pencil' || name === 'eraser' || name === 'bucket') {
      cursorCanvas.style.cursor = 'none';  // custom cursor drawn on canvas
    } else if (name === 'move') {
      cursorCanvas.style.cursor = 'move';
    } else {
      cursorCanvas.style.cursor = 'default';
    }
  }
}
