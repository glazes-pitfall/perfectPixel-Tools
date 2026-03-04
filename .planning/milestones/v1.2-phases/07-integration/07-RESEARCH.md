# Phase 7: Integration - Research

**Researched:** 2026-03-04
**Domain:** Browser JS integration (sessionStorage handoff, Canvas Size tool, download modal) + web_ui.html modification
**Confidence:** HIGH — all findings are grounded in direct codebase inspection of editor.html (4263 lines) and web_ui.html (387 lines)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### 入口点行为（ENTRY-01）

- 「在编辑器中打开」按钮位置：`web_ui.html` 结果图旁，两个下载按钮下方，按钮文本含 emoji 以醒目标识
- sessionStorage 传递数据：
  - `editorImage`：base64 PNG（处理后的像素画）
  - `editorFilename`：原始文件名（用于下载命名，例如 `test.jpg`）
  - **不传** gridW/gridH——图片已被 PerfectPixel 处理为精确像素，网格信息冗余
  - **不传** 色卡——色卡限制功能仅在编辑器内，两页面之间无需传递
- sessionStorage 超限时（QuotaExceededError）：弹错误提示，告知用户在编辑器中重新上传图片
- 直接访问 `/editor`（不从 web_ui.html 跳转）：中央画布区域显示「点击或拖拽图片到此处」，复用 `web_ui.html` 的文件上传/拖拽逻辑

#### 画布尺寸工具（CFG-01~04）

- 激活方式：快捷键 S
- 输入框位置：顶栏（Top Bar）工具参数区，与其他工具参数栏保持一致
- 显示方式：Width、Height、L、R、T、B 6 个输入框**全部同时显示**
- 参数语义：
  - Width / Height：目标画布的最终尺寸（直接输入像素值）
  - L / R / T / B：四边各扩/缩像素数（正值扩张，负值收缩），与 Width/Height 独立
- 退出方式：顶栏有 Apply 和 Cancel 按钮；也可按 ESC 键取消
- Apply 后：原画布内容按 L/T 偏移量移动到新位置，扩张区域填充为透明；此操作计入撤销历史（push to history）
- 参考线视觉：
  - **紫色实线**，跨越整个中心编辑区域（不局限于画布边界）
  - 实时随输入更新
  - 扩张区域显示「偏浅偏蓝」的棋盘格（与原透明背景棋盘格区分），标识新增画布区域
  - 参考线、扩张棋盘格、原画布三者联动平移

#### 下载功能（CANVAS-03）

- 入口位置：常驻调色盘面板区域并排，左下角
- 点击后弹出下载弹窗，弹窗内容：
  - 整数倍放大滑动条（1–100×）+ 数值输入框，**默认 1×**
  - Home 键（弹窗左侧）：返回 `web_ui.html`；若画布已加载图片则弹确认提示（「将丢失当前进度，是否继续？」）
  - 下载按钮（最醒目的元素）
  - 下载触发后：弹窗内显示预览图
    - 预览尺寸：按比例缩放，最长边不超过 480px（display only）
    - 实际下载文件为真实尺寸（原尺寸 × 倍数），例如 60×60 at 100× → 6000×6000
    - 用户可右键手动另存为预览图（此时得到的也是真实尺寸的图）
- 文件名规则：`{原文件名去扩展名}_pixelated_{N}x.png`
  - 例：上传 `test.jpg`，选 8×，保存为 `test_pixelated_8x.png`
  - 原文件名不可用时（fallback）：`output_{N}x.png`
- 原始文件名来源：
  - 从 `web_ui.html` 跳转时：sessionStorage 中的 `editorFilename` 字段
  - 直接在编辑器上传时：从 `drop` / `file input` 事件读取文件名，存入 EditorState

### Claude's Discretion

- 参考线实现方案（selection-canvas 或单独 overlay canvas）
- Canvas Size Apply 时处理现有 selection 的行为（清除 or 裁剪）
- 顶栏 Canvas Size 参数区的具体间距与排版
- 下载弹窗的具体样式与动画

### Deferred Ideas (OUT OF SCOPE)

