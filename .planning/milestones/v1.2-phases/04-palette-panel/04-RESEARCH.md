# Phase 4: Palette Panel - Research

**Researched:** 2026-03-03
**Domain:** Browser JavaScript — UI panel porting, swatch-to-picker sync, CSS glow effects, canvas image export
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**面板迁移范围**
- 将 web_ui.html 的色卡限制面板（HTML + CSS + JS）完整移植到 editor.html 左侧滚动区
- 功能与 web_ui.html 保持一致，包括：自动生成色卡、上传色卡文件（.act/.gpl/.pal/.png）、保存/加载色卡（localStorage）、导出格式、映射模式选择、应用色卡按钮
- Phase 4 完成后，同步从 web_ui.html 删除整个色卡面板（HTML/CSS/JS），直接删除，不添加任何引导性文字或跳转按钮

**色卡限制开关行为**
- 打开「色卡限制」开关（toggle）时，自动展开参数栏（当前 web_ui.html 是手动展开的，这里改为自动）
- 关闭开关时，参数栏可保持打开状态（不强制折叠）

**应用色卡结果（UI-03）**
- 应用色卡后**仅预览**，不直接修改 EditorState.pixels，不计入撤销历史
- 结果图展示在画布右侧：原图（左）+ 色卡映射结果（右），两者均提供精准版 / N 倍放大版下载按钮
- 此行为覆盖 REQUIREMENTS 中的 UI-03，Phase 7 无需重复实现

**PAL-01 — 色块点击同步调色盘**
- 点击色卡色块 → 立即将该 RGB 颜色设为调色盘前景色（调用现有 `syncColorUI()`）
- 工具状态保持不变，不切换至铅笔或其他工具

**PAL-02 — 调色盘颜色匹配高亮**
- 匹配规则：精确 RGB 三通道相等（无容差，严格判断）
- 高亮样式：CSS `box-shadow` 发光动画（glow）——色块获得一圈颜色光晕，区别于普通边框
- 若多个色块 RGB 完全相同，则同时高亮所有匹配项
- 高亮在每次调色盘颜色变化时实时刷新

**色卡数据持久化**
- editor.html 与 web_ui.html 共用同一个 localStorage key（`pp_saved_palettes`）
- 由于色卡面板从 web_ui.html 移除，实际上只有 editor.html 负责读写这个 key，不存在竞争问题

### Claude's Discretion
- 发光动画的具体 CSS 参数（半径、颜色强度、是否脉冲闪烁）
- 对比图区域的精确布局（是否与画布等高、是否可隐藏）
- 应用色卡时的 loading 状态 UI（spinner / 按钮 disabled）

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PAL-01 | 点击色卡色块时，自动同步该颜色至常驻调色盘 | Swatch click handler calls `syncColorUI()` after setting `EditorState.foregroundColor`; existing hook points identified |
| PAL-02 | 调色盘当前颜色与色卡某色块匹配时，给该色块加高亮选框 | `highlightMatchingSwatches()` function pattern; triggered from `syncColorUI()` tail; exact RGB match; CSS box-shadow glow |
</phase_requirements>

---

## Summary

Phase 4 is primarily a code-porting and wiring task. The palette panel already exists in full in `web_ui.html` (~400 lines HTML, ~200 lines CSS, ~400 lines JS). The target mount point in `editor.html` is a placeholder `<div id="left-scroll">` containing an empty `.panel-card`. The Flask routes the panel relies on (`/api/apply-palette`, `/api/generate-palette`, `/api/export-palette`, `/api/parse-palette`) already exist and are fully functional.

The two new behaviors — PAL-01 (swatch click syncs to picker) and PAL-02 (active color highlights matching swatches) — require small additions to the ported code. In `web_ui.html`, swatch clicks open a color-editor popup; in `editor.html` they instead call `syncColorUI()` to push the color to `EditorState.foregroundColor`. PAL-02 is a `highlightMatchingSwatches()` function called at the tail of every `syncColorUI()` invocation.

The apply-palette result display needs a new side-by-side layout in `canvas-area`: the existing zoom scroll container stays on the left, and a result panel appears to its right. The result panel renders a non-destructive preview (does not touch `EditorState.pixels`) and exposes exact + scaled download links, implementing UI-03 as a complete deliverable within Phase 4.

