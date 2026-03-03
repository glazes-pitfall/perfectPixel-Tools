---
phase: quick-4-3-lab
plan: 4
type: execute
wave: 1
depends_on: []
files_modified: [editor.html]
autonomous: true
requirements: [PAL-LAB-01]
must_haves:
  truths:
    - "左侧面板「映射模式」区域显示 3 个 radio：向量匹配 / 感知匹配 / 色卡替换"
    - "选择「感知匹配」后点击应用色卡，颜色映射使用 CIE LAB 距离（在 JS 内完成，无 Flask 调用）"
    - "选择「色卡替换」后点击应用色卡，async 调用 Flask /api/apply-palette?mode=swap，透明像素在 JS 侧过滤发送、结果写回后保留原透明区"
    - "选择「向量匹配」行为与改动前完全一致（现有 RGB 欧氏距离实现不变）"
    - "三种模式应用后均执行 flushPixels() + pushHistory()，操作可通过 Cmd+Z 撤销"
  artifacts:
    - path: "editor.html"
      provides: "映射模式 UI + LAB 辅助函数 + 多模式 applyPalette"
  key_links:
    - from: "映射模式 radio #mappingMode"
      to: "applyPalette()"
      via: "document.querySelector('input[name=mappingMode]:checked').value"
    - from: "applyPalette() swap 分支"
      to: "/api/apply-palette"
      via: "fetch POST FormData {image, palette, mode='swap'}"
    - from: "Flask 返回 output b64"
      to: "EditorState.pixels"
      via: "Image→offscreen canvas→getImageData；透明像素从原 pixels 恢复"
---

<objective>
恢复并完整实现应用色卡的三种映射模式（向量匹配 / 感知匹配 / 色卡替换）。

Phase 04.1-02 删除 `#palette-result-panel` 时将映射模式 radio UI 一并删除，导致
LAB 感知匹配和色卡替换模式功能完全丢失。本计划在单文件 editor.html 内完成修复：
- 恢复 HTML radio UI（CSS 样式已完整保留，无需新增样式）
- 新增 rgbToLab / nearestPaletteColorLab JS 辅助函数（LAB 感知匹配纯 JS 实现）
- 将 applyPalette() 改为 async，按 mode 分三路执行

Purpose: 让用户能使用最适合其图像的映射算法，特别是 LAB 感知匹配（人眼感知更准确）
         和色卡替换（防止相近色扎堆映射到同一目标色）。
Output: 更新后的 editor.html，映射模式功能完整可用。
</objective>

<execution_context>
@/Users/calling/.claude/get-shit-done/workflows/execute-plan.md
@/Users/calling/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/4-3-lab/4-PLAN.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: 恢复映射模式 HTML + 新增 LAB 辅助函数</name>
  <files>editor.html</files>
  <action>
**步骤 1 — 恢复映射模式 HTML UI**

在 editor.html 中找到注释 `<!-- Export -->` 所在行（约第 567 行），在其**正上方**插入以下 HTML 块（CSS 类已存在，直接使用）：

```html
            <!-- Mapping mode -->
            <div>
              <div class="section-label">映射模式</div>
              <div class="mode-group">
                <label class="mode-option">
                  <input type="radio" name="mappingMode" value="vector" checked>
                  <div>
                    <div class="mode-label">向量匹配</div>
                    <div class="mode-desc">RGB 欧氏距离，最直接</div>
                  </div>
                </label>
                <label class="mode-option">
                  <input type="radio" name="mappingMode" value="perceptual">
                  <div>
                    <div class="mode-label">感知匹配</div>
                    <div class="mode-desc">LAB 色彩空间，更符合人眼感知</div>
                  </div>
                </label>
                <label class="mode-option">
                  <input type="radio" name="mappingMode" value="swap">
                  <div>
                    <div class="mode-label">色卡替换</div>
                    <div class="mode-desc">先量化图像生成中间调色板，防止相近色扎堆映射</div>
                  </div>
                </label>
              </div>
            </div>
```

**步骤 2 — 新增 LAB 辅助函数**

在函数 `nearestPaletteColor(...)` 的定义块（约第 1808 行）之后，紧接着插入以下两个辅助函数：