无——讨论全程未出现超出 Phase 7 范围的新功能提议。
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ENTRY-01 | 像素化处理完成后，结果区新增「在编辑器中打开」按钮，点击通过 sessionStorage 传递图像数据并跳转至 editor.html | web_ui.html 结果区 HTML 已识别；sessionStorage API 直接可用；QuotaExceededError 捕获模式已确认 |
| UI-03 | 应用色卡后，中央画布右侧显示色卡映射对比图（含精准版/N倍放大版下载） | CONTEXT.md 明确：UI-03 已在前序阶段完成，不在 Phase 7 范围 |
| CANVAS-03 | 中央画布下方提供精准版下载和 N 倍放大版下载 | getEditorImageB64() 已存在（line 1070）；canvas.toBlob() + URL.createObjectURL() + a.click() 模式已在代码中使用；下载弹窗为新增 UI |
| CFG-01 | Canvas Size（快捷键 S）：进入模式后显示 4 根参考线实时预览新画布边界 | selection-canvas 已有 DPR-scaled overlay 绘制基础；参考线为直线绘制，实时随输入更新 |
| CFG-02 | Canvas Size 参数：Width（宽）、Height（高）（可键入） | 顶栏 tool-settings-* 模式已建立（pencil/eraser/bucket/wand/marquee/move 全部存在） |
| CFG-03 | Canvas Size 参数：Left / Right / Top / Bottom（正值扩张，负值收缩，可键入） | 同 CFG-02，顶栏新增 tool-settings-canvas-size div |
| CFG-04 | 点击「应用」后生成新画布，旧画布内容按偏移量移动到正确位置 | initCanvases(newW, newH) 已存在；需新建 Uint8ClampedArray 并将旧像素复制到偏移位置；pushHistory() 在 Apply 前调用 |
</phase_requirements>

---

## Summary

Phase 7 是整个 Ver 1.2 编辑器的收尾阶段，分三条相对独立的工作线：(1) 在 `web_ui.html` 中添加「在编辑器中打开」入口；(2) 在 `editor.html` 中实现 Canvas Size 工具（快捷键 S）；(3) 为 `editor.html` 增加下载弹窗。三条工作线彼此互不阻塞，可并行实现。

代码库已有大量可复用基础：`getEditorImageB64()`、`initCanvases()`、`setActiveTool()` 的 `tool-settings-*` 模式、selection-canvas 的 overlay 绘制能力、以及 `pushHistory()` 机制。Canvas Size 工具仅需新的 Uint8ClampedArray 复制逻辑 + 参考线绘图；下载功能完全客户端，无需新 Flask 路由；ENTRY-01 仅需修改 `web_ui.html` 约 15 行。

注意：CONTEXT.md 明确 UI-03（色卡对比图）已在前序阶段完成，Phase 7 不包含该需求。EditorState 目前无 `filename` 字段，Phase 7 需要在 EditorState 中添加 `filename: ''` 字段。

**Primary recommendation:** 三个工作区并行推进，优先完成 ENTRY-01（影响最小，改动最少），然后并行实现 Canvas Size 工具（CFG-01~04）和下载弹窗（CANVAS-03）。

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS + Canvas API | 浏览器内置 | 像素操作、overlay 绘制、下载触发 | 项目全程无构建工具，单文件 HTML 模式 |
| sessionStorage API | 浏览器内置 | 跨页面图像传递（web_ui.html → editor.html） | 已在 CLAUDE.md 和 CONTEXT.md 中确定使用 |
| Flask (Python) | 已安装 | 静态文件服务（/editor 路由已存在） | 无需新增路由 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| canvas.toBlob() | 浏览器内置 | 生成真实尺寸下载文件 | 下载弹窗触发下载时 |
| URL.createObjectURL() | 浏览器内置 | 临时 Blob URL 供 `<a>.click()` 下载 | 与 toBlob() 配合 |
| FileReader API | 浏览器内置 | 直接上传图片时读取文件名和 base64 | 编辑器直接上传路径 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sessionStorage | Flask token endpoint (`/api/editor/init`) | 更稳健但需要服务端状态；STATE.md 记录此为 fallback 设计；CONTEXT.md 决定：quota 超限时弹错误提示即可，不实现 token fallback |
| canvas.toBlob() | getEditorImageB64() + `<a href=data:...>` | data: URL 方案在大文件时会阻塞 UI；toBlob() 是异步非阻塞的正确方式 |
| selection-canvas 绘制参考线 | 新建第四个 overlay canvas | selection-canvas 已覆盖整个 canvas-area，DPR-scaled，适合参考线；避免引入第四层 |

**Installation:** 无需安装新依赖，全部使用浏览器内置 API + 已有 Flask 服务。

---

## Architecture Patterns

### Pattern 1: ENTRY-01 — web_ui.html 结果区添加按钮

**What:** 在 `web_ui.html` 的输出卡片 `#dlScaled` 下方添加「在编辑器中打开」按钮，处理成功后显示，点击触发 sessionStorage 存储 + 跳转。