**Primary recommendation:** Port the palette panel HTML/CSS/JS as a direct transplant, then wire three integration points: (1) swatch click → `syncColorUI()`, (2) `syncColorUI()` tail → `highlightMatchingSwatches()`, (3) apply-palette → side-by-side preview container. Delete the panel from `web_ui.html` after all three are working.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS (inline) | ES2020 | All panel logic | Single-file no-build constraint (CLAUDE.md) |
| CSS custom properties | CSS3 | Dark theme, shared vars | Already established in editor.html |
| localStorage | Browser API | Palette persistence | `pp_saved_palettes` key already used by web_ui.html |
| Fetch API | Browser | `/api/*` routes | Pattern already established throughout the file |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| FormData | Browser | Sending image+palette to Flask API | apply-palette, generate-palette, export-palette |
| URL.createObjectURL | Browser | Client-side export downloads | .act/.gpl/.pal binary export from server blob response |
| CSS `box-shadow` | CSS3 | PAL-02 glow highlight | No canvas needed — pure CSS |
| CSS `@keyframes` | CSS3 | Pulse animation on matched swatch (Claude's discretion) | Optional: makes highlight more visible |

### No External Libraries
No npm, no build step. This is a constraint from CLAUDE.md ("single self-contained file — inline CSS and JS, no build step").

---

## Architecture Patterns

### Recommended Code Structure (within editor.html `<script>`)

```
// ── Palette Panel State ───────────────────────────────────────────────────
let currentPalette = [];           // [[r,g,b], ...]
let currentPaletteMeta = { name: "", source: "upload", algorithm: "", count: 0 };
let editingSwatchIdx = null;
let selectedPaletteKey = "";

// ── Palette Panel: setCurrentPalette / renderSwatches ─────────────────────
// (transplanted from web_ui.html; swatch click handler modified for PAL-01)

// ── PAL-02: Highlight matching swatches ───────────────────────────────────
function highlightMatchingSwatches() { ... }
// Called at the END of syncColorUI() (after _syncLock = false)
```

### Pattern 1: PAL-01 — Swatch Click to Picker Sync

**What:** Clicking a swatch sets `EditorState.foregroundColor` and calls `syncColorUI()` instead of opening the color-editor popup.

**When to use:** All swatch `click` handlers in the ported palette panel.

**Example:**
```javascript
// In renderSwatches(), replace the web_ui.html click handler:
// web_ui.html: sw.addEventListener("click", () => openColorEditor(idx, sw));
// editor.html:
sw.addEventListener("click", () => {
  const [r, g, b] = currentPalette[idx];
  EditorState.foregroundColor = [r, g, b, 255];
  syncColorUI();
  // Tool state unchanged — no setActiveTool() call
});
```

Note: The color-editor popup (for editing swatch colors) still exists. Use right-click or a separate edit button if in-swatch editing is needed. Per CONTEXT.md, the primary click is now PAL-01 sync. The simplest approach: single-click = PAL-01 sync; the small ×-delete button on hover remains; the popup editor is reachable via double-click or an edit icon.

### Pattern 2: PAL-02 — Highlight Matching Swatches

**What:** After any color change in the picker, compare `EditorState.foregroundColor` against each entry in `currentPalette` for exact RGB equality. Apply glow `box-shadow` to matching swatch elements; clear it on non-matching ones.

**When to use:** Called at the tail of `syncColorUI()`.

**Example:**
```javascript
function highlightMatchingSwatches() {
  const [fr, fg, fb] = EditorState.foregroundColor;
  const swatches = document.querySelectorAll('#swatchesGrid .swatch');
  swatches.forEach((sw, idx) => {
    if (idx >= currentPalette.length) return;
    const [r, g, b] = currentPalette[idx];
    if (r === fr && g === fg && b === fb) {
      // Glow uses the swatch color itself for a natural halo
      sw.style.boxShadow = `0 0 0 2px #fff, 0 0 8px 3px rgb(${r},${g},${b})`;
    } else {
      sw.style.boxShadow = '';
    }
  });
}
```

Append this call inside `syncColorUI()`, after `_syncLock = false`:
```javascript
function syncColorUI() {
  if (_syncLock) return;
  _syncLock = true;
  // ... existing color update logic ...
  _syncLock = false;
  // PAL-02: always run after lock released
  highlightMatchingSwatches();
}
```

**CRITICAL:** `highlightMatchingSwatches()` must be called OUTSIDE the `_syncLock` guard. It reads `EditorState.foregroundColor` and writes DOM only — no risk of re-entrancy. Calling it inside the guard would prevent it from running when `syncColorUI()` is called re-entrantly.

### Pattern 3: Apply-Palette Image Source (editor.html specific)

**What:** In `web_ui.html`, `currentPixelArtB64` is the base64 PNG from the server. In `editor.html`, the image is in `EditorState.pixels` (a `Uint8ClampedArray`). The apply-palette API requires a base64 PNG.

**How to extract base64 from EditorState.pixels:**
```javascript
function getEditorImageB64() {
  // Use an offscreen canvas — 1:1 pixel coordinates, no DPR
  const offscreen = document.createElement('canvas');
  offscreen.width  = EditorState.width;
  offscreen.height = EditorState.height;
  const octx = offscreen.getContext('2d');
  octx.putImageData(
    new ImageData(EditorState.pixels.slice(), EditorState.width, EditorState.height),
    0, 0
  );
  // Remove "data:image/png;base64," prefix — API expects raw base64
  return offscreen.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
}
```

This is the ONLY place `toDataURL` is used — for API export only, not for display or tool logic. `EditorState.pixels` remains the canonical source.

### Pattern 4: Side-by-Side Preview Layout (UI-03)

**What:** After apply-palette, show original + result side by side to the right of the canvas area. This is a non-destructive preview — `EditorState.pixels` is never touched.

**Recommended layout:** Add a `#palette-result-panel` div inside `#canvas-area` or as a sibling to `#zoom-scroll-content`, hidden by default, shown after apply:

```html
<!-- Inside #canvas-area, after #zoom-scroll-content -->
<div id="palette-result-panel" style="display:none; flex-direction:column; gap:8px; padding:12px; flex-shrink:0; border-left:1px solid var(--border);">
  <div style="font-size:12px; font-weight:600; color:var(--text-muted);">色卡结果</div>
  <div style="display:flex; gap:8px;">
    <div>
      <div style="font-size:11px; color:var(--text-muted); margin-bottom:4px;">原图</div>
      <img id="pal-result-original" style="image-rendering:pixelated; max-width:240px;">
      <a id="pal-dl-orig-exact" class="btn-download" download="original.png">↓ 精准版</a>
      <a id="pal-dl-orig-scaled" class="btn-download" download="original_scaled.png">↓ 放大版</a>
    </div>
    <div>
      <div style="font-size:11px; color:var(--text-muted); margin-bottom:4px;">色卡映射</div>
      <img id="pal-result-mapped" style="image-rendering:pixelated; max-width:240px;">
      <a id="pal-dl-mapped-exact" class="btn-download" download="output_palette.png">↓ 精准版</a>
      <a id="pal-dl-mapped-scaled" class="btn-download" download="output_palette_scaled.png">↓ 放大版</a>
    </div>
  </div>
</div>
```

The "原图" side is derived from `EditorState.pixels` via `getEditorImageB64()`. The "色卡映射" side comes from the API response `data.output`. The `data.output_scaled` is the N× version (the API already handles scaling via the `scale` FormData field).

### Pattern 5: Toggle Open-on-Enable Behavior

**What:** CONTEXT.md locks: toggling the `paletteEnabled` checkbox ON auto-expands the body. In `web_ui.html` this is already implemented but the click-to-expand is manual:

```javascript
// web_ui.html:
$("paletteEnabled").addEventListener("change", () => {
  const on = $("paletteEnabled").checked;
  if (on) { paletteBody.classList.remove("hidden"); paletteHeader.classList.add("open"); }
  $("applyPaletteBtn").disabled = !on || ...;
});
```

Port this verbatim. The close direction (toggle OFF does NOT force collapse) is already the natural behavior of this code — no changes needed.

### Anti-Patterns to Avoid