```javascript
    // ── PAL-LAB: sRGB → CIE LAB 转换辅助函数 ─────────────────────────────
    function rgbToLab(r, g, b) {
      // sRGB → linear
      let R = r / 255, G = g / 255, B = b / 255;
      R = R > 0.04045 ? Math.pow((R + 0.055) / 1.055, 2.4) : R / 12.92;
      G = G > 0.04045 ? Math.pow((G + 0.055) / 1.055, 2.4) : G / 12.92;
      B = B > 0.04045 ? Math.pow((B + 0.055) / 1.055, 2.4) : B / 12.92;
      // linear → XYZ (D65)
      const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
      const Y = (R * 0.2126729 + G * 0.7151522 + B * 0.0721750) / 1.00000;
      const Z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / 1.08883;
      // XYZ → LAB
      const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);
      const L = 116 * f(Y) - 16;
      const A = 500 * (f(X) - f(Y));
      const Bv = 200 * (f(Y) - f(Z));
      return [L, A, Bv];
    }

    // ── PAL-LAB: 最近色卡色匹配（CIE LAB 欧氏距离）─────────────────────
    function nearestPaletteColorLab(r, g, b, palette) {
      const [L1, A1, B1] = rgbToLab(r, g, b);
      let bestIdx = 0, bestDist = Infinity;
      for (let i = 0; i < palette.length; i++) {
        const [L2, A2, B2] = rgbToLab(palette[i][0], palette[i][1], palette[i][2]);
        const dL = L1 - L2, dA = A1 - A2, dB = B1 - B2;
        const dist = dL*dL + dA*dA + dB*dB;
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      }
      return palette[bestIdx];  // [r, g, b]
    }
```

注意：LAB 转换不涉及 alpha，仅在不透明像素上调用，与现有逻辑一致。
  </action>
  <verify>
    在浏览器中打开 http://localhost:5010/editor，左侧面板「导出」区域上方应出现「映射模式」
    区域，包含三个 radio 按钮（向量匹配 / 感知匹配 / 色卡替换）。
    控制台无 JS 语法错误：`browser_console_messages(level="error")` 应返回空。
  </verify>
  <done>
    三个 radio 按钮可见且可点击，`rgbToLab` 和 `nearestPaletteColorLab` 函数在 JS 全局
    作用域中定义（可通过 browser_evaluate 验证），无 JS 错误。
  </done>
</task>

<task type="auto">
  <name>Task 2: 将 applyPalette() 改为 async 多模式实现</name>
  <files>editor.html</files>
  <action>
将 editor.html 中约第 1819 行开始的 `applyPalette()` 函数替换为以下 async 版本：

```javascript
    // ── PAL-04: 破坏性应用色卡 — 三模式（vector / perceptual / swap）────────
    async function applyPalette() {
      if (!EditorState.pixels || currentPalette.length === 0) return;
      const mode = (document.querySelector('input[name="mappingMode"]:checked') || {value: 'vector'}).value;
      const px = EditorState.pixels;
      const pal = currentPalette;

      if (mode === 'vector') {
        // 现有 RGB 欧氏距离实现（不变）
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] <= 127) {
            px[i] = 0; px[i+1] = 0; px[i+2] = 0; px[i+3] = 0;
          } else {
            const [nr, ng, nb] = nearestPaletteColor(px[i], px[i+1], px[i+2], pal);
            px[i] = nr; px[i+1] = ng; px[i+2] = nb; px[i+3] = 255;
          }
        }
        flushPixels();
        pushHistory();
        palShowStatus('色卡已应用（向量匹配）', 'success');

      } else if (mode === 'perceptual') {
        // LAB 距离 — 纯 JS，无 Flask 调用
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] <= 127) {
            px[i] = 0; px[i+1] = 0; px[i+2] = 0; px[i+3] = 0;
          } else {
            const [nr, ng, nb] = nearestPaletteColorLab(px[i], px[i+1], px[i+2], pal);
            px[i] = nr; px[i+1] = ng; px[i+2] = nb; px[i+3] = 255;
          }
        }
        flushPixels();
        pushHistory();
        palShowStatus('色卡已应用（感知匹配）', 'success');

      } else {
        // swap 模式：调 Flask /api/apply-palette?mode=swap
        // JS 侧 alpha 过滤：只发送不透明像素（与 generateBtn 相同方案）
        palShowStatus('正在处理（色卡替换）…', 'info');
        try {
          // 1. 将当前像素写入 offscreen canvas，导出 PNG base64（alpha 通道完整保留）
          const offscreen = document.createElement('canvas');
          offscreen.width = EditorState.width;
          offscreen.height = EditorState.height;
          const offCtx = offscreen.getContext('2d', { alpha: true });
          offCtx.putImageData(new ImageData(px.slice(), EditorState.width, EditorState.height), 0, 0);
          const imageB64 = offscreen.toDataURL('image/png').split(',')[1];

          // 2. 记录原始 alpha 掩码，用于事后恢复透明像素
          const origAlpha = new Uint8Array(EditorState.width * EditorState.height);
          for (let i = 0; i < px.length; i += 4) {
            origAlpha[i >> 2] = px[i + 3];
          }

          // 3. 调用 Flask（发送完整 RGBA PNG，Flask 内部 b64_to_rgb 会合成黑色背景，但
          //    swap 量化只关心颜色分布而非 alpha，结果 RGB 由 JS 恢复 alpha 覆盖）
          const fd = new FormData();
          fd.append('image', imageB64);
          fd.append('palette', JSON.stringify(pal));
          fd.append('mode', 'swap');
          const resp = await fetch('/api/apply-palette', { method: 'POST', body: fd });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = await resp.json();
          if (data.error) throw new Error(data.error);

          // 4. 解码返回的 RGB 图像
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve; img.onerror = reject;
            img.src = 'data:image/png;base64,' + data.output;
          });
          const resultCanvas = document.createElement('canvas');
          resultCanvas.width = EditorState.width;
          resultCanvas.height = EditorState.height;
          const rCtx = resultCanvas.getContext('2d', { willReadFrequently: true });
          rCtx.drawImage(img, 0, 0);
          const resultData = rCtx.getImageData(0, 0, EditorState.width, EditorState.height).data;

          // 5. 写回 EditorState.pixels，保留原透明像素
          for (let i = 0; i < px.length; i += 4) {
            const a = origAlpha[i >> 2];
            if (a <= 127) {
              px[i] = 0; px[i+1] = 0; px[i+2] = 0; px[i+3] = 0;
            } else {
              px[i] = resultData[i]; px[i+1] = resultData[i+1]; px[i+2] = resultData[i+2]; px[i+3] = 255;
            }
          }
          flushPixels();
          pushHistory();
          palShowStatus('色卡已应用（色卡替换）', 'success');
        } catch (err) {
          palShowStatus('色卡替换失败：' + err.message, 'error');
        }
      }
    }
```

