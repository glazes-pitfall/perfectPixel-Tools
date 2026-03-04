# Phase 1: Foundation - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

搭建 `editor.html` 的结构基础：4 面板布局、3 层 Canvas 叠层、`EditorState` 像素缓冲区、以及可用的缩放/平移系统。Phase 1 交付一个可在浏览器中打开、能展示像素图、可缩放、能通过点击读出正确 RGBA 值的编辑器框架。工具、调色板、历史记录、选区均属于后续 Phase。

</domain>

<decisions>
## Implementation Decisions

### 面板布局（Panel Layout）
- 4 面板结构：顶部栏（top bar）| 左侧面板（palette/色卡区）| 中央画布区 | 右侧工具栏
- **左侧**：调色板、色卡、像素检查器（颜色相关内容）
- **右侧**：窄图标条（工具图标，Phase 3 补全；Phase 1 显示禁用占位槽）
- 注意：CLAUDE.md 中 "left bar = tools" 的描述与用户确认的布局相反，以本文件为准

### 顶部栏（Top Bar）
- Phase 1 展示完整可见的 chrome，但未实现的功能（Undo/Redo、导出等）保持**禁用状态**
- 缩放控件放在顶部栏：缩放比例数字显示 + `+` / `-` 按钮

### 缩放系统（Zoom）
- 触发方式：滚轮（兼容触控板）+ 顶部栏 +/- 按钮 + 键盘 `Ctrl+=` / `Ctrl+-`
- 范围：1x – 64x
- 缩放中心：**鼠标指针位置**（不是画布中心）
- 实现方式：CSS `transform: scale(zoom)` 作用于画布容器 div，绝不使用 `ctx.setTransform`

### 画布背景与平移（Canvas Background & Pan）
- 画布后面显示**棋盘格**（表示透明区域）
- 棋盘格颜色：`--surface`（#1a1a22）/ `--surface2`（#22222e），与整体深色主题融合
- 棋盘格尺寸：1 格 = **16 画布像素**（随缩放等比变化；zoom=4x 时显示 64 CSS px/格）
- 棋盘格实现：CSS background 或 Canvas 绘制，跟随 CSS transform 缩放
- 平移方式：**滚动条**（canvas 区域 overflow: auto）
- 画布对齐：画布小于视口时**居中显示**，四周保留固定边距（约 24px）

### 像素检查器（Pixel Inspector — Phase 4 调色板脚手架）
- 位置：左侧面板**底部固定区域**
- 显示内容：`X, Y` 坐标 + `R G B A` 数值 + **颜色预览色块**
- 更新时机：鼠标悬停在画布上时实时更新（不需要点击）
- 用途：满足 Phase 1 验收标准「点击像素返回 EditorState.pixels 的 RGBA 值」，同时作为 Phase 4 调色器展示区的占位脚手架

### 占位图片（Placeholder Image）
- 使用项目根目录的 **`output.png`**（真实像素艺术处理结果）
- 通过 Flask `/editor` 路由服务 `editor.html`；`output.png` 由前端 JS 通过 `/api/...` 或直接 `<img>` 标签加载（规划阶段决定具体机制）
- Phase 1 不需要实现完整 sessionStorage 交接（那是 Phase 7 的工作）

### Claude's Discretion
- 左侧面板和右侧工具栏的具体宽度（参考 web_ui.html 的 300px 侧栏比例自行决定）
- 右侧工具条在 Phase 1 的具体占位图标（禁用状态即可）
- 滚动条是否使用自定义样式（建议与深色主题匹配）
- 顶部栏的具体高度和内边距

</decisions>

<specifics>
## Specific Ideas

- 棋盘格格子大小与画布像素的比值是 16:1（不是固定 16 CSS px），这一点在实现时需要特别注意
- 缩放时以鼠标指针为中心，这是 Figma / Aseprite 的标准行为，体验最好
- 顶部栏 "完整 chrome 但禁用" 的策略让用户能看到最终全局，避免后续 Phase 加入按钮时布局跳变

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web_ui.html` CSS 变量：`--bg`, `--surface`, `--surface2`, `--border`, `--accent`, `--accent-hover`, `--text`, `--text-muted`, `--success`, `--error`, `--warning`, `--radius` — 直接复制到 `editor.html` 的 `:root`
- `web_ui.html` 基础样式：`.btn`, `.btn-primary`, `select`, `input[type=number]`, CSS reset — 可复用
- `web_ui.html` header 结构模式（flexbox, border-bottom, font-size/weight）
- `assets/`、`images/`：有 test.jpeg、avatar.png、robot.jpeg 等样例图

### Established Patterns
- 单文件 HTML：内联 CSS + JS，无构建步骤，无 npm（与 `web_ui.html` 完全相同模式）
- DOM 只写：所有状态存在 JS 对象中，DOM 仅用于渲染，不反向读取
- Flask 路由：`@app.route("/editor")` 返回 `send_file("editor.html")`

### Integration Points
- `web_app.py` 需新增 `/editor` 路由（CLAUDE.md 已列出模板）
- `editor.html` 与 `web_ui.html` 共享同一 Flask 进程（端口 5010）
- Phase 7 会通过 `sessionStorage` 把 `web_ui.html` 的处理结果传入 editor，Phase 1 暂不涉及

</code_context>

<deferred>
## Deferred Ideas

- sessionStorage 交接（web_ui.html → editor.html）— Phase 7
- 调色板完整功能（色卡点击、双向同步）— Phase 4
- 工具实际功能（铅笔、橡皮、油漆桶）— Phase 3

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-02*
