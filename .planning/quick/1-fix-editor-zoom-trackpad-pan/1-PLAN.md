---
phase: quick-1-fix-editor-zoom-trackpad-pan
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - editor.html
autonomous: true
requirements: []

must_haves:
  truths:
    - "触控板双指滚动平移画布，不触发缩放"
    - "触控板双指捏合/展开缩放画布，以指针位置为中心"
    - "缩放是连续浮点数（如 1.25x、3.0x），不是离散档位"
    - "zoom-display 显示一位小数（如 4.0x），在整数时显示整数"
    - "按钮和键盘快捷键保持可用，以视口中心为缩放基准"
  artifacts:
    - path: "editor.html"
      provides: "修复后的 wheel 事件处理和 applyZoom 函数"
      contains: "e.ctrlKey 分支区分捏合与滚动"
  key_links:
    - from: "wheel event handler"
      to: "applyZoom / scrollLeft+scrollTop"
      via: "e.ctrlKey 判断分流"
      pattern: "if.*ctrlKey.*applyZoom|scrollLeft"
---

<objective>
修复 editor.html 中三个互相关联的缩放/平移问题：触控板双指滚动应平移画布（而非缩放），捏合应缩放，且缩放为无极浮点数而非离散档位。

Purpose: 让触控板用户拥有符合直觉的导航体验（等同于 Figma / Aseprite 的手感）。
Output: editor.html 中 applyZoom 和 wheel 事件处理器的替换实现。
</objective>

<execution_context>
@/Users/calling/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@/Users/calling/perfectPixel_ver1.1/CLAUDE.md
@/Users/calling/perfectPixel_ver1.1/editor.html

<!-- 当前实现摘要（执行时无需重新搜索）：

applyZoom(newZoom, pivotClientX, pivotClientY) — 行 400-412
  - 使用 CSS transform: scale(newZoom) 作用于 #zoom-container (正确)
  - newZoom 当前限制为 Math.max(1, Math.min(64, newZoom)) — 整数
  - 通过 area.scrollLeft/scrollTop 保持 pivot 点不动 (逻辑正确，需保留)
  - zoom-display 显示 newZoom + 'x' (整数)

wheel 事件处理器 — 行 477-482
  - passive:false (必须保留)
  - 未区分 ctrlKey (捏合) 和普通滚动 (平移)
  - 使用离散 step: zoom<4→1, zoom<16→2, else→4

按钮/键盘 — 行 485-510
  - 也使用同样的离散 step
  - pivot = canvas area 中心 (正确，保留)

关键约束 (CLAUDE.md):
  - Zoom via CSS transform ONLY — NEVER ctx.setTransform
  - EditorState.zoom 是缩放的单一来源
  - #canvas-area 是有 overflow:scroll 的容器，scrollLeft/scrollTop 控制平移

-->
</context>

<tasks>

<task type="auto">
  <name>Task 1: 修复 wheel 事件处理 — 区分捏合缩放与双指平移</name>
  <files>editor.html</files>
  <action>
定位文件第 477-482 行的 wheel 事件处理器，将其完整替换为以下逻辑：

```javascript
// Wheel / trackpad events (passive:false required for preventDefault)
canvasArea.addEventListener('wheel', e => {
  e.preventDefault();

  // Trackpad pinch (and Ctrl+scroll) → zoom
  // Browser synthesizes pinch as wheel event with e.ctrlKey = true
  if (e.ctrlKey) {
    // deltaY is negative when expanding (zoom in), positive when pinching (zoom out)
    // Use multiplicative factor for smooth continuous zoom
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    applyZoom(EditorState.zoom * factor, e.clientX, e.clientY);
    return;
  }

  // Two-finger scroll → pan (translate scroll position)
  // deltaMode 0 = pixels (trackpad), 1 = lines, 2 = pages
  const pixelDeltaX = e.deltaMode === 0 ? e.deltaX : e.deltaX * 20;
  const pixelDeltaY = e.deltaMode === 0 ? e.deltaY : e.deltaY * 20;
  canvasArea.scrollLeft += pixelDeltaX;
  canvasArea.scrollTop  += pixelDeltaY;
}, { passive: false });
```

不要删除或移动其下方的按钮/键盘事件监听器（行 484-511）。
  </action>
  <verify>
在浏览器中打开 http://localhost:5010/editor，确认：
- 触控板双指滚动：画布平移，zoom-display 数字不变
- 触控板双指捏合：画布以指针为中心缩放，zoom-display 数字变化
  </verify>
  <done>wheel 事件监听器用 e.ctrlKey 分支替换完毕，双指滚动不再触发缩放</done>