**注意事项：**
- `document.querySelector('input[name="mappingMode"]:checked')` 依赖 Task 1 添加的 HTML。
  若 Task 1 未完成，`|| {value: 'vector'}` 兜底保证向量匹配仍可工作。
- swap 模式读取 `resultData` 来自 offscreen canvas 的 `getImageData`（而非 `pixel-canvas`），
  这是 offscreen canvas 所以不触犯「不得从 pixel-canvas 读取」规则。
- `px.slice()` 传入 ImageData 避免共享引用导致意外修改。
  </action>
  <verify>
    1. 加载一张带透明像素的图像到编辑器。
    2. 生成一个色卡（或手动添加几个颜色）。
    3. 分别选择三种模式点击「应用色卡」：
       - 向量匹配：立即同步执行，状态栏显示「色卡已应用（向量匹配）」
       - 感知匹配：立即同步执行，状态栏显示「色卡已应用（感知匹配）」
       - 色卡替换：async 执行，状态栏先显示「正在处理」再显示「色卡已应用（色卡替换）」
    4. 三种模式应用后，Cmd+Z 均能撤销。
    5. 透明区域（alpha=0）在三种模式下均保持透明不变。
    控制台无报错：browser_console_messages(level="error") 应返回空。
  </verify>
  <done>
    三种映射模式均可正常执行；perceptual 模式相比 vector 模式对色彩更接近的颜色有不同的
    映射结果（可用色卡对比验证）；swap 模式成功调用 Flask 并返回结果；透明像素完整保留；
    所有模式的操作均可通过 Cmd+Z 撤销一步。
  </done>
</task>

</tasks>

<verification>
1. 打开 http://localhost:5010/editor
2. browser_snapshot() 确认「映射模式」区域在导出区域上方存在，含 3 个 radio
3. browser_console_messages(level="error") 返回空（无 JS 语法错误）
4. 选择感知匹配 → 应用色卡 → 检查 canvas 变化（LAB 映射结果与 vector 应有肉眼可见差异）
5. 选择色卡替换 → 应用色卡 → 网络请求包含 POST /api/apply-palette mode=swap
6. Cmd+Z 能撤销各模式的应用操作
</verification>

<success_criteria>
- 左侧面板「导出」区域上方显示「映射模式」UI，3 个 radio 可点击
- 向量匹配：现有行为不变，JS 同步执行
- 感知匹配：JS 内 LAB 距离计算，无 Flask 调用，JS 同步执行
- 色卡替换：async 调用 Flask mode=swap，透明像素通过 JS 侧 origAlpha 掩码恢复
- 三种模式均 flushPixels() + pushHistory()，Cmd+Z 可撤销
- 无 JS 运行时错误
</success_criteria>

<output>
完成后在 .planning/quick/4-3-lab/ 目录下创建 4-SUMMARY.md，记录：
- 修改的行号范围（HTML 插入位置、函数替换位置）
- swap 模式 alpha 恢复方案说明（origAlpha 掩码）
- LAB 辅助函数是否按预期产生与 vector 不同的映射结果
</output>
