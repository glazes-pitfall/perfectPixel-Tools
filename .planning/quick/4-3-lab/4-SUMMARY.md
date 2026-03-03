---
phase: quick-4-3-lab
plan: 4
subsystem: editor-palette
tags: [palette, lab-color, mapping-mode, applyPalette]
dependency_graph:
  requires: []
  provides: [mapping-mode-ui, lab-perceptual-match, swap-mode-flask]
  affects: [editor.html]
tech_stack:
  added: [CIE LAB color conversion (pure JS)]
  patterns: [async applyPalette, origAlpha mask for transparency restoration]
key_files:
  modified: [editor.html]
decisions:
  - "LAB 辅助函数 (rgbToLab / nearestPaletteColorLab) 独立于 applyPalette，便于复用"
  - "swap 模式用 origAlpha 掩码在 JS 侧恢复透明区，不依赖 Flask 端保留 alpha"
  - "mappingMode radio 兜底 || {value: 'vector'} 保证 HTML 未加载时向量匹配仍可工作"
metrics:
  duration: "< 5 min"
  completed_date: "2026-03-03"
  tasks_completed: 2
  files_modified: 1
---

# Quick Task 4 (4-3-lab): 三模式应用色卡 — 向量匹配 / 感知匹配 / 色卡替换

**One-liner:** 恢复映射模式 radio UI，新增 CIE LAB 纯 JS 感知匹配，async applyPalette 三路分发，swap 模式通过 origAlpha 掩码保留透明像素。

## What Was Done

### Task 1 — 恢复映射模式 HTML + 新增 LAB 辅助函数

**HTML 插入位置（editor.html 第 567 行前）：**

在 `<!-- Export -->` 注释正上方插入 `<!-- Mapping mode -->` 区块，包含三个 radio：
- `value="vector"` checked — 向量匹配（默认）
- `value="perceptual"` — 感知匹配
- `value="swap"` — 色卡替换

使用已有 CSS 类 `.mode-group` / `.mode-option` / `.mode-label` / `.mode-desc`，无需新增样式。

**JS 函数插入位置（`nearestPaletteColor` 定义块之后）：**

```javascript
function rgbToLab(r, g, b)                           // sRGB → CIE LAB (D65 白点)
function nearestPaletteColorLab(r, g, b, palette)    // LAB 欧氏距离最近色匹配
```

### Task 2 — async applyPalette 三模式实现

原 `applyPalette()` (同步，14 行) 替换为 `async applyPalette()` (95 行)。

| 模式 | 触发条件 | 实现 | Flask 调用 |
|------|----------|------|-----------|
| vector | radio=vector (默认) | RGB 欧氏距离，同步循环 | 无 |
| perceptual | radio=perceptual | LAB 距离 via `nearestPaletteColorLab`，同步循环 | 无 |
| swap | radio=swap | offscreen canvas → FormData POST → 结果写回 | `/api/apply-palette` mode=swap |

**swap 模式 alpha 恢复方案（origAlpha 掩码）：**
1. `px.slice()` 写入 offscreen canvas，导出 PNG（保留 alpha 通道）
2. 记录 `origAlpha: Uint8Array(w*h)`，逐像素保存原始 alpha 值
3. Flask 返回 RGB 图像（合成了黑色背景）
4. 写回时：`origAlpha[i>>2] <= 127` → 置透明；否则取 Flask 结果 RGB + alpha=255

所有三种模式均调用 `flushPixels()` + `pushHistory()`，操作可通过 Cmd+Z 撤销。

## Key Line Numbers in editor.html

| 位置 | 内容 |
|------|------|
| 567–593 | `<!-- Mapping mode -->` HTML 区块 |
| 1846–1877 | `rgbToLab()` + `nearestPaletteColorLab()` 辅助函数 |
| 1879–1973 | `async applyPalette()` 三模式实现 |

## Deviations from Plan

None — plan executed exactly as written.

Task 1 和 Task 2 的所有代码改动在同一次 `git add editor.html` 前完成，因此合并在一个提交中（commit 4d396f5）。两个任务的逻辑完整独立，无遗漏。

## Self-Check

- [x] `<!-- Mapping mode -->` HTML 区块存在于 editor.html 第 567 行
- [x] `rgbToLab` 函数定义存在（行 1848）
- [x] `nearestPaletteColorLab` 函数定义存在（行 1866）
- [x] `async function applyPalette()` 三模式实现存在（行 1880）
- [x] commit 4d396f5 包含 149 insertions (+14 deletions)