</task>

<task type="auto">
  <name>Task 2: 改为无极浮点缩放 — applyZoom 和按钮/键盘快捷键</name>
  <files>editor.html</files>
  <action>
**Step A — 修改 applyZoom 函数（行 400-412）：**

将 zoom 的约束范围放宽到浮点数，并更新 zoom-display 格式：

```javascript
function applyZoom(newZoom, pivotClientX, pivotClientY) {
  const oldZoom = EditorState.zoom;
  // Clamp to [0.25, 64], allow fractional values for smooth zoom
  newZoom = Math.max(0.25, Math.min(64, newZoom));
  const area  = document.getElementById('canvas-area');
  const rect  = area.getBoundingClientRect();
  const pivotX = pivotClientX - rect.left + area.scrollLeft;
  const pivotY = pivotClientY - rect.top  + area.scrollTop;
  area.scrollLeft = pivotX * (newZoom / oldZoom) - (pivotClientX - rect.left);
  area.scrollTop  = pivotY * (newZoom / oldZoom) - (pivotClientY - rect.top);
  EditorState.zoom = newZoom;
  document.getElementById('zoom-container').style.transform = `scale(${newZoom})`;
  // Display: show one decimal place, drop trailing zero (e.g. "4.0x" → "4x", "1.25x")
  const display = Number.isInteger(newZoom) ? newZoom + 'x' : newZoom.toFixed(1) + 'x';
  document.getElementById('zoom-display').textContent = display;
}
```

**Step B — 修改按钮事件处理器（行 485-494）改用乘法系数：**

将四个按钮/键盘处理器中的 `step` 计算逻辑替换为：

```javascript
// Zoom In button
document.getElementById('btn-zoom-in').addEventListener('click', () => {
  const rect = canvasArea.getBoundingClientRect();
  applyZoom(EditorState.zoom * 1.25, rect.left + rect.width / 2, rect.top + rect.height / 2);
});
// Zoom Out button
document.getElementById('btn-zoom-out').addEventListener('click', () => {
  const rect = canvasArea.getBoundingClientRect();
  applyZoom(EditorState.zoom / 1.25, rect.left + rect.width / 2, rect.top + rect.height / 2);
});
```

**Step C — 修改键盘快捷键（行 496-511）同样改用乘法系数：**

```javascript
document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea')) return;
  if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
    e.preventDefault();
    const rect = canvasArea.getBoundingClientRect();
    applyZoom(EditorState.zoom * 1.25, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '-') {
    e.preventDefault();
    const rect = canvasArea.getBoundingClientRect();
    applyZoom(EditorState.zoom / 1.25, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
});
```

注意：初始缩放在 EditorState 中定义为 `zoom: 4`，保持不变。
  </action>
  <verify>
1. 点击 + 按钮：zoom 从 4x → 5x（显示 "5x"）
2. 触控板捏合展开：zoom 平滑变化为如 "4.4x"、"4.9x" 等浮点数
3. 缩放到 0.3x 附近不低于 0.25x（下限生效）
4. 缩放到接近 64x 不超过 64x（上限生效）
5. 缩放中心跟随指针位置（画布在鼠标下方保持静止）
  </verify>
  <done>applyZoom 支持浮点缩放范围 [0.25, 64]，按钮/键盘使用 ×1.25 乘法系数，zoom-display 显示格式正确</done>
</task>

</tasks>

<verification>
完整验证流程（在 http://localhost:5010/editor 中）：

1. 触控板双指向上/下/左/右滑动 → 画布平移，无缩放
2. 触控板双指捏合 → 缩小；展开 → 放大；zoom-display 显示浮点数（如 3.6x）
3. 点击 + 按钮三次：4x → 5x → 6.25x → 7.8x（每次 ×1.25）
4. Ctrl+= / Ctrl+- 键盘快捷键同样产生平滑缩放
5. 缩放时检查 JavaScript 控制台（browser_console_messages），无错误
</verification>

<success_criteria>
- 双指滚动仅平移，不缩放
- 捏合/展开以指针为中心无极缩放
- 所有现有功能（按钮、键盘、Pixel Inspector）仍正常工作
- 控制台无新增 JS 错误
</success_criteria>

<output>
此为 quick fix，无需创建 SUMMARY.md。
修复完成后直接在浏览器验证即可。
</output>