**When to use:** 仅在 `/api/process` 成功响应后显示该按钮（与 `dlExact`/`dlScaled` 的 `display:block` 逻辑一致）。

**Exact insertion point in web_ui.html (line 248):**
```html
<!-- 现有代码（line 246-248）：-->
<a class="btn-download" id="dlExact" download="output.png">↓ 下载精准版</a>
<a class="btn-download" id="dlScaled" download="output_scaled.png">↓ 下载放大版</a>
<!-- 在此之后新增：-->
<button class="btn-download" id="btnOpenEditor" style="display:none; cursor:pointer; border:none;">
  🎨 在编辑器中打开
</button>
```

**JS 逻辑（在处理成功回调中，与 dlExact/dlScaled 一起显示）:**
```javascript
// 已有变量：currentPixelArtB64, selectedFile (selectedFile.name = 原文件名)
document.getElementById('btnOpenEditor').style.display = 'block';
document.getElementById('btnOpenEditor').onclick = () => {
  try {
    sessionStorage.setItem('editorImage', currentPixelArtB64);
    sessionStorage.setItem('editorFilename', selectedFile ? selectedFile.name : '');
    window.location.href = '/editor';
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      alert('图片过大，无法通过浏览器存储传递。请在编辑器中直接上传图片。');
    } else { throw e; }
  }
};
```

**Reset 时同步隐藏（resetOutput 函数中添加）:**
```javascript
document.getElementById('btnOpenEditor').style.display = 'none';
```

### Pattern 2: ENTRY-01 — editor.html 启动时读取 sessionStorage

**What:** `DOMContentLoaded` 时检查 `sessionStorage.editorImage`，有则加载，无则显示拖拽上传界面替换默认的 `loadPlaceholderImage()`。

**When to use:** 替换现有的 `loadPlaceholderImage().then(...)` 调用逻辑。

**实现模式:**
```javascript
// 在 DOMContentLoaded 开头，替换当前 loadPlaceholderImage() 调用
const storedImage    = sessionStorage.getItem('editorImage');
const storedFilename = sessionStorage.getItem('editorFilename');
if (storedImage) {
  sessionStorage.removeItem('editorImage');    // 读取后立即清除
  sessionStorage.removeItem('editorFilename');
  EditorState.filename = storedFilename || '';
  loadImageFromB64(storedImage).then(() => {
    pushHistory();
    // 继续绑定 pixel inspector + 其他事件...
  });
} else {
  // 无 sessionStorage 数据：显示拖拽上传区域
  showDropZone();  // 替换画布中心区域为上传界面
}
```

**`loadImageFromB64(b64)` 函数（基于现有 `loadPlaceholderImage` 模式）:**
```javascript
async function loadImageFromB64(b64) {
  const blob   = await (await fetch('data:image/png;base64,' + b64)).blob();
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  initCanvases(width, height);
  pixelCtx.drawImage(bitmap, 0, 0);
  const imageData = pixelCtx.getImageData(0, 0, width, height);
  EditorState.pixels = imageData.data.slice();
  clearSelection();
  flushPixels();
  bitmap.close();
}
```

**EditorState 需新增字段:**
```javascript
// 在 EditorState 对象中添加：
filename: '',  // 原始文件名，用于下载命名
```

### Pattern 3: 直接上传时的拖拽区域

**What:** 无 sessionStorage 数据时，canvas-area 中央显示拖拽上传区；拖入或点击文件选择后调用 `loadImageFromB64`。

**When to use:** `editor.html` 直接访问时（非从 web_ui.html 跳转）。

**实现模式（复用 web_ui.html 的 dragover/drop 事件模式）:**
```javascript
function showDropZone() {
  const canvasArea = document.getElementById('canvas-area');
  // 在 canvas-area 中央叠加一个拖拽提示 div
  const zone = document.createElement('div');
  zone.id = 'drop-zone';
  zone.style.cssText = 'position:absolute;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;cursor:pointer;';
  zone.innerHTML = '<div style="font-size:48px;">🖼️</div><div style="font-size:16px;color:var(--text-muted);">点击或拖拽图片到此处</div>';
  canvasArea.appendChild(zone);

  const fileInput = document.createElement('input');
  fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.style.display = 'none';
  canvasArea.appendChild(fileInput);

  zone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFileUpload(fileInput.files[0]);
  });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.background = 'rgba(124,106,247,.08)'; });
  zone.addEventListener('dragleave', () => { zone.style.background = ''; });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) handleFileUpload(f);
  });
}

async function handleFileUpload(file) {
  EditorState.filename = file.name;
  const reader = new FileReader();
  reader.onload = async e => {
    const b64 = e.target.result.replace(/^data:image\/\w+;base64,/, '');
    document.getElementById('drop-zone')?.remove();
    await loadImageFromB64(b64);
    pushHistory();
    // 绑定事件（pixelinspector 等）——需重构为可多次调用的函数
  };
  reader.readAsDataURL(file);
}
```

