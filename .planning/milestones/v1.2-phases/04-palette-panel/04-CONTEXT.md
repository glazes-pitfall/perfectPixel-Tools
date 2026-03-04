# Phase 4: Palette Panel - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

将 Ver 1.1 的色卡限制系统完整迁移至 editor.html，并实现色块与常驻调色盘之间的双向同步。覆盖 PAL-01、PAL-02 及 UI-03 需求。同时从 web_ui.html 中删除色卡面板（无引导跳转）。

</domain>

<decisions>
## Implementation Decisions

### 面板迁移范围
- 将 web_ui.html 的色卡限制面板（HTML + CSS + JS）完整移植到 editor.html 左侧滚动区
- 功能与 web_ui.html 保持一致，包括：自动生成色卡、上传色卡文件（.act/.gpl/.pal/.png）、保存/加载色卡（localStorage）、导出格式、映射模式选择、应用色卡按钮
- Phase 4 完成后，同步从 web_ui.html 删除整个色卡面板（HTML/CSS/JS），直接删除，不添加任何引导性文字或跳转按钮

### 色卡限制开关行为
- 打开「色卡限制」开关（toggle）时，自动展开参数栏（当前 web_ui.html 是手动展开的，这里改为自动）
- 关闭开关时，参数栏可保持打开状态（不强制折叠）

### 应用色卡结果（UI-03）
- 应用色卡后**仅预览**，不直接修改 EditorState.pixels，不计入撤销历史
- 结果图展示在画布右侧：原图（左）+ 色卡映射结果（右），两者均提供精准版 / N 倍放大版下载按钮
- 此行为覆盖 REQUIREMENTS 中的 UI-03，Phase 7 无需重复实现

### PAL-01 — 色块点击同步调色盘
- 点击色卡色块 → 立即将该 RGB 颜色设为调色盘前景色（调用现有 `syncColorUI()`）
- 工具状态保持不变，不切换至铅笔或其他工具

### PAL-02 — 调色盘颜色匹配高亮
- 匹配规则：精确 RGB 三通道相等（无容差，严格判断）
- 高亮样式：CSS `box-shadow` 发光动画（glow）——色块获得一圈颜色光晕，区别于普通边框
- 若多个色块 RGB 完全相同，则同时高亮所有匹配项
- 高亮在每次调色盘颜色变化时实时刷新

### 色卡数据持久化
- editor.html 与 web_ui.html 共用同一个 localStorage key（`pp_saved_palettes`）
- 由于色卡面板从 web_ui.html 移除，实际上只有 editor.html 负责读写这个 key，不存在竞争问题

### Claude's Discretion
- 发光动画的具体 CSS 参数（半径、颜色强度、是否脉冲闪烁）
- 对比图区域的精确布局（是否与画布等高、是否可隐藏）
- 应用色卡时的 loading 状态 UI（spinner / 按钮 disabled）

</decisions>

<specifics>
## Specific Ideas

- 调色盘颜色匹配高亮要用"发光"效果，视觉效果比普通实线边框更强
- 打开色卡限制开关时自动展开（当前 web_ui.html 需要手动点击展开，Phase 4 改进这一交互）
- 「应用色卡」仅预览不写入 EditorState.pixels——用户可以看效果、下载，但撤销历史不受影响

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **editor.html `左侧 [Phase 4] 占位符 div`**：已有空壳结构 (`<div class="panel-card">`)，Phase 4 填充其内容
- **web_ui.html 色卡面板 HTML/CSS/JS**：完整可复用，约 400 行 HTML + 200 行 JS；直接移植，ID 和变量名保持一致
- **EditorState.palette: []**：已在 EditorState 中定义，用于存储当前色卡 `[[r,g,b], ...]`
- **syncColorUI()**：已实现，接受 RGB 数组更新调色盘 UI（色轮 + hex + RGB inputs）
- **Flask 路由**：`/api/apply-palette`、`/api/generate-palette`、`/api/export-palette` 已存在且可直接使用

### Established Patterns
- **色卡数据格式**：`currentPalette = [[r,g,b], ...]`，与 `EditorState.palette` 格式一致
- **localStorage key**：`pp_saved_palettes`（web_ui.html 已定义），editor.html 直接复用
- **API 请求格式**：base64 JSON 交换（apply-palette 发送 `{image, palette, mode}`，返回 `{result_image}`）
- **collapsed 面板**：通过 `.hidden` class 切换，`paletteHeader.click` 事件驱动

### Integration Points
- **左侧滚动区 (`#left-scroll`)**：色卡面板放入此容器（当前仅有空占位符）
- **调色盘颜色变化事件**：每次 `syncColorUI()` 调用后触发 PAL-02 高亮检查
- **画布右侧对比图区域**：在 `#canvas-area` 内或右侧新增对比图容器（参考 web_ui.html `paletteResultCard`）

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-palette-panel*
*Context gathered: 2026-03-03*
