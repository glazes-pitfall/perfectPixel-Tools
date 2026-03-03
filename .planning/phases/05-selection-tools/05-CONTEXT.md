# Phase 5: Selection Tools - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

为画布添加 Rectangle Marquee (M) 和 Magic Wand (W) 两种选区工具，带动画蚂蚁线边框，绘图工具在选区激活时受选区边界约束。Transform（Move/Scale/Rotate）是 Phase 6 的工作，不在本阶段实现。

</domain>

<decisions>
## Implementation Decisions

### Magic Wand 选区形状
- 产生像素级不规则选区，**不是**边界矩形近似
- 蚂蚁线贴合每个匹配像素的外边缘逐像素绘制（所有外边都有蚂蚁线，包括内凹轮廓）
- Phase 6 Move 将基于像素掩码精准移动非矩形像素集合

### Rectangle Marquee 网格吸附
- 拖动起点和终点均吸附到最近的网格单元角点
- 选区的宽高必须是 gridW / gridH 的整数倍
- gridW/gridH = 0（未检测到网格）时退化为 1px 单位吸附（普通像素级）

### 工具裁剪范围
- 选区激活时，**Pencil + Eraser + Paint Bucket 三个工具全部受选区约束**
- 绘图/填充操作不能溢出选区边界之外

### Shift 累加选区
- Shift + 拖拽 Marquee → 把新矩形并入已有选区（union 合并）
- Shift + 点击 Wand → 把新匹配像素并入已有选区（union 合并）
- 不带 Shift → 替换整个选区

### 蚂蚁线动画
- 样式：Aseprite 风格，1px 宽反色虚线（白/黑交替），持续动画滚动
- 形状：贴合实际像素掩码的外轮廓，Wand 选出不规则区域时蚂蚁线也不规则
- 使用现有 selection-canvas（z-index 2），RAF 循环驱动，取消选区时必须 cancelAnimationFrame

### 选区持久性
- **切换工具不取消选区**——选区在工具切换后保持激活
- 选区仅被以下操作取消：Cmd+D、新建选区（无 Shift）、加载新图片

### 顶栏按钮（有选区时显示）
- 选区激活时顶栏显示：**Deselect（Cmd+D）** 和 **Inverse（Shift+Cmd+I）** 按钮
- 无选区时这两个按钮隐藏（不是 disabled，是 display:none）

### 选区操作快捷键
- **Cmd+D** → 取消选区（Deselect）
- **Shift+Cmd+I** → 反选（Inverse）
- **Option+Delete** → 前景色填充选区内所有像素（push history）
- **Delete** → 透明像素填充选区内所有像素（清除选区内容，push history）

### 反选语义
- Inverse = 全画布像素掩码取反
- 所有当前未选中的像素变为选中，当前选中的像素变为未选中
- 结果包含完整的不规则掩码（非矩形），适用于 Wand 选区的反选

### Claude's Discretion
- 选区内部数据结构：统一使用 `Uint8Array` 像素掩码（一字节/像素，1=选中），同时用 `{x,y,w,h}` 记录边界框供快速范围检查
- 蚂蚁线虚线具体线段长度和动画帧率
- 网格吸附的具体像素对齐算法（四舍五入到最近整数倍）
- 选区工具的 cursor 样式（crosshair vs 自定义）

</decisions>

<specifics>
## Specific Ideas

- 蚂蚁线风格参考 Aseprite：白/黑虚线交替，以固定速度滚动，非常经典的像素工具风格
- Wand 的不规则蚂蚁线：逐像素外边缘（类似像素连通分量的外轮廓），不是简化的折线近似
- Option+Delete / Delete 快捷键与 Photoshop / Aseprite 习惯一致，用户熟悉

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `selCanvas` / `selCtx`（line 606, 609）: selection-canvas 已在 DOM 中（z-index 2，DPR 缩放），尚无任何渲染代码——Phase 5 直接使用
- `floodFill()`（line 842）: BFS 泛洪填充，已有 `Uint8Array visited` 位图机制；**直接改造**：返回 visited 数组作为像素选区掩码，而不是写颜色到像素缓冲
- `setActiveTool()` + `tools` 调度对象（line 563, 1049）: 工具切换基础设施就绪，直接添加 `tools.marquee` 和 `tools.wand`
- `EditorState.toolOptions.wandTolerance: 15`（line 540）: 已定义
- `EditorState.toolOptions.contiguous: true`（line 541）: 已定义，Wand 共用此选项
- `EditorState.gridW/gridH`（line 532）: 网格元数据已存储，Marquee 吸附直接读取
- `EditorState.selection`（line 543）: 已定义为 `null | {x,y,w,h}`，需扩展为同时携带 mask
- 右侧面板 Marquee 和 Wand 按钮（line 361-362）: HTML 中已存在但 `disabled`、无 `data-tool` 属性——只需启用

### Established Patterns
- 工具对象接口：`onDown(x,y,e)`, `onMove(x,y,e)`, `onUp(x,y,e)`, `onCursor(x,y)` — Marquee 和 Wand 必须遵循
- 顶栏工具面板：`<div id="tool-settings-{tool}">` 按 `setActiveTool()` 显示/隐藏（line 595）— 需新增 marquee 和 wand 的参数 div
- `pushHistory()` 在 `pointerup` 时调用（画笔类），或操作完成立即调用（Bucket 类）— 选区填充/删除快捷键同 Bucket 模式（立即 push）
- 容差比较：每通道轴对齐盒（`abs(ch - target.ch) <= tolerance`），不是欧氏距离——Wand 沿用相同逻辑
- 蚂蚁线 RAF：参考 CLAUDE.md 模式，必须在 `clearSelection()` 中 `cancelAnimationFrame(antsRafId)`

### Integration Points
- Pencil tool（line 1282）: `onDown/onMove` 中需加选区裁剪检查——若 `EditorState.selectionMask` 非空且目标像素未选中，跳过写入
- Eraser tool（line 1314）: 同上
- Bucket tool（line 1348）: `floodFill()` 调用后，对 fill 结果额外与 selectionMask 做 AND 过滤
- 键盘快捷键（line 1428）: 现有 B/E/G/I 快捷键处理——在同处添加 M、W、Cmd+D、Shift+Cmd+I、Delete、Option+Delete

</code_context>

<deferred>
## Deferred Ideas

- 无——讨论全程在 Phase 5 范围内

</deferred>

---

*Phase: 05-selection-tools*
*Context gathered: 2026-03-03*