### Pattern 4: Canvas Size 工具（CFG-01~04）

**What:** 新工具 `canvas-size`，快捷键 S，激活时在 selection-canvas 上绘制紫色参考线预览新画布边界；Apply 后调用像素搬运逻辑重建 EditorState.pixels + initCanvases。

**Tool settings panel（顶栏新增，与已有 tool-settings-* 模式一致）:**

在 `#top-bar` 内、`#tool-settings-move` div 之后插入：
```html
<div id="tool-settings-canvas-size" style="display:none; align-items:center; gap:6px;">
  <label style="font-size:12px;color:var(--text-muted);">W</label>
  <input id="cfg-width"  type="number" min="1" value="64" style="width:52px;...">
  <label style="font-size:12px;color:var(--text-muted);">H</label>
  <input id="cfg-height" type="number" min="1" value="64" style="width:52px;...">
  <span style="color:var(--border);padding:0 4px;">|</span>
  <label style="font-size:12px;color:var(--text-muted);">L</label>
  <input id="cfg-left"   type="number" value="0" style="width:44px;...">
  <label style="font-size:12px;color:var(--text-muted);">R</label>
  <input id="cfg-right"  type="number" value="0" style="width:44px;...">
  <label style="font-size:12px;color:var(--text-muted);">T</label>
  <input id="cfg-top"    type="number" value="0" style="width:44px;...">
  <label style="font-size:12px;color:var(--text-muted);">B</label>
  <input id="cfg-bottom" type="number" value="0" style="width:44px;...">
  <button class="btn btn-primary" id="btn-cfg-apply"  style="padding:4px 10px;font-size:12px;">Apply ✓</button>
  <button class="btn btn-ghost"   id="btn-cfg-cancel" style="padding:4px 10px;font-size:12px;">Cancel ✕</button>
</div>
```

**setActiveTool 需更新 panelIds 数组（line 1152）:**
```javascript
const panelIds = ['tool-settings-pencil', 'tool-settings-eraser', 'tool-settings-bucket',
                  'tool-settings-marquee', 'tool-settings-wand', 'tool-settings-move',
                  'tool-settings-canvas-size'];  // 新增
```

**参考线绘制（绘制在 selection-canvas，screen space）:**
```javascript
function drawCanvasSizeGuides(newW, newH, offsetL, offsetT) {
  // 不清除 selection-canvas 上可能存在的 ants（canvas size 模式先 clearSelection()）
  // 转换画布坐标到 screen 坐标（使用 zoom-container 的 getBoundingClientRect）
  const zc = document.getElementById('zoom-container');
  const zcRect = zc.getBoundingClientRect();
  const caRect = document.getElementById('canvas-area').getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const zoom = EditorState.zoom;

  // 新画布四边在屏幕上的位置（相对 canvas-area）
  const left   = zcRect.left - caRect.left + offsetL * zoom;
  const top    = zcRect.top  - caRect.top  + offsetT * zoom;
  const right  = left + newW * zoom;
  const bottom = top  + newH * zoom;

  selCtx.save();
  selCtx.strokeStyle = '#7c6af7';  // --accent 紫色
  selCtx.lineWidth = 1;
  selCtx.setLineDash([]);          // 实线，非虚线

  // 左边线（跨整个 canvas-area 高度）
  selCtx.beginPath(); selCtx.moveTo(left, 0); selCtx.lineTo(left, selCanvas.height / dpr); selCtx.stroke();
  // 右边线
  selCtx.beginPath(); selCtx.moveTo(right, 0); selCtx.lineTo(right, selCanvas.height / dpr); selCtx.stroke();
  // 上边线（跨整个 canvas-area 宽度）
  selCtx.beginPath(); selCtx.moveTo(0, top); selCtx.lineTo(selCanvas.width / dpr, top); selCtx.stroke();
  // 下边线
  selCtx.beginPath(); selCtx.moveTo(0, bottom); selCtx.lineTo(selCanvas.width / dpr, bottom); selCtx.stroke();
  selCtx.restore();
}
```

