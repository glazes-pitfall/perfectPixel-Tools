---
phase: quick-7
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [editor.html]
autonomous: true
requirements: [PAL-UI-REFINEMENTS]
must_haves:
  truths:
    - "#paletteBody 随 #left-scroll 整体滚动，无内部独立滚动条"
    - "「双击色块可更改颜色」以 ⓘ tooltip 形式展示，不占用布局空间"
    - "combobox 行（input + ▼ + 💾）外框统一、高度一致"
    - "已保存色卡列表项 hover 时显示 ✕ 删除按钮，点击可删除"
    - "生成色卡成功后 paletteName 输入框自动重置为「未命名色卡」"
  artifacts:
    - path: editor.html
      provides: "所有 5 项 UI 细节调整"
  key_links:
    - from: ".pal-scroll-area"
      to: "#left-scroll"
      via: "删除 overflow-y:auto 与 flex:1"
    - from: "refreshSavedDropdown"
      to: ".pal-del-btn"
      via: "每个列表项追加删除按钮 DOM 节点"
---

<objective>
对 Phase 4.2 实现后的 editor.html 色卡面板进行 5 项 UI 细节精修，全部集中在单一文件 editor.html。

Purpose: 消除色卡面板中双层滚动、冗余说明文字、combobox 外观不统一、缺少删除操作、生成后名称残留等体验问题。
Output: 更新后的 editor.html，通过浏览器截图验证 5 项改动均生效。
</objective>

<execution_context>
@/Users/calling/.claude/get-shit-done/workflows/execute-plan.md
@/Users/calling/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/calling/perfectPixel_ver1.1/.planning/STATE.md
@/Users/calling/perfectPixel_ver1.1/editor.html
</context>

<interfaces>
<!-- 执行者需要了解的现有结构，从 editor.html 提取 -->

CSS 现状（约第 234–270 行）：
```css
.pal-scroll-area {
  flex: 1;
  overflow-y: auto;    /* 改动1：删除这两行 */
  /* ... */
  gap: 10px;
}
.pal-sticky-bottom {
  flex-shrink: 0;      /* 改动1：删除此行，改为普通 flex 项目 */
  padding: 10px 12px;
}
.combobox-row {
  display: flex; gap: 4px; align-items: center;   /* 改动3：重构 */
}
.combobox-row input[type=text] {
  flex: 1; padding: 5px 8px; border-radius: 6px;
  border: 1px solid var(--border); /* 改动3：统一到外框 */
}
```

HTML 现状（约第 547 行）：
```html
<div style="font-size:11px;color:var(--text-muted);margin:3px 0 5px;">双击色块可更改颜色</div>
```

HTML 现状（约第 557–561 行）：
```html
<div class="combobox-row">
  <input type="text" id="paletteName" placeholder="未命名色卡">
  <button class="btn btn-ghost combobox-drop-btn" id="palDropBtn" title="选择/上传色卡">▼</button>
  <button class="btn btn-ghost" id="savePaletteBtn" title="保存色卡">💾</button>
</div>
```

JS 现状 — generateBtn 成功路径（约第 2736–2737 行）：
```javascript
setCurrentPalette(data.palette);
palShowStatus(`色卡已生成：${data.count} 色（${ALGO_NAMES[algo] || algo}）`, 'success');
// 改动5：在此之后插入 paletteName 重置
```

