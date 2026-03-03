# Phase 6: Transform - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

在已有选区上实现三类变换：Move（拖动移位）、Scale（8-handle 缩放）、RotSprite 旋转。Phase 6 只消费 Phase 5 产生的 selectionMask，不创建选区。变换有"待定预览态"和"提交/取消"两种状态。

</domain>

<decisions>
## Implementation Decisions

### Move 行为（Floating Model）
- 激活 Move(V) 并开始拖动时，选区内容从原位"剪切"——原位像素变为透明（alpha=0），内容以 `selectionPixels` 形式浮起，实时跟随鼠标
- 拖动中内容实时渲染到 selCanvas（不写入 EditorState.pixels）
- Enter / Apply 按钮：将浮起内容落点写入 EditorState.pixels，pushHistory()（一次），自动取消选区
- ESC / Cancel 按钮：恢复原位像素（从浮起前的备份还原），不写入历史

### Transform 激活方式（统一模式）
- Move(V) 是唯一的变换入口工具，不拆分为三个独立工具
- 激活 Move(V) 且存在选区时，selCanvas 自动渲染：静态虚线框 + 8 个小方块 handle（4 角 + 4 边中点）
- 蚂蚁线动画停止（cancelAnimationFrame(antsRafId)），由静态虚线框替代
- 用户可在一次"待定态"中叠加：拖动移位 + 拖 handle 缩放 + 顶栏输入旋转角度，所有操作不写入历史
- 最终一次 Enter/Apply → 复合变换全部提交 → 一个 undo 步骤 → 自动取消选区

### Scale（8-handle 缩放）
- 角点 handle：等比缩放（锁定宽高比）；边中点 handle：单轴缩放
- 允许任意比例（非整数倍），但像素落点始终对齐到画布整数网格
- 缩放算法：Claude 自选（推荐 nearest-neighbor，保留像素艺术硬边）
- 顶栏实时显示：X scale %、Y scale %、锁比例 checkbox

### RotSprite 旋转
- 旋转入口：顶栏角度输入框（实时预览，输入即渲染到 selCanvas）
- 选区 > 128×128px 时：显示状态提示，不执行旋转
- RotSprite 算法在 selectionPixels 的当前浮起状态上运行（非原始截取时的快照）
- 顶栏显示：旋转角度输入框（度）

### Apply 后选区处理
- Enter/Apply 提交后：自动取消选区（蚂蚁线不恢复），回到普通工具模式
- 用户需重新框选才能继续变换

### 距离显示
- 拖动移位时，在浮起内容旁显示浮动小标注（CSS overlay）
- 显示内容：到画布四边的像素距离（如 "←12 | 34→"）
- 不使用顶栏，避免视线离开画布

### 溢出行为
- 待定态（未 Apply）：允许浮起内容超出画布边界（不剪裁，方便精确定位）
- Apply 时：只将画布范围内的像素写入 EditorState.pixels，画布外部分丢弃

### 变换视觉（Transform 模式 UI）
- 蚂蚁线停止，改为静态虚线框 + 8 个方块 handle
- 不规则选区（Magic Wand）：handle 框以选区外围最大矩形 bounding box 为准
- Handle 配色：灰紫色系（与现有深色主题协调）
- Handle 尺寸：固定屏幕像素大小（约 8×8px CSS），与 zoom 无关
- 顶栏在 Transform 模式下始终显示：Apply 按钮 + Cancel 按钮 + 当前操作参数

### Claude's Discretion
- 缩放算法具体实现（nearest-neighbor 或等效）
- Handle 确切像素尺寸（推荐 8×8px CSS）
- 灰紫色 handle 的具体 hex 值（与主题色变量协调）
- 距离标注的 CSS 样式细节
- 顶栏在移位/缩放/旋转三种状态下的参数布局（可全部同时显示）

</decisions>

<specifics>
## Specific Ideas

- 复合变换：用户可以在一次"待定态"中叠加移位 + 缩放 + 旋转，一次 Enter 全部提交，产生一个 undo 步骤——这正是用户明确期望的交互
- 溢出允许+Apply剪裁：精确定位时允许内容暂时超出画布边界，提交后自动剪裁，不损失定位精度

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EditorState.selectionPixels: null` — 已在 EditorState 留坑，Phase 6 直接使用
- `EditorState.transformState: null` — 已在 EditorState 留坑，用于存储待定态
- `EditorState.selectionMask: Uint8Array` — Phase 5 产生，Phase 6 读取 bounding box 用于 handle 定位
- `EditorState.selection: {x, y, w, h}` — bounding box，直接可用
- `pushHistory()` — 已实现，Apply 时调用一次
- `clearSelection()` — 已实现，Apply 后调用
- Move 工具按钮已存在但 `disabled`：`<button class="tool-btn" disabled title="Move (V)">&#10021;</button>` — 直接启用

### Established Patterns
- 工具对象模式：`{ onDown(x,y,e){}, onMove(x,y,e){}, onUp(x,y,e){}, onCursor(x,y){} }` — Move 工具照此实现
- 指针事件捕获：`cursorCanvas.setPointerCapture(e.pointerId)` — 确保 pointerup 在 canvas 外也触发
- 顶栏工具参数：`<div id="tool-settings-XXX" style="display:none">` 按激活工具显示/隐藏

### Selection Canvas 架构（关键 — 来自 Phase 5.1 + Quick Tasks 8–11）

**`#selection-canvas` 不在 `#zoom-container` 内**，是 `#canvas-area` 下的平级元素，不受 `transform: scale(zoom)` 影响。

```javascript
// selCanvas 覆盖整个 canvas-area 视口
// position: absolute; top: 0; left: 0; pointer-events: none
// selCtx 仅 scale(dpr, dpr)，1 逻辑单位 = 1 CSS 像素

// 画布坐标 → selCanvas CSS 坐标转换：
const caRect  = document.getElementById('canvas-area').getBoundingClientRect();
const pixRect = pixelCanvas.getBoundingClientRect();
const originX = pixRect.left - caRect.left;   // selCanvas CSS px
const originY = pixRect.top  - caRect.top;
const ps      = pixRect.width / EditorState.width;  // CSS px per canvas pixel
// 画布坐标 (cx, cy) → selCanvas CSS 坐标: originX + cx*ps, originY + cy*ps

// 描边参数：
// lineWidth = 2（固定 2 CSS 像素，不除以 dpr 或 zoom）
// off = 1（外描边偏移）
// 清除：selCtx.clearRect(0, 0, selCanvas.width/dpr, selCanvas.height/dpr)
```

**Phase 6 的静态虚线框和 8 个 handle 也在 selCanvas 上绘制，使用同一坐标公式。**

### Integration Points
- `tools.move` 对象在工具调度表中已占位（stub），直接填入实现
- 键盘快捷键：`V` → `setActiveTool('move')`（已有快捷键框架）
- `antsRafId` RAF 句柄：进入 Transform 模式时调用 `cancelAnimationFrame(antsRafId)`

### 规划阶段必读代码
- **Phase 5 实现代码**（editor.html 中 selectionMask/selection 相关逻辑）
- **Phase 5.1 代码**（`drawAnts()` 和 `_marqueeDrawPreview()` 的虚线框算法 + DPR 处理）
  - 静态虚线框可直接复用 ants 的路径构建逻辑，去掉 RAF 动画部分
  - 保持相同的 difference 合成模式和 lineWidth=2 规范

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-transform*
*Context gathered: 2026-03-04*