**Apply 逻辑（像素搬运）:**
```javascript
function applyCanvasSize(newW, newH, offsetL, offsetT) {
  pushHistory();  // save-before（Apply 是即时操作，非拖拽）
  const oldPixels = EditorState.pixels;
  const oldW = EditorState.width;
  const oldH = EditorState.height;
  const newPixels = new Uint8ClampedArray(newW * newH * 4);  // 全透明

  const srcX0 = Math.max(0, -offsetL);
  const srcY0 = Math.max(0, -offsetT);
  const dstX0 = Math.max(0, offsetL);
  const dstY0 = Math.max(0, offsetT);
  const copyW = Math.min(oldW - srcX0, newW - dstX0);
  const copyH = Math.min(oldH - srcY0, newH - dstY0);

  for (let row = 0; row < copyH; row++) {
    const srcOff = ((srcY0 + row) * oldW + srcX0) * 4;
    const dstOff = ((dstY0 + row) * newW + dstX0) * 4;
    newPixels.set(oldPixels.subarray(srcOff, srcOff + copyW * 4), dstOff);
  }

  EditorState.pixels = newPixels;
  clearSelection();
  initCanvases(newW, newH);  // 重设三层 canvas 尺寸
  flushPixels();
  setActiveTool('pencil');   // 退出 canvas-size 模式
}
```

**扩张区域棋盘格（「偏浅偏蓝」）：** 在 #zoom-container 的 background-image CSS 已有棋盘格（深色，`--surface` / `--surface2`）。扩张区新增棋盘格通过在 pixel-canvas 的对应区域预填充半透明蓝色像素实现，Apply 时会被新 Uint8ClampedArray 覆盖。更简单的方案：不修改像素，而是在 selection-canvas 上用半透明蓝矩形覆盖新增区域（优先选此方案，更干净）。

### Pattern 5: 下载弹窗（CANVAS-03）

**What:** 在 `#color-picker-panel` 或 `#pixel-inspector` 区域旁添加下载按钮，点击后弹出全屏/遮罩弹窗，内含缩放滑条 + 预览 + 下载按钮 + Home 按钮。

**位置确认（CONTEXT.md）：** 「常驻调色盘面板区域并排，左下角」——即 `#color-picker-panel` 和 `#pixel-inspector` 之间或下方，在左面板底部区域。

**触发按钮（在 left panel 底部）:**
```html
<div style="padding:8px 12px; border-top:1px solid var(--border); display:flex; gap:8px;">
  <button id="btn-download-open" class="btn btn-secondary" style="flex:1;">⬇ 下载</button>
  <button id="btn-home" class="btn btn-ghost" title="返回 web_ui.html">🏠</button>
</div>
```

**弹窗 HTML（position:fixed 遮罩）:**
```html
<div id="download-modal" style="display:none; position:fixed; inset:0; z-index:1000;
     background:rgba(0,0,0,.6); align-items:center; justify-content:center;">
  <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius);
              padding:24px; min-width:320px; max-width:480px; display:flex; flex-direction:column; gap:16px;">
    <div style="font-weight:700; font-size:15px;">下载图片</div>
    <!-- 缩放滑条 -->
    <div style="display:flex; align-items:center; gap:8px;">
      <label style="font-size:12px; color:var(--text-muted);">放大倍数</label>
      <input type="range" id="dl-scale-slider" min="1" max="100" value="1" style="flex:1; accent-color:var(--accent);">
      <input type="number" id="dl-scale-num" min="1" max="100" value="1" style="width:48px;...">
      <span style="font-size:12px; color:var(--text-muted);">×</span>
    </div>
    <!-- 预览区（下载后显示） -->
    <div id="dl-preview" style="display:none; text-align:center;">
      <img id="dl-preview-img" style="max-width:100%; max-height:240px; image-rendering:pixelated; border-radius:4px;">
      <div style="font-size:11px; color:var(--text-muted); margin-top:6px;" id="dl-size-info"></div>
    </div>
    <!-- 操作按钮行 -->
    <div style="display:flex; gap:8px; align-items:center;">
      <button id="dl-btn-home" class="btn btn-ghost" title="返回 web_ui.html">🏠 返回主页</button>
      <span style="flex:1;"></span>
      <button id="dl-btn-cancel" class="btn btn-ghost">取消</button>
      <button id="dl-btn-download" class="btn btn-primary" style="font-size:14px; padding:10px 20px;">⬇ 下载</button>
    </div>
  </div>
</div>
```

