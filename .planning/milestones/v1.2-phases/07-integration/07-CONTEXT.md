# Phase 7: Integration - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

让编辑器可从 Ver 1.1 流程中打开（ENTRY-01），添加画布尺寸调整工具 Canvas Size（CFG-01~04），并提供下载/保存功能（CANVAS-03）。UI-03（色卡对比视图）已在前序阶段完成，不在本阶段范围内。

</domain>

<decisions>
## Implementation Decisions

### 入口点行为（ENTRY-01）

- 「在编辑器中打开」按钮位置：`web_ui.html` 结果图旁，两个下载按钮下方，按钮文本含 emoji 以醒目标识
- sessionStorage 传递数据：
  - `editorImage`：base64 PNG（处理后的像素画）
  - `editorFilename`：原始文件名（用于下载命名，例如 `test.jpg`）
  - **不传** gridW/gridH——图片已被 PerfectPixel 处理为精确像素，网格信息冗余
  - **不传** 色卡——色卡限制功能仅在编辑器内，两页面之间无需传递
- sessionStorage 超限时（QuotaExceededError）：弹错误提示，告知用户在编辑器中重新上传图片
- 直接访问 `/editor`（不从 web_ui.html 跳转）：中央画布区域显示「点击或拖拽图片到此处」，复用 `web_ui.html` 的文件上传/拖拽逻辑

### 画布尺寸工具（CFG-01~04）

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

### 下载功能（CANVAS-03）

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

</decisions>

<specifics>
## Specific Ideas

- 「在编辑器中打开」按钮含 emoji，要比普通下载按钮更醒目
- Canvas Size 扩张区的棋盘格应与原画布棋盘格**颜色有所区别**（偏浅偏蓝），让用户直观感知哪里是新增区域
- 下载弹窗的下载按钮应是弹窗中**最醒目**的元素
- Home 按钮在下载按钮**左侧**，两者共存于弹窗内

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets

- `web_ui.html`：文件上传/拖拽逻辑 → 可直接移植到编辑器的「点击或拖拽图片到此处」功能
- `web_ui.html`：`data.output`（base64 PNG）、`data.grid_w`、`data.grid_h` → 已有结果数据，`data.output` 直接作为 `editorImage` 传递
- `editor.html`：`getEditorImageB64()` 函数（line 1069）→ 可用于生成下载内容
- `editor.html`：selection-canvas（z-index: 2）→ 可复用渲染 Canvas Size 参考线 overlay
- `web_app.py`：`/editor` 路由（line 351）→ 已存在，无需新增

### Established Patterns

- sessionStorage 握手：`editorImage` + `editorFilename` 存入后跳转，editor.html 加载时读取并清除
- 下载：`canvas.toBlob()` → `URL.createObjectURL()` → `<a>.click()` 客户端下载（无需 Flask）
- 顶栏参数区：与 Phase 3 已实现的铅笔/填充桶参数栏保持相同模式

### Integration Points

- `web_ui.html` 结果区：需在现有下载按钮下方添加「在编辑器中打开」按钮
- `editor.html` 初始化：加载时先检查 sessionStorage，有 `editorImage` 则加载，无则显示拖拽上传界面

</code_context>

<deferred>
## Deferred Ideas

无——讨论全程未出现超出 Phase 7 范围的新功能提议。

</deferred>

---

*Phase: 07-integration*
*Context gathered: 2026-03-04*