- **Reading pixels from `pixel-canvas` via `getImageData()`:** Never do this for the apply-palette source. Use `EditorState.pixels` → offscreen canvas → `toDataURL()`. The pixel canvas may have premultiplied alpha.
- **Modifying `EditorState.pixels` on apply-palette response:** The result is preview-only. Write to the `#pal-result-mapped` `<img>` src only.
- **Pushing history for palette operations:** `setCurrentPalette()` / `renderSwatches()` must NOT call `pushHistory()`. History is for pixel edits only.
- **Calling `highlightMatchingSwatches()` inside `_syncLock`:** This prevents it from firing. Always call it after `_syncLock = false`.
- **Duplicating the color-editor popup:** web_ui.html has `#colorPopup` for editing swatch colors. Port it but be careful with ID conflicts — editor.html already uses IDs like `pc-hex`, `pc-r`, etc. Use namespaced IDs (e.g., `pal-popup-r`) for the swatch editor popup.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image → base64 for API | Custom pixel encoder | Offscreen canvas + `toDataURL('image/png')` | Browser handles PNG encoding correctly; any custom encoder risks off-by-one in alpha |
| Palette file parsing (.act/.gpl/.pal) | Custom binary parser | `/api/parse-palette` Flask route (already exists) | Binary format edge cases; route already handles all 4 formats |
| Color quantization | In-browser k-means | `/api/generate-palette` Flask route | Already implemented with fastoctree/mediancut/boost |
| Export to .act/.gpl/.pal | JS binary writer | `/api/export-palette` Flask route | Binary format specs are fiddly; server already handles it |
| Swatch glow animation | Canvas overlay | CSS `box-shadow` on `.swatch` elements | Zero canvas overhead; GPU-accelerated; trivially reversible |

**Key insight:** All the hard algorithmic work (quantization, palette file I/O, color mapping) is already on the Flask server. Phase 4 is purely a UI-integration task.

---

## Common Pitfalls

### Pitfall 1: ID Conflicts Between Panels
**What goes wrong:** web_ui.html palette panel uses IDs like `paletteHeader`, `paletteBody`, `paletteEnabled`, `swatchesGrid`, `paletteName`, `generateBtn`, `applyPaletteBtn`, etc. editor.html may already use some of these or accumulate conflicts from Phase 3 additions (`pc-hex`, `pc-r`, etc.).
**Why it happens:** Both files evolved independently with their own namespaces.
**How to avoid:** Before porting, grep editor.html for each ID used in web_ui.html palette code. If there is a collision, add a `pal-` prefix to the ported IDs and update all corresponding JS references.
**Warning signs:** JS errors like "Cannot read properties of null" on `.addEventListener` calls — usually indicates `getElementById()` returned null due to ID mismatch.

### Pitfall 2: `currentPixelArtB64` vs `EditorState.pixels`
**What goes wrong:** The apply-palette JS in web_ui.html references `currentPixelArtB64` (a global string set after server-side image processing). editor.html has no such global — pixels live in `EditorState.pixels`.
**Why it happens:** The two pages have completely different image lifecycles.
**How to avoid:** Replace every `currentPixelArtB64` reference in the ported JS with a call to `getEditorImageB64()`. Guard with `if (!EditorState.pixels)` before calling.
**Warning signs:** Apply-palette API call sends empty/null image data; server returns 400/422.

### Pitfall 3: `paletteEnabled` Gate on Apply-Palette Button
**What goes wrong:** In web_ui.html, `applyPaletteBtn.disabled` depends on both `paletteEnabled.checked` AND `currentPixelArtB64` being set. In editor.html, `currentPixelArtB64` does not exist — the image is always available once loaded.
**Why it happens:** web_ui.html requires the user to process an image first; editor.html always has an image in EditorState.
**How to avoid:** Change the gate to: `applyPaletteBtn.disabled = !paletteEnabled.checked || !EditorState.pixels || currentPalette.length === 0`.