**下载触发逻辑（客户端，无 Flask）:**
```javascript
function triggerDownload(scale) {
  if (!EditorState.pixels || !EditorState.width) return;
  const newW = EditorState.width  * scale;
  const newH = EditorState.height * scale;
  const off  = document.createElement('canvas');
  off.width = newW; off.height = newH;
  const ctx  = off.getContext('2d');
  // 先绘原始尺寸 canvas，再缩放到目标尺寸
  const src = document.createElement('canvas');
  src.width = EditorState.width; src.height = EditorState.height;
  src.getContext('2d').putImageData(
    new ImageData(EditorState.pixels.slice(), EditorState.width, EditorState.height), 0, 0
  );
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, newW, newH);

  off.toBlob(blob => {
    // 生成预览（最长边 ≤ 480px）
    const previewScale = Math.min(1, 480 / Math.max(newW, newH));
    const previewSrc = URL.createObjectURL(blob);
    const previewImg = document.getElementById('dl-preview-img');
    previewImg.src = previewSrc;
    previewImg.style.width  = Math.round(newW * previewScale) + 'px';
    previewImg.style.height = Math.round(newH * previewScale) + 'px';
    document.getElementById('dl-size-info').textContent = `${newW} × ${newH} px`;
    document.getElementById('dl-preview').style.display = 'block';

    // 触发真实下载
    const baseName = EditorState.filename
      ? EditorState.filename.replace(/\.[^.]+$/, '')
      : 'output';
    const filename = `${baseName}_pixelated_${scale}x.png`;
    const a = document.createElement('a');
    a.href = previewSrc; a.download = filename;
    a.click();
    // 注意：不立即 revokeObjectURL，因为用户可能右键保存预览图
  }, 'image/png');
}
```

