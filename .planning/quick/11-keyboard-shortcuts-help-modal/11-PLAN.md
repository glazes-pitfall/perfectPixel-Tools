---
phase: quick-11
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [editor.html]
autonomous: true
requirements: [QUICK-11]

must_haves:
  truths:
    - "右边栏底部有一个帮助按钮（?）"
    - "点击帮助按钮弹出模态框，展示所有快捷键"
    - "macOS 下显示 Cmd / Option，Windows/Linux 下显示 Ctrl / Alt"
    - "按 Escape 或点击遮罩可关闭模态框"
    - "? 键也可触发/关闭帮助模态框"
  artifacts:
    - path: "editor.html"
      provides: "帮助模态框 HTML/CSS/JS"
      contains: "id=\"shortcut-modal\""
  key_links:
    - from: "#right-panel 帮助按钮"
      to: "#shortcut-modal"
      via: "click → showHelpModal()"
    - from: "document keydown"
      to: "showHelpModal / closeHelpModal"
      via: "e.key === '?'"
---

<objective>
在编辑器右边栏底部添加帮助按钮，点击弹出快捷键参考模态框。
模态框自动检测平台（macOS 用 Cmd/Option，其他平台用 Ctrl/Alt）。

Purpose: 用户无需记忆快捷键，随时查阅；对新用户尤其友好。
Output: editor.html 新增帮助按钮 + 模态框（HTML + CSS + JS，全部内联）
</objective>

<execution_context>
@/Users/calling/.claude/get-shit-done/workflows/execute-plan.md
@/Users/calling/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@editor.html
</context>

<tasks>

<task type="auto">
  <name>Task 1: 添加帮助按钮到右边栏底部 + 模态框 HTML + CSS</name>
  <files>editor.html</files>
  <action>
在 editor.html 中做以下三处修改：

**1. 右边栏底部添加帮助按钮（HTML）**

找到 `<div id="right-panel">` 结束标签 `</div>` 的位置（当前在约 811 行，eyedropper 按钮之后）。
在 `</div>` 前插入：

```html
      <div style="flex:1;"></div><!-- spacer pushes help button to bottom -->
      <button class="tool-btn" id="help-btn" title="快捷键帮助 (?)">?</button>
```

**2. 帮助模态框 HTML（在 #layout 结束 `</div>` 之后，colorPopup div 之前）**

```html
  <!-- Keyboard shortcut help modal -->
  <div id="shortcut-modal" style="display:none; position:fixed; inset:0; z-index:2000;
       background:rgba(0,0,0,.65); backdrop-filter:blur(2px);
       align-items:center; justify-content:center;">
    <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius);
         padding:20px 24px; min-width:320px; max-width:480px; max-height:80vh; overflow-y:auto;
         box-shadow:0 8px 32px rgba(0,0,0,.6); position:relative;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
        <span style="font-size:13px; font-weight:700; color:var(--text);">快捷键参考</span>
        <button id="help-close-btn" style="background:none; border:none; color:var(--text-muted);
             font-size:18px; cursor:pointer; padding:0 4px; line-height:1;">&#10005;</button>
      </div>
      <div id="shortcut-list"></div>
    </div>
  </div>
```

**3. 模态框 CSS（在 `<style>` 块末尾，`</style>` 之前）**

```css
    /* ── Shortcut modal table ─────────────────────────────────────────────── */
    .sc-section-title {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .6px; color: var(--text-muted); margin: 12px 0 6px;
    }
    .sc-section-title:first-child { margin-top: 0; }
    .sc-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,.04);
      font-size: 12px;
    }
    .sc-row:last-child { border-bottom: none; }
    .sc-desc { color: var(--text-muted); }
    .sc-keys { display: flex; gap: 4px; }
    .sc-key {
      background: var(--surface2); border: 1px solid var(--border);
      border-radius: 4px; padding: 1px 6px; font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", monospace;
      color: var(--text); white-space: nowrap;
    }
```
  </action>
  <verify>在浏览器中打开 http://localhost:5010/editor，右边栏底部应出现 "?" 按钮（tool-btn 样式）。点击后模态框区域在 DOM 中存在（即使此步 JS 尚未绑定也可通过开发者工具确认 #shortcut-modal 元素存在）。</verify>
  <done>右边栏出现帮助按钮；#shortcut-modal 和 #shortcut-list 元素在 DOM 中存在；CSS 类 .sc-row/.sc-key 已定义。</done>
</task>

<task type="auto">
  <name>Task 2: 快捷键数据 + 模态框 JS 逻辑（平台检测 + 开关）</name>
  <files>editor.html</files>
  <action>
在现有 `document.addEventListener('keydown', ...)` 块的末尾（约 2852 行，`});` 之后）插入以下 JS 代码段：