### Pitfall 4: Scale Parameter Source
**What goes wrong:** The apply-palette FormData in web_ui.html appends `fd.append("scale", $("exportScale").value)`. There is no `#exportScale` input in editor.html.
**Why it happens:** The export scale UI is part of web_ui.html's processing panel, not ported to editor.
**How to avoid:** Hardcode `fd.append("scale", "1")` for the exact/scaled split, or add a simple scale selector in the result panel. The API still returns both `output` (1x) and `output_scaled` (Nx) — the `scale` param controls the Nx multiplier. Simplest solution: default to `scale=4` (same as Phase 1 default zoom) or add a minimal `<select>` in the result panel (Claude's discretion).

### Pitfall 5: `highlightMatchingSwatches()` Querys Stale DOM
**What goes wrong:** If `renderSwatches()` rebuilds the DOM and `highlightMatchingSwatches()` is then called, it correctly queries fresh elements. But if `highlightMatchingSwatches()` is called before `renderSwatches()` completes (e.g., from a sync path), the elements queried are stale.
**Why it happens:** `renderSwatches()` replaces `innerHTML`, invalidating all previous element references.
**How to avoid:** Always call `highlightMatchingSwatches()` AFTER `renderSwatches()` when both are needed in sequence. Call `renderSwatches()` first, then `highlightMatchingSwatches()`. Inside `setCurrentPalette()`, call `renderSwatches()` then `highlightMatchingSwatches()`.

### Pitfall 6: web_ui.html Deletion — CSS Classes in Shared Scope
**What goes wrong:** After deleting the palette panel from web_ui.html, some CSS classes (`.palette-section`, `.palette-header`, `.swatch`, `.palette-body`, etc.) that are used by the panel become dead code in web_ui.html. Conversely, editor.html needs these classes added.
**Why it happens:** Styles are scoped to their HTML file but both files are standalone.
**How to avoid:** When porting, bring the full CSS block from web_ui.html lines 108–220 into editor.html's `<style>` section. When deleting from web_ui.html, also remove the corresponding CSS blocks.

### Pitfall 7: Color Editor Popup Z-Index
**What goes wrong:** The color-editor popup for editing swatch values uses `position: fixed; z-index: 999`. editor.html has other overlaid elements (canvas stack uses z-index 1/2/3). The popup must appear above all canvas layers.
**Why it happens:** Default stacking context assumptions differ between pages.
**How to avoid:** Keep `z-index: 999` (same as web_ui.html). Ensure no ancestor of the popup has `transform`, `filter`, or `will-change` that creates a new stacking context — otherwise `position: fixed` behaves as `position: absolute`.

---

## Code Examples

### Swatch Click → PAL-01 Sync (modified renderSwatches)
```javascript
// Source: web_ui.html renderSwatches() + CONTEXT.md PAL-01 decision
function renderSwatches() {
  const grid = document.getElementById('swatchesGrid');
  document.getElementById('swatchCount').textContent = currentPalette.length + ' 色';
  if (currentPalette.length === 0) {
    grid.innerHTML = '<span class="swatches-empty">色卡为空</span>';
    highlightMatchingSwatches(); // clear any stale highlights
    return;
  }
  grid.innerHTML = '';
  currentPalette.forEach(([r, g, b], idx) => {
    const hex = rgbToHex(r, g, b);  // reuse existing utility
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = '#' + hex;
    sw.title = '#' + hex;
    // Delete button (hover-visible)
    const del = document.createElement('button');
    del.className = 'del-btn'; del.textContent = '×';
    del.onclick = e => { e.stopPropagation(); deleteSwatch(idx); };
    sw.appendChild(del);
    // PAL-01: left-click syncs color to picker
    sw.addEventListener('click', () => {
      EditorState.foregroundColor = [r, g, b, 255];
      syncColorUI(); // triggers PAL-02 highlight refresh
    });
    // Keep double-click for popup editor if desired
    sw.addEventListener('dblclick', e => { e.stopPropagation(); openColorEditor(idx, sw); });
    grid.appendChild(sw);
  });
  highlightMatchingSwatches(); // apply current foreground highlights
}
```

### PAL-02 Highlight Function
```javascript
// Source: CONTEXT.md PAL-02 decision
function highlightMatchingSwatches() {
  if (!EditorState.pixels) return; // not loaded yet
  const [fr, fg, fb] = EditorState.foregroundColor;
  document.querySelectorAll('#swatchesGrid .swatch').forEach((sw, idx) => {
    if (idx >= currentPalette.length) return;
    const [r, g, b] = currentPalette[idx];
    if (r === fr && g === fg && b === fb) {
      // Glow: inner white ring + color halo. RGB used for halo color = natural effect.
      sw.style.boxShadow = `0 0 0 2px #fff, 0 0 8px 4px rgb(${r},${g},${b})`;
      sw.style.zIndex = '3'; // ensure glow not clipped by .swatches-grid overflow
    } else {
      sw.style.boxShadow = '';
      sw.style.zIndex = '';
    }
  });
}
```

### syncColorUI with PAL-02 Hook
```javascript
// Source: editor.html lines 476–525 (existing), extended for PAL-02
function syncColorUI() {
  if (_syncLock) return;
  _syncLock = true;
  // ... all existing sync logic unchanged ...
  _syncLock = false;
  highlightMatchingSwatches(); // PAL-02: runs after every color change
}
```

### getEditorImageB64 — Pixels to Base64
```javascript
// Source: CLAUDE.md canvas patterns + Phase 4 requirement
function getEditorImageB64() {
  if (!EditorState.pixels || !EditorState.width || !EditorState.height) return null;
  const off = document.createElement('canvas');
  off.width  = EditorState.width;
  off.height = EditorState.height;
  const octx = off.getContext('2d');
  // Slice() because ImageData constructor takes ownership and pixels must stay valid
  octx.putImageData(
    new ImageData(EditorState.pixels.slice(), EditorState.width, EditorState.height),
    0, 0
  );
  return off.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
}
```

### Apply-Palette Call (editor.html version)
```javascript
// Source: web_ui.html lines 1085–1128, adapted for editor.html context
async function applyPalette() {
  const b64 = getEditorImageB64();
  if (!b64 || currentPalette.length === 0) return;
  document.getElementById('applyPaletteBtn').disabled = true;

  const mode = document.querySelector('input[name=mappingMode]:checked').value;
  const fd = new FormData();
  fd.append('image', b64);
  fd.append('palette', JSON.stringify(currentPalette));
  fd.append('mode', mode);
  fd.append('scale', '4'); // default Nx for scaled download; can be a select

  try {
    const res  = await fetch('/api/apply-palette', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) { /* show error */ return; }

    // Preview only — EditorState.pixels NOT modified
    const exactSrc  = 'data:image/png;base64,' + data.output;
    const scaledSrc = 'data:image/png;base64,' + data.output_scaled;

    document.getElementById('pal-result-mapped').src  = exactSrc;
    document.getElementById('pal-dl-mapped-exact').href   = exactSrc;
    document.getElementById('pal-dl-mapped-scaled').href  = scaledSrc;

    // Original: derive from EditorState.pixels (exact 1:1)
    const origSrc = 'data:image/png;base64,' + b64;
    document.getElementById('pal-result-original').src = origSrc;
    document.getElementById('pal-dl-orig-exact').href  = origSrc;
    // Scaled original: apply-palette API doesn't return scaled original — generate client-side
    // Simplest: link same b64 for "original scaled" (user can scale via download), OR
    // call a second fetch to /api/export-scale if needed. Defer detail to planner.

    document.getElementById('palette-result-panel').style.display = 'flex';
  } catch (err) {
    /* show error */
  } finally {
    document.getElementById('applyPaletteBtn').disabled =
      !document.getElementById('paletteEnabled').checked || !EditorState.pixels || currentPalette.length === 0;
  }
}
```

### CSS: Swatch Overflow Fix for Glow
```css
/* swatches-grid has overflow:auto for scroll — clips box-shadow glow.
   Give the grid overflow:visible but bound max-height with a wrapper. */
