---
phase: quick-11
plan: 01
subsystem: editor-ui
tags: [keyboard-shortcuts, help-modal, ux, editor]
dependency_graph:
  requires: []
  provides: [shortcut-modal, help-button]
  affects: [editor.html]
tech_stack:
  added: []
  patterns: [IIFE-scoped-JS, platform-detection, DOM-build-pattern]
key_files:
  created: []
  modified:
    - editor.html
decisions:
  - "IIFE wrapper used to avoid polluting global scope with modal helpers"
  - "buildShortcutList() re-renders on every open (simple, no stale data)"
  - "Escape key for help modal does NOT preventDefault — allows eyedropper Escape to fire"
metrics:
  duration: "77 seconds"
  completed_date: "2026-03-04"
  tasks_completed: 2
  files_modified: 1
---

# Quick Task 11: Keyboard Shortcuts Help Modal — Summary

**One-liner:** 在编辑器右边栏底部添加"?"帮助按钮，点击弹出带平台检测的快捷键参考模态框（Cmd/Option for macOS，Ctrl/Alt for others）。

## What Was Built

右边栏工具按钮列表底部新增一个固定帮助按钮（`?`），点击弹出全屏半透明遮罩模态框，内含按分组排列的所有快捷键参考表。

## Modifications

### HTML 修改 (`editor.html`)

**1. 右边栏底部帮助按钮（第 831-832 行）**

```html
<div style="flex:1;"></div><!-- spacer pushes help button to bottom -->
<button class="tool-btn" id="help-btn" title="快捷键帮助 (?)">?</button>
```

插入在 `#right-panel` 的 `</div>` 前，`flex:1` spacer 使按钮固定在底部。

**2. 快捷键模态框 HTML（`#layout` 之后，colorPopup 之前）**

- `id="shortcut-modal"` — 固定定位全屏遮罩，`display:none`（初始隐藏），`flex` 时居中
- `id="help-close-btn"` — 右上角关闭按钮（✕）
- `id="shortcut-list"` — JS 动态渲染目标容器

### CSS 修改（`<style>` 块末尾）

| 类名 | 用途 |
|------|------|
| `.sc-section-title` | 分组标题（大写小字）|
| `.sc-row` | 单行快捷键条目（flex 左右对齐）|
| `.sc-desc` | 功能描述文字 |
| `.sc-keys` | 键名容器（flex，`gap:4px`）|
| `.sc-key` | 单个键名标签（`<kbd>` 样式）|

### JS 修改（keydown 监听器之后，IIFE 包裹）

**平台检测逻辑：**

```javascript
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const mod = isMac ? 'Cmd' : 'Ctrl';
const alt = isMac ? 'Option' : 'Alt';
```

在 IIFE 加载时执行一次，后续闭包引用，不重复检测。

**快捷键分组数据（SECTIONS 数组）：**

| 分组 | 内容 |
|------|------|
| 工具 | B 铅笔、E 橡皮擦、G 油漆桶、M 选框、W 魔棒、I 吸管、Esc 取消吸管 |
| 历史 | Cmd/Ctrl+Z 撤销、Cmd/Ctrl+⇧Z 重做 |
| 视图 | Cmd/Ctrl++ 放大、Cmd/Ctrl+− 缩小 |
| 选区 | Cmd/Ctrl+D 取消、Cmd/Ctrl+⇧I 反选、Delete 删除、Option/Alt+Delete 填充 |
| 其他 | ? 帮助 |

**三种关闭方式：**

1. `#help-close-btn` 点击 → `closeHelpModal()`
2. 点击遮罩背景（`e.target === modal`）→ `closeHelpModal()`
3. `Escape` 键 → `closeHelpModal()`（不 `preventDefault`，保留吸管 Escape 行为）

**`?` 键切换：**

```javascript
if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
  e.preventDefault();
  const isOpen = document.getElementById('shortcut-modal')?.style.display === 'flex';
  if (isOpen) closeHelpModal(); else showHelpModal();
}
```

## 注意事项

- 模态框 `z-index: 2000`（高于 canvas 层 z-index:1/2/3，高于 colorPopup z-index:999）
- `buildShortcutList()` 每次打开时重新渲染，避免平台键名缓存问题
- Escape 监听在帮助模态框 JS 中不 `preventDefault`，确保吸管取消逻辑（第 2886-2888 行）仍然触发
- 遮罩使用 `backdrop-filter:blur(2px)` 提供现代感

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 9838d87 | feat(quick-11): add help button to right panel + shortcut modal HTML/CSS |
| 2 | a88ba33 | feat(quick-11): add shortcut modal JS — platform detection + show/hide logic |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `id="help-btn"` exists in editor.html (line 832)
- [x] `id="shortcut-modal"` exists in editor.html (line 838)
- [x] `id="shortcut-list"` exists in editor.html (line 849)
- [x] `.sc-section-title`, `.sc-row`, `.sc-key` CSS defined (lines 561-580)
- [x] `showHelpModal` / `closeHelpModal` JS functions defined (lines 2975-2984)
- [x] Commit 9838d87 exists
- [x] Commit a88ba33 exists