```javascript
      // ── Keyboard shortcut help modal ────────────────────────────────────────
      (function() {
        // Platform detection: macOS uses Cmd/Option; others use Ctrl/Alt
        const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
        const mod = isMac ? 'Cmd' : 'Ctrl';
        const alt = isMac ? 'Option' : 'Alt';
        const del = isMac ? 'Delete' : 'Delete';

        // Shortcut data grouped by section
        const SECTIONS = [
          {
            title: '工具',
            rows: [
              { desc: '铅笔',       keys: ['B'] },
              { desc: '橡皮擦',     keys: ['E'] },
              { desc: '油漆桶',     keys: ['G'] },
              { desc: '选框（矩形）', keys: ['M'] },
              { desc: '魔棒',       keys: ['W'] },
              { desc: '吸管（取色）', keys: ['I'] },
              { desc: '取消吸管',   keys: ['Esc'] },
            ],
          },
          {
            title: '历史',
            rows: [
              { desc: '撤销',       keys: [mod, 'Z'] },
              { desc: '重做',       keys: [mod, '⇧Z'] },
            ],
          },
          {
            title: '视图',
            rows: [
              { desc: '放大',       keys: [mod, '+'] },
              { desc: '缩小',       keys: [mod, '−'] },
            ],
          },
          {
            title: '选区',
            rows: [
              { desc: '取消选区',        keys: [mod, 'D'] },
              { desc: '反选',            keys: [mod, '⇧I'] },
              { desc: '删除选区内像素',  keys: [del] },
              { desc: '用前景色填充选区', keys: [alt, del] },
            ],
          },
          {
            title: '其他',
            rows: [
              { desc: '帮助', keys: ['?'] },
            ],
          },
        ];

        function buildShortcutList() {
          const container = document.getElementById('shortcut-list');
          if (!container) return;
          container.innerHTML = '';
          SECTIONS.forEach(section => {
            const title = document.createElement('div');
            title.className = 'sc-section-title';
            title.textContent = section.title;
            container.appendChild(title);
            section.rows.forEach(row => {
              const rowEl = document.createElement('div');
              rowEl.className = 'sc-row';
              const descEl = document.createElement('span');
              descEl.className = 'sc-desc';
              descEl.textContent = row.desc;
              const keysEl = document.createElement('span');
              keysEl.className = 'sc-keys';
              row.keys.forEach(k => {
                const keyEl = document.createElement('kbd');
                keyEl.className = 'sc-key';
                keyEl.textContent = k;
                keysEl.appendChild(keyEl);
              });
              rowEl.appendChild(descEl);
              rowEl.appendChild(keysEl);
              container.appendChild(rowEl);
            });
          });
        }

        function showHelpModal() {
          buildShortcutList();
          const modal = document.getElementById('shortcut-modal');
          if (modal) { modal.style.display = 'flex'; }
        }
        function closeHelpModal() {
          const modal = document.getElementById('shortcut-modal');
          if (modal) { modal.style.display = 'none'; }
        }

        // Button binding
        const helpBtn = document.getElementById('help-btn');
        if (helpBtn) helpBtn.addEventListener('click', showHelpModal);

        // Close button
        const helpCloseBtn = document.getElementById('help-close-btn');
        if (helpCloseBtn) helpCloseBtn.addEventListener('click', closeHelpModal);

        // Click-outside-to-close (click on backdrop overlay)
        const modal = document.getElementById('shortcut-modal');
        if (modal) {
          modal.addEventListener('click', e => {
            if (e.target === modal) closeHelpModal();
          });
        }

        // Keyboard: ? opens modal; Escape closes modal
        document.addEventListener('keydown', e => {
          if (e.target.matches('input, textarea')) return;
          if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            const isOpen = document.getElementById('shortcut-modal')?.style.display === 'flex';
            if (isOpen) closeHelpModal(); else showHelpModal();
          }
          if (e.key === 'Escape') {
            closeHelpModal();
          }
        });
      })();
```

注意事项：
- 整个逻辑包裹在 IIFE 中，不污染全局作用域
- `mod` / `alt` 变量在 IIFE 内计算，确保平台检测仅执行一次
- `Escape` 监听器在关闭模态框后继续传播（不 preventDefault），不影响吸管取消逻辑
- `buildShortcutList()` 每次打开时重新渲染（保持简单，无缓存问题）
  </action>
  <verify>
1. 在 http://localhost:5010/editor 打开编辑器
2. 点击右边栏底部 "?" 按钮 → 模态框出现，列出所有快捷键分组
3. macOS 下：工具区域显示 "B"、"E" 等单键；历史区域显示 "Cmd" + "Z"；选区区域显示 "Option" + "Delete"
4. 按 Escape 键或点击模态框背景 → 模态框关闭
5. 按 ? 键 → 模态框开/关切换（吸管工具激活时 Escape 仍然正确取消吸管，不被 help 的 Escape 干扰）
  </verify>
  <done>
- 右边栏底部 "?" 按钮可见，点击弹出快捷键模态框
- 模态框按分组展示所有快捷键，键名符合当前平台（macOS/Windows）
- Escape / 点击背景 / 关闭按钮均可关闭模态框
- ? 键切换模态框开关
- 无 JS 控制台报错
  </done>
</task>

</tasks>

<verification>
整体验证步骤：
1. `python3 web_app.py` 确保 Flask 在 5010 端口运行
2. 访问 http://localhost:5010/editor
3. 上传任意图片进入编辑器
4. 右边栏底部出现 "?" 按钮（固定在底部，与其他工具按钮样式一致）
5. 点击按钮 → 模态框弹出，内容分5组：工具、历史、视图、选区、其他
6. macOS：Cmd/Option 键名正确；Windows/Linux：Ctrl/Alt 键名正确
7. 三种关闭方式均有效：? 键、Escape 键、点击背景、点击 ✕ 按钮
8. 其他工具（铅笔、橡皮擦等）快捷键和 Undo/Redo 功能在模态框关闭后正常工作
</verification>

<success_criteria>
- 右边栏底部"?"按钮存在且样式与其他 tool-btn 一致
- 模态框展示全部快捷键，按平台显示正确键名
- 所有关闭手势（? / Esc / 背景 / ✕）正常工作
- 没有引入 JS 报错，现有快捷键功能不受影响
</success_criteria>

<output>
完成后，创建 `.planning/quick/11-keyboard-shortcuts-help-modal/11-SUMMARY.md`

内容包含：
- 修改内容摘要（HTML 添加位置、CSS 类名、JS 结构）
- 平台检测逻辑说明
- 快捷键列表（与实现一致）
- 任何需要注意的后续事项
</output>
