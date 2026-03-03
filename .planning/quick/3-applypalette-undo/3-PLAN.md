---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [editor.html]
autonomous: true
requirements: [QUICK-3]

must_haves:
  truths:
    - "应用色卡后按一次 Cmd+Z，只撤销铅笔笔划，画面回到色卡应用后的状态"
    - "再按一次 Cmd+Z，才撤销色卡应用，画面回到原始状态"
    - "每次操作（applyPalette、pencil stroke）各占一个独立的 undo 步骤"
  artifacts:
    - path: "editor.html"
      provides: "applyPalette save-after 修复"
      contains: "pushHistory() placed after flushPixels() in applyPalette"
  key_links:
    - from: "applyPalette()"
      to: "EditorState.history"
      via: "pushHistory() after pixel modification"
      pattern: "flushPixels.*pushHistory|pushHistory.*after.*flushPixels"
---

<objective>
修复 applyPalette 与铅笔 undo 合并问题。

Purpose: 应用色卡后用铅笔画一笔，按 Cmd+Z 应只撤销铅笔笔划。目前两次操作被合并成一个 undo 步骤，导致单次 Cmd+Z 同时撤销了色卡应用和铅笔。

Root cause: applyPalette 使用 save-before 模型 — 先 pushHistory()（存初始状态），再修改像素，但从不把应用后的状态压入历史。铅笔 onUp 再次调用 pushHistory() 时，把"色卡应用后+铅笔完成"的状态覆盖进 history[2]，而 history[1] 仍然是初始状态。一次 Cmd+Z 跳回 history[1]（初始），两次操作被合并撤销。

Fix: 将 applyPalette 改为 save-after 模型 — 删除开头的 pushHistory()，在 flushPixels() 之后调用 pushHistory()。修改后历史栈变为 [初始, 色卡应用后, 铅笔完成后]，每步独立可撤销。

Output: editor.html（单文件修改，2 行改动）
</objective>

<execution_context>
@/Users/calling/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@/Users/calling/perfectPixel_ver1.1/editor.html
</context>

<tasks>

<task type="auto">
  <name>Task 1: 修复 applyPalette 的 pushHistory 时序</name>
  <files>editor.html</files>
  <action>
在 editor.html 中找到 applyPalette 函数（约第 1820 行），执行以下精确修改：

**删除第 1822 行：**
```javascript
      pushHistory();  // save-before（瞬时操作，参照 paint bucket 模式）
```

**在 flushPixels() 之后（第 1836 行）添加 pushHistory()：**
```javascript
      flushPixels();
      pushHistory();  // save-after: 应用后压入，保证与铅笔各占独立 undo 步骤
      palShowStatus('色卡已应用', 'success');
```

修改后 applyPalette 函数应如下（完整替换）：
```javascript
    // ── PAL-04: 破坏性应用色卡 — 直接写入 EditorState.pixels + pushHistory ──
    function applyPalette() {
      if (!EditorState.pixels || currentPalette.length === 0) return;
      const px = EditorState.pixels;
      const pal = currentPalette;
      for (let i = 0; i < px.length; i += 4) {
        const a = px[i + 3];
        if (a <= 127) {
          // 透明一侧 → 纯透明
          px[i] = 0; px[i+1] = 0; px[i+2] = 0; px[i+3] = 0;
        } else {
          // 不透明一侧 → 最近色卡色，alpha 强制 255
          const [nr, ng, nb] = nearestPaletteColor(px[i], px[i+1], px[i+2], pal);
          px[i] = nr; px[i+1] = ng; px[i+2] = nb; px[i+3] = 255;
        }
      }
      flushPixels();
      pushHistory();  // save-after: 应用后压入，保证与铅笔各占独立 undo 步骤
      palShowStatus('色卡已应用', 'success');
    }
```

注意：paint bucket 使用 save-before（因为 floodFill 可能很慢，保存在修改前以便随时中断）；applyPalette 是同步操作，改为 save-after 与铅笔保持一致，两次操作各产生一个独立的 history 条目。
  </action>
  <verify>
在浏览器 DevTools Console 执行以下验证序列（需要已加载图片）：

```javascript
// 验证初始状态
console.assert(EditorState.historyIndex === 0, '初始: historyIndex 应为 0');
const before = EditorState.pixels.slice();

// 模拟 applyPalette（需先设置 currentPalette 非空才能触发，可直接点 UI 应用色卡）
// 执行后：
console.assert(EditorState.historyIndex === 1, '色卡应用后: historyIndex 应为 1');
const afterPalette = EditorState.pixels.slice();

// 模拟铅笔一笔（pointerdown + pointerup）
// 执行后：
console.assert(EditorState.historyIndex === 2, '铅笔后: historyIndex 应为 2');

// 按一次 Cmd+Z
undo();
console.assert(EditorState.historyIndex === 1, 'undo 1: historyIndex 应为 1');
// 此时像素应等于 afterPalette（色卡已应用但无铅笔笔划）

// 再按 Cmd+Z
undo();
console.assert(EditorState.historyIndex === 0, 'undo 2: historyIndex 应为 0');
```

或通过 Playwright 手动测试：
1. 打开 http://localhost:5010/editor，上传图片
2. 在左侧面板添加色卡并点击"应用色卡"
3. 切换铅笔工具，在画布上画一笔
4. 按 Cmd+Z — 确认只撤销铅笔笔划（色卡效果保留）
5. 再按 Cmd+Z — 确认撤销色卡应用（图像回到原始状态）
  </verify>
  <done>
- applyPalette 函数开头无 pushHistory() 调用
- applyPalette 函数在 flushPixels() 之后有 pushHistory() 调用
- 应用色卡后 historyIndex 增加 1（独立 undo 步骤）
- 铅笔画一笔后 historyIndex 再增加 1（独立 undo 步骤）
- 单次 Cmd+Z 只撤销铅笔，不撤销色卡应用
  </done>
</task>

</tasks>

<verification>
通过 browser DevTools 或 Playwright 验证 undo 步骤独立性：
1. 应用色卡 → historyIndex 从 0 变为 1
2. 铅笔画笔 → historyIndex 从 1 变为 2
3. Cmd+Z × 1 → historyIndex 变回 1，画面回到色卡应用后状态
4. Cmd+Z × 2 → historyIndex 变回 0，画面回到原始状态
</verification>

<success_criteria>
applyPalette 和铅笔笔划各产生独立的 undo 步骤，Cmd+Z 逐步撤销，不合并。
</success_criteria>

<output>
完成后在 `.planning/quick/3-applypalette-undo/` 目录中记录修复结果。
</output>
