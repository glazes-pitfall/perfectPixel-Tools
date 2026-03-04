// ── History (undo/redo) ───────────────────────────────────────────────────

var btnUndo = null;
var btnRedo = null;

function initHistoryButtons() {
  btnUndo = document.getElementById('btn-undo');
  btnRedo = document.getElementById('btn-redo');
  btnUndo.addEventListener('click', undo);
  btnRedo.addEventListener('click', redo);
  updateHistoryButtons();
}

function updateHistoryButtons() {
  if (!btnUndo || !btnRedo) return;
  btnUndo.disabled = EditorState.historyIndex <= 0;
  btnRedo.disabled = EditorState.historyIndex >= EditorState.history.length - 1;
}

/**
 * Save a snapshot of EditorState.pixels to the history stack.
 * Must be called in pointerdown only — never in pointermove.
 * One user action = one history entry.
 * Each entry stores {pixels, width, height} so canvas-resize ops are fully undoable.
 */
function pushHistory() {
  // Truncate any redo branch
  EditorState.history.splice(EditorState.historyIndex + 1);
  // Push snapshot including canvas dimensions (canvas-size changes must be undoable)
  EditorState.history.push({
    pixels: EditorState.pixels.slice(),
    width:  EditorState.width,
    height: EditorState.height,
  });
  // Overflow: keep stack at MAX_HISTORY
  if (EditorState.history.length > EditorState.MAX_HISTORY) {
    EditorState.history.shift();
  } else {
    EditorState.historyIndex++;
  }
  updateHistoryButtons();
}

function _restoreHistoryEntry(entry) {
  var pixels = entry.pixels, width = entry.width, height = entry.height;
  // If canvas size changed, rebuild canvas elements before writing pixels
  if (width !== EditorState.width || height !== EditorState.height) {
    initCanvases(width, height);
    clearSelection();
  }
  EditorState.pixels = pixels.slice();
  flushPixels();
}

function undo() {
  if (EditorState.historyIndex <= 0) return;
  EditorState.historyIndex--;
  _restoreHistoryEntry(EditorState.history[EditorState.historyIndex]);
  updateHistoryButtons();
}

function redo() {
  if (EditorState.historyIndex >= EditorState.history.length - 1) return;
  EditorState.historyIndex++;
  _restoreHistoryEntry(EditorState.history[EditorState.historyIndex]);
  updateHistoryButtons();
}