**Home 按钮逻辑（弹窗内和面板内共用）:**
```javascript
function goHome() {
  if (EditorState.pixels) {
    if (!confirm('将丢失当前进度，是否继续？')) return;
  }
  window.location.href = '/';
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 跨页传递大图像数据 | 自定义 localStorage 序列化 | sessionStorage（已决定） | 直接可用；quota 错误有标准捕获方式 |
| 图像缩放下载 | 手动像素循环 | Off-screen canvas + drawImage(imageSmoothingEnabled=false) | 浏览器原生最近邻缩放，无需像素级循环 |
| 参考线绘制 | 新建第四层 canvas | 复用 selection-canvas（selCtx 已配置 DPR） | canvas 已存在，覆盖整个 canvas-area，DPR 已处理 |
| Canvas 重建 | 重新创建 DOM 元素 | `initCanvases(newW, newH)` + 更新 EditorState.pixels | initCanvases 已处理三层 canvas 尺寸和 DPR，重复利用 |
| 像素复制到新画布 | 逐像素读写 | TypedArray.subarray() + set()（行批量复制） | 显著优于逐像素循环；批量 set 使用 memcpy 路径 |

**Key insight:** 此阶段所有核心技术问题均有既有的浏览器原生 API 或现有代码函数作为解答，无需自行实现复杂算法。

---

## Common Pitfalls

### Pitfall 1: sessionStorage 传递后未清除
**What goes wrong:** editor.html 重新加载（用户手动刷新）时再次读取已过时的 sessionStorage 数据，加载上次图片。
**Why it happens:** 忘记在读取后立即调用 `removeItem`。
**How to avoid:** 读取 `storedImage` 后立即 `removeItem('editorImage')` + `removeItem('editorFilename')`，不等图片加载完成。
**Warning signs:** 刷新编辑器页面时出现意料之外的图片。

### Pitfall 2: initCanvases 重复调用导致 pixelCtx 被覆盖
**What goes wrong:** `initCanvases` 每次调用都执行 `pixelCanvas.getContext('2d', { willReadFrequently: true, alpha: true })`。浏览器规范允许重复调用但必须传递相同参数；如果第二次调用省略了 `willReadFrequently: true`，结果未定义。
**Why it happens:** Canvas Size Apply 后调用 `initCanvases(newW, newH)` — 这是第二次调用。
**How to avoid:** 保持 `initCanvases` 中 `getContext` 调用的参数不变（`{ willReadFrequently: true, alpha: true }`）。当前代码已经是正确的，勿在 Apply 路径中改变传参。

### Pitfall 3: Canvas Size 参考线绘制坐标系混淆
**What goes wrong:** 参考线位置与预览不一致：在 zoom 变化后参考线错位。
**Why it happens:** selection-canvas 是 screen space（DPR-scaled），而 pixel-canvas 在 CSS transform 的 zoom-container 内。参考线必须使用 `zoom-container.getBoundingClientRect()` 相对于 `canvas-area.getBoundingClientRect()` 来定位，而非 canvas 坐标乘 zoom（这样会忽略 scroll offset）。
**How to avoid:** 参考线 x/y = `zcRect.left - caRect.left + pixelX * zoom`，而非 `pixelX * zoom`。每次输入变化时重新从 DOM 获取 rect（实时位置）。
**Warning signs:** 参考线在滚动后偏移，或在特定 zoom 等级下错位。

### Pitfall 4: 下载弹窗中 Blob URL 过早 revoke
**What goes wrong:** 用户点击下载后尝试右键预览图另存为，却得到空白/broken 图片。
**Why it happens:** `URL.revokeObjectURL(url)` 在 `a.click()` 后立即执行，Blob URL 已失效。
**How to avoid:** 保留 Blob URL 在弹窗的 `<img>` 中显示期间有效。在弹窗关闭时或下次下载时再 revoke 旧 URL。维护一个 `let _lastBlobUrl = null` 变量，关闭弹窗时 revoke。

### Pitfall 5: Canvas Size Apply 时未清除 selection
**What goes wrong:** 旧 selection mask 的坐标指向旧画布尺寸，Apply 后 selectionMask 长度（oldW×oldH）与新 EditorState.width×height 不匹配，导致 isSelectedPixel 读取越界。
**Why it happens:** `initCanvases` 重置了 EditorState.width/height，但未清除 selectionMask。
**How to avoid:** 在 `applyCanvasSize` 中调用 `clearSelection()` 后再调用 `initCanvases`。

### Pitfall 6: 像素行批量复制的边界条件
**What goes wrong:** 当 offsetL 为负值（左侧收缩）或 offsetT 为负值（顶部收缩）时，`copyW` 或 `copyH` 可能为负数，导致 `subarray(srcOff, srcOff + negative)` 返回空数组而无报错。
**Why it happens:** `Math.min(oldW - srcX0, newW - dstX0)` 当 srcX0 = oldW 或 dstX0 = newW 时结果为 0，当超出时为负数。
**How to avoid:** 在循环前检查 `if (copyW <= 0 || copyH <= 0) return;`（全部内容被裁切，结果为纯透明画布，此为合法操作）。

### Pitfall 7: Web_ui.html 重置函数遗漏新按钮
**What goes wrong:** 处理成功后「在编辑器中打开」显示，但上传新图片后按钮残留（仍指向旧图片数据）。
**Why it happens:** `resetOutput()` 函数（line 336）隐藏了 `dlExact`/`dlScaled`，但未隐藏新的 `btnOpenEditor`。
**How to avoid:** 在 `resetOutput()` 中同步添加 `btnOpenEditor.style.display = 'none'`，并清空 onclick handler 或依赖 `currentPixelArtB64` 更新。

---

## Code Examples

### 整数倍缩放下载（浏览器内置最近邻）
```javascript
// Source: 浏览器 Canvas API — imageSmoothingEnabled=false 强制最近邻插值
function createScaledCanvas(pixels, width, height, scale) {
  const src = document.createElement('canvas');
  src.width = width; src.height = height;
  src.getContext('2d').putImageData(new ImageData(pixels.slice(), width, height), 0, 0);

  const dst = document.createElement('canvas');
  dst.width = width * scale; dst.height = height * scale;
  const dctx = dst.getContext('2d');
  dctx.imageSmoothingEnabled = false;   // 最近邻，保持像素艺术锐利边缘
  dctx.drawImage(src, 0, 0, dst.width, dst.height);
  return dst;
}
```

### TypedArray 行批量复制（Canvas Size 像素搬运）
```javascript
// Source: MDN TypedArray.prototype.set() — O(copyW) per row via memcpy path
const copyW = Math.min(oldW - srcX0, newW - dstX0);
const copyH = Math.min(oldH - srcY0, newH - dstY0);
if (copyW > 0 && copyH > 0) {
  for (let row = 0; row < copyH; row++) {
    const srcOff = ((srcY0 + row) * oldW + srcX0) * 4;
    const dstOff = ((dstY0 + row) * newW + dstX0) * 4;
    newPixels.set(oldPixels.subarray(srcOff, srcOff + copyW * 4), dstOff);
  }
}
```

### selection-canvas 坐标转换（zoom-container → canvas-area 相对坐标）
```javascript
// Source: 直接从现有 selCanvas 用法推导（initCanvases line 1534-1542）
function getZoomContainerScreenOffset() {
  const zcRect  = document.getElementById('zoom-container').getBoundingClientRect();
  const caRect  = document.getElementById('canvas-area').getBoundingClientRect();
  return {
    left: zcRect.left - caRect.left,
    top:  zcRect.top  - caRect.top,
  };
}
```

---

## Anti-Patterns to Avoid

- **读取 canvas 像素作为下载源：** `canvas.getContext('2d').getImageData()` 受预乘 alpha 污染，必须通过 `EditorState.pixels` + 新 off-screen canvas 生成下载内容。
- **在 canvas-size 参数输入框 `input` 事件中每帧重绘全量参考线时不先 clearRect：** 旧参考线残留导致叠加混乱。每次更新前 `selCtx.clearRect(0, 0, selCanvas.width/dpr, selCanvas.height/dpr)`。
- **`setActiveTool('canvas-size')` 而不在 panelIds 数组中注册：** 切换其他工具时 canvas-size 参数面板不会被隐藏，导致多个参数面板同时可见。
- **Apply 后不调用 `centerCanvas()` 内部的 `initCanvases`：** 画布尺寸变了但 #zoom-scroll-inner 尺寸未更新，scroll 范围错误。（`initCanvases` 已调用 `centerCanvas()`，只要通过 `initCanvases` 重建即可。）

---

## Open Questions

1. **参考线绘制时机：zoom 改变时**
   - What we know: `_onZoomChanged` 钩子在 `applyZoom` 内调用，目前仅绑定了 transform overlay 的重绘。
   - What's unclear: Canvas Size 模式下 zoom 变化时参考线需要跟随更新，但 Canvas Size 不是 DOMContentLoaded 内定义的工具，`_onZoomChanged` 可能需要多播。
   - Recommendation: 在 `_onZoomChanged` 改为数组多播（类似 EditorState._listeners），或在 Canvas Size 激活时替换 `_onZoomChanged`，退出时恢复（保存前值）。

2. **扩张区棋盘格颜色区分的实现粒度**
   - What we know: CONTEXT.md 要求扩张区显示「偏浅偏蓝」棋盘格，与原画布区分。
   - What's unclear: 这是通过 selection-canvas 叠加半透明蓝矩形，还是修改 zoom-container 背景色，还是其他方式。
   - Recommendation: 最简方案——在 selection-canvas 上用 `rgba(100, 140, 220, 0.15)` 填充扩张矩形区域（在参考线绘制函数中同时处理）。不修改 DOM 结构，Apply 后自动随参考线清除。

3. **DOMContentLoaded 事件绑定的重构需求**
   - What we know: 当前 `loadPlaceholderImage().then(...)` 把 pixel-inspector 事件绑定写在 then 回调内，是一次性操作。
   - What's unclear: 如果改成 `showDropZone()` + 用户拖入文件后再 `loadImageFromB64`，需要在加载完成后再次绑定相同事件，或提前绑定（当 EditorState.pixels 为 null 时 guard 拦截）。
   - Recommendation: 将 pixel-inspector 事件绑定和工具初始化提取出 `loadPlaceholderImage().then` 回调，改为在 DOMContentLoaded 顶层直接绑定（用 `if (!EditorState.pixels) return;` guard），这样两条路径（sessionStorage 加载和直接上传）都能使用同一套事件处理器。

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 从 server 端下载处理后图片 | 完全客户端 canvas.toBlob() | Phase 4 之后明确 | 无 Flask 往返，即时触发，无带宽消耗 |
| `<a href="data:...">` 大文件下载 | canvas.toBlob() + URL.createObjectURL() | 现代浏览器最佳实践 | 避免大 data URL 导致的主线程阻塞 |

---

## Sources

### Primary (HIGH confidence)
- `editor.html`（直接代码分析，4263 行）— setActiveTool、tool-settings-* 模式、initCanvases、getEditorImageB64、selCanvas overlay 绘制、pushHistory
- `web_ui.html`（直接代码分析，387 行）— resetOutput、selectedFile、currentPixelArtB64、dlExact/dlScaled 插入点
- `web_app.py`（直接代码分析，566 行）— /editor 路由已存在（line 351-353）
- `CONTEXT.md`（07-CONTEXT.md）— 所有用户决策的权威来源
- `CLAUDE.md` — 架构约束、Canvas 规则、EditorState 规范

### Secondary (MEDIUM confidence)
- MDN Web API（via training knowledge，2025 年前）— sessionStorage QuotaExceededError、canvas.toBlob()、URL.createObjectURL()、imageSmoothingEnabled、TypedArray.subarray/set

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 无外部依赖，全部浏览器内置 API
- Architecture: HIGH — 基于直接代码分析，所有插入点精确定位到行号
- Pitfalls: HIGH — 来自对现有代码模式的严格推导 + CLAUDE.md Known Issues

**Research date:** 2026-03-04
**Valid until:** 与代码库同步有效（editor.html 无外部依赖，无版本更新问题）