.swatches-outer {
  max-height: 140px;
  overflow-y: auto;
  border-radius: 6px;
}
.swatches-grid {
  display: flex; flex-wrap: wrap; gap: 4px;
  padding: 4px; background: var(--surface2);
  border: 1px solid var(--border); border-radius: 6px;
  overflow: visible; /* allow box-shadow glow to show */
}
```

Note: `overflow: hidden/auto` on `.swatches-grid` clips `box-shadow`. Wrapping in an `overflow-y: auto` outer div and setting `.swatches-grid` to `overflow: visible` is required for PAL-02 glow to display correctly.

---

## Existing Code Inventory (editor.html)

These assets are already present and must not be duplicated:

| Asset | Location | Notes |
|-------|----------|-------|
| `syncColorUI()` | editor.html line 477 | Add `highlightMatchingSwatches()` call at tail |
| `EditorState.palette: []` | editor.html line 549 | Keep in sync with `currentPalette` local var |
| `EditorState.foregroundColor` | editor.html line 535 | Mutated by PAL-01 swatch click |
| `hslToRgb()`, `rgbToHsl()` | editor.html lines 378–398 | Color utilities, reuse for popup editor |
| `_syncLock` | editor.html line 476 | Guard in syncColorUI; do NOT put highlightMatchingSwatches inside it |
| `#left-scroll` | editor.html line 292 | Mount point for palette panel — replace placeholder div content |
| Flask routes | web_app.py | apply-palette, generate-palette, export-palette, parse-palette — all exist |

These are ABSENT from editor.html and must be ported from web_ui.html:

| Asset | Source in web_ui.html | Action |
|-------|----------------------|--------|
| `currentPalette` variable | line 566 | Add as module-level let |
| `currentPaletteMeta` variable | line 569 | Add as module-level let |
| `editingSwatchIdx` variable | line 567 | Add as module-level let |
| `selectedPaletteKey` variable | line 568 | Add as module-level let |
| Palette section HTML | lines 354–488 | Port into `#left-scroll > .panel-card` |
| Color editor popup HTML | lines 542–558 | Port as sibling of `#layout` (fixed-position) |
| CSS: `.palette-section`, `.swatch`, `.toggle-switch`, `.tabs`, `.custom-select`, etc. | lines 108–220 | Port into `<style>` |
| `setCurrentPalette()` / `renderSwatches()` | lines 848–880 | Port with PAL-01 modification |
| Color editor popup JS (`openColorEditor`, `closeColorEditor`, `syncFromRgb/Hex/Picker`) | lines 900–958 | Port as-is (reads from `currentPalette`, not EditorState) |
| Save/load palette JS | lines 960–1056 | Port using same `pp_saved_palettes` LS key |
| Export palette JS | lines 1058–1080 | Port as-is |
| Apply palette JS | lines 1082–1128 | Port with `getEditorImageB64()` substitution |
| Palette strip render | lines 1130–1139 | Port for result panel |
| `rgbToHex()` / `hexToRgb()` | web_ui.html | Check if already in editor.html; add if missing |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `overflow: hidden` on swatch container | Wrap in scroller + `overflow: visible` on inner grid | Phase 4 | Required for box-shadow glow to not be clipped |
| Palette panel only in web_ui.html | Moved to editor.html, deleted from web_ui.html | Phase 4 | Single location of truth for palette functionality |
| Swatch click opens color editor | Swatch click syncs to foreground color (PAL-01) | Phase 4 | Integrates drawing tool color with palette |

---

## Open Questions

1. **Original image scaled download in result panel**
   - What we know: `/api/apply-palette` returns `output` (1x) and `output_scaled` (Nx). It does NOT return a scaled version of the original image.
   - What's unclear: Should the "原图 ↓ 放大版" link scale client-side (CSS zoom on img), or make a second API call, or just omit it?
   - Recommendation: Simplest path — render original img with `width: 240px; image-rendering: pixelated` for visual comparison; provide only the exact download link for original. This matches CONTEXT.md's "preview only" intent. Planner can decide.

2. **Swatch color-editor popup — single-click vs double-click**
   - What we know: PAL-01 locks single-click to foreground sync. The popup editor exists for modifying palette colors.
   - What's unclear: CONTEXT.md does not specify how to invoke the popup editor in editor.html.
   - Recommendation: Double-click opens popup editor; single-click = PAL-01 sync. This is a natural convention and keeps both behaviors accessible.

3. **`EditorState.palette` vs `currentPalette` local variable**
   - What we know: `EditorState.palette` is defined as `[]` in EditorState but never written to in the current editor.html code.
   - What's unclear: Should `currentPalette` be kept as a local var (matching web_ui.html style), or be replaced with `EditorState.palette`?
   - Recommendation: Mirror writes to both. When `setCurrentPalette()` updates `currentPalette`, also set `EditorState.palette = currentPalette.slice()`. This keeps EditorState as source of truth while preserving the ported code's local-variable patterns.

---

## Sources

### Primary (HIGH confidence)
- Direct code reading: `web_ui.html` (full file, 1142 lines) — palette panel HTML/CSS/JS structure confirmed
- Direct code reading: `editor.html` (full file, 1465 lines) — existing hooks (`syncColorUI`, `EditorState`, `#left-scroll`) confirmed
- Direct code reading: `CLAUDE.md` — NEVER read canvas for pixel data; CSS transform zoom; single-file constraint
- Direct code reading: `.planning/phases/04-palette-panel/04-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)
- MDN CSS box-shadow: `overflow: hidden` clips box-shadow on child elements — well-documented browser behavior
- MDN Canvas API: `toDataURL('image/png')` encodes correctly from putImageData; premultiplied alpha issue only occurs on `getImageData` from a canvas that had `drawImage` with transparency, not from `putImageData` path

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no external libraries; all APIs are browser built-ins verified in existing code
- Architecture: HIGH — porting is the primary task; integration points are concretely identified in source
- Pitfalls: HIGH — all pitfalls derived from direct code inspection (ID conflicts, missing globals, overflow clipping)

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable browser APIs; Flask routes will not change between phases)