JS 现状 — refreshSavedDropdown keys.forEach 块（约第 1784–1813 行）：
```javascript
div.appendChild(nameEl);
div.appendChild(swatchesEl);
div.addEventListener('click', () => { ... });
opts.appendChild(div);
// 改动4：在 div.appendChild(nameEl) 之前设置 position:relative，
// 在 opts.appendChild(div) 之前追加 .pal-del-btn
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: CSS — 移除内部滚动 + 重构 combobox 外框</name>
  <files>/Users/calling/perfectPixel_ver1.1/editor.html</files>
  <action>
**改动 1 — 移除 .pal-scroll-area 内部滚动：**
- 找到 `.pal-scroll-area { flex: 1; overflow-y: auto; ... }` CSS 块
- 删除 `flex: 1;` 和 `overflow-y: auto;` 两行（保留其余样式如 `display:flex; flex-direction:column; gap:10px;`）
- 找到 `.pal-sticky-bottom { flex-shrink: 0; padding: 10px 12px; }` 块
- 删除 `flex-shrink: 0;` 行（`padding` 保留）
- 无需修改 HTML 结构，仅 CSS 层面去掉约束

**改动 3 — combobox 行统一外框：**
- 删除现有 `.combobox-row`、`.combobox-row input[type=text]`、`.combobox-row input[type=text]:focus` 以及 `.combobox-drop-btn` 的全部独立样式
- 替换为以下新 CSS（仿 #hex-group 统一外框模式）：
```css
.combobox-row {
  display: flex;
  border: 1px solid var(--border);
  border-radius: var(--radius, 6px);
  overflow: hidden;
  height: 30px;
}
.combobox-row input[type=text] {
  flex: 1;
  padding: 0 8px;
  border: none;
  background: var(--surface2);
  color: var(--text);
  font-size: 13px;
  min-width: 0;
  outline: none;
}
.combobox-row input[type=text]:focus {
  background: var(--surface3, var(--surface2));
}
.combobox-drop-btn {
  width: 28px;
  flex-shrink: 0;
  border: none;
  border-left: 1px solid var(--border);
  border-radius: 0;
  background: var(--surface2);
  color: var(--text);
  font-size: 10px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.combobox-drop-btn:hover { background: var(--surface3, #555); }
/* savePaletteBtn 在 combobox-row 内时同样无独立 border-radius */
.combobox-row .btn {
  border-left: 1px solid var(--border);
  border-radius: 0;
  width: 28px;
  flex-shrink: 0;
  padding: 0;
  display: flex; align-items: center; justify-content: center;
}
```
- HTML 结构无需改动（input + palDropBtn + savePaletteBtn 保持原有顺序）

**改动 2 — 添加 .swatch-info-icon CSS：**
- 在样式块中添加：
```css
.swatch-info-icon {
  font-size: 11px;
  color: var(--text-muted);
  cursor: default;
  opacity: 0.6;
  user-select: none;
}
.swatch-info-icon:hover { opacity: 1; }
```

**改动 4 — 添加 .pal-del-btn CSS：**
- 在样式块中添加：
```css
.pal-del-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  display: none;
  color: var(--error, #e55);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  padding: 0 4px;
  line-height: 1;
}
.custom-option:hover .pal-del-btn { display: inline; }
.custom-option { position: relative; }
```
（注意 `.custom-option { position: relative; }` 如果已存在则只补充，不重复声明）
  </action>
  <verify>在浏览器中打开 http://localhost:5010/editor，加载图片后展开色卡面板：滚动整个左侧栏时色卡面板随之移动且无嵌套滚动条；combobox 三控件共享一个统一边框。</verify>
  <done>CSS 层面 5 项改动的样式规则全部就位；.pal-scroll-area 无 overflow-y:auto；combobox-row 采用统一外框</done>
</task>

<task type="auto">
  <name>Task 2: HTML + JS — tooltip 图标、删除按钮、生成后重置名称</name>
  <files>/Users/calling/perfectPixel_ver1.1/editor.html</files>
  <action>
**改动 2 — 替换「双击色块」说明文字为 tooltip 图标（HTML）：**
- 找到约第 534 行 `<span class="section-label" style="margin:0;">当前色卡</span>`
- 紧跟其后（同一行或下一行）将：
  ```html
  <div style="font-size:11px;color:var(--text-muted);margin:3px 0 5px;">双击色块可更改颜色</div>
  ```
  **删除**，并在 `当前色卡</span>` 后面（还在 `.swatches-label` 内层 flex 容器里，与「N 色」+「导出▼」并排）插入：
  ```html
  <span class="swatch-info-icon" title="双击色块可更改颜色">ⓘ</span>
  ```
  位置：`<span class="section-label" ...>当前色卡</span>` 与 `<div style="display:flex...">` 之间，或放入右侧 flex div 内紧跟 `swatchCount` 之前 — 以视觉上紧靠「当前色卡」文字为准。

**改动 4 — refreshSavedDropdown 追加删除按钮（JS）：**
- 找到 `keys.forEach(name => {` 循环体内，在 `opts.appendChild(div);` 之前插入：
```javascript
const delBtn = document.createElement('button');
delBtn.className = 'pal-del-btn';
delBtn.textContent = '✕';
delBtn.title = '删除此色卡';
delBtn.addEventListener('click', e => {
  e.stopPropagation();
  const palettes = getSavedPalettes();
  delete palettes[name];
  setSavedPalettes(palettes);
  if (selectedPaletteKey === name) selectedPaletteKey = null;
  refreshSavedDropdown();
});
div.appendChild(delBtn);
```

**改动 5 — 生成成功后重置 paletteName（JS）：**
- 找到 `generateBtn.addEventListener('click', async () => {` 内的成功分支，即：
  ```javascript
  setCurrentPalette(data.palette);
  palShowStatus(`色卡已生成：${data.count} 色...`, 'success');
  ```
- 在 `palShowStatus(...)` 这行之后紧接插入：
  ```javascript
  const paletteNameEl = document.getElementById('paletteName');
  if (paletteNameEl) paletteNameEl.value = '未命名色卡';
  ```
  </action>
  <verify>
1. 色卡面板顶部「当前色卡」标题旁出现 ⓘ 图标，鼠标悬停显示「双击色块可更改颜色」tooltip，原说明文字消失
2. 打开下拉列表（需先保存过至少一条色卡），hover 列表项显示 ✕ 按钮，点击后该条目从列表消失且 localStorage 中已删除
3. 点击「生成色卡」成功后，paletteName 输入框内容变为「未命名色卡」
  </verify>
  <done>HTML 已删除原说明 div 并插入 ⓘ span；refreshSavedDropdown 每条目追加 .pal-del-btn 且删除逻辑正确；generateBtn 成功路径末尾重置 paletteName</done>
</task>

</tasks>

<verification>
1. `python3 web_app.py` 启动，访问 http://localhost:5010/editor，加载任意图片
2. 展开色卡面板，向下滚动左侧栏 — 面板跟随滚动，无内层滚动条
3. 「当前色卡」旁出现 ⓘ，悬停显示 tooltip，无旧说明文字
4. combobox 行三控件共用一个外框，高度统一
5. 保存一条色卡，打开下拉，hover → ✕ 出现，点击 → 条目删除
6. 生成色卡后，名称框显示「未命名色卡」
</verification>

<success_criteria>
- 5 项改动全部在浏览器中可观察验证
- editor.html 单文件，无外部依赖，Flask 仍正常启动
- 无 JS 控制台错误
</success_criteria>

<output>
完成后在 `.planning/quick/7-palette-panel-ui-refinements/` 下创建 `7-SUMMARY.md`，记录每项改动的具体位置（行号）和执行结果。
</output>
