# Roadmap: PerfectPixel Ver 1.2

## Overview

Ver 1.2 adds a full browser-based pixel art editor (`editor.html`) to the existing Ver 1.1 grid-alignment pipeline. The build follows a strict technical dependency chain: the pixel buffer and coordinate system (Foundation) must be correct before History, which must exist before Core Tools, which must be stable before Selection, which Selection must precede Transform. Canvas Config and the Integration handoff from Ver 1.1 close out the release once all editor capabilities are verified. Every phase delivers a coherent, independently testable capability.

## Global Architectural Constraints

> These constraints apply to ALL phases. Downstream agents must enforce them unconditionally.

### Color Model: Tool Output Constraint

Editor **tools** may only write pixels in one of two states:
- **Fully opaque**: alpha = 255 (有色像素)
- **Fully transparent**: alpha = 0 (透明像素)

**No tool or operation may actively produce semi-transparent pixels (0 < alpha < 255).** Existing semi-transparent pixels that come from the original loaded image are left untouched — they are simply preserved as-is without modification.

### Transparent Pixel Triggers (Exhaustive List)

Alpha = 0 pixels may only be introduced through:
- (a) Eraser tool stroke
- (b) Selection active + Delete key pressed
- (c) Original loaded image already contains transparent or semi-transparent pixels (kept as-is, no normalization)

No other operation may produce alpha = 0 pixels.

### Palette Counting and Alpha Handling

色卡只存储全不透明 RGB 颜色（alpha = 255），不存在带 Alpha 通道的颜色条目。
像素按以下规则分类参与色卡生成与应用：

| Alpha 值 | 色卡生成时 | 应用色卡时 |
|---------|----------|----------|
| alpha = 255（纯色） | 计入色卡 | 替换为最近色卡色（alpha = 255） |
| 128 ≤ alpha < 255（不透明一侧） | 以当前 RGB 值计入色卡（视作不透明像素） | 替换为最近色卡色（alpha = 255） |
| 1 ≤ alpha ≤ 127（透明一侧） | **不计入**色卡（忽略） | 替换为纯透明 (0, 0, 0, 0) |
| alpha = 0（纯透明） | 不计入色卡 | 替换为纯透明 (0, 0, 0, 0) |

**隐式透明槽**：在应用色卡时，alpha ≤ 127 的像素统一被一条隐式规则处理（输出为纯透明）。该规则不显示在 UI 的色卡条目中，但实际存在于应用逻辑中。不计入用户设置的颜色数上限。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Editor page structure, pixel buffer, coordinate system, and zoom infrastructure
- [x] **Phase 2: History** - Snapshot-based undo/redo covering all editor operations
- [x] **Phase 3: Core Tools** - Pencil, Eraser, Paint Bucket tools with integrated color picker
- [x] **Phase 4: Palette Panel** ⟋ **(parallel with Phase 5)** - Palette swatch integration with bidirectional color picker sync (completed 2026-03-03)
- [x] **Phase 5: Selection Tools** ⟋ **(parallel with Phase 4)** - Rectangle Marquee and Magic Wand with animated marching ants (completed 2026-03-04)
- [ ] **Phase 6: Transform** - Move, 8-handle scale, and RotSprite rotation on selections
- [ ] **Phase 7: Integration** - Canvas Size tool, Open-in-Editor entry point, and download/save wiring

## Phase Details

### Phase 1: Foundation
**Goal**: The editor page loads, displays an image at pixel-accurate zoom, and every tool can read/write pixels using a stable coordinate system
**Depends on**: Nothing (first phase)
**Requirements**: UI-01, UI-02, CANVAS-01, CANVAS-02
**Success Criteria** (what must be TRUE):
  1. `editor.html` opens in the browser and renders a placeholder pixel art image in the central canvas with no blurring or interpolation
  2. User can zoom in and out on the canvas; pixel coordinates reported by the editor remain 1:1 with image coordinates at every zoom level
  3. The 4-panel layout (left bar, central canvas, right toolbox, top bar) is visible and structurally complete, matching the Ver 1.1 dark theme
  4. Clicking any pixel on the canvas returns the exact RGBA value from `EditorState.pixels` (not from the canvas element), confirming premultiplied-alpha isolation is in place
**Plans**: 3 plans

**Permanent feature note**: 像素检查器（Pixel Inspector）是永久功能，不是脚手架。悬停于画布时实时显示当前像素的 X/Y 坐标及 RGBA 四通道值。后续阶段不得移除。

Plans:
- [x] 01-01-PLAN.md — Flask 路由注册 + editor.html 4 面板布局骨架（CSS + HTML 结构）
- [x] 01-02-PLAN.md — 三层 Canvas 初始化、图片加载、缩放系统、像素检查器
- [x] 01-03-PLAN.md — 浏览器验证检查点（Phase 1 成功标准全部确认）

### Phase 2: History
**Goal**: Every drawing and editing action can be undone and redone without data loss
**Depends on**: Phase 1
**Requirements**: HIST-01, HIST-02
**Implementation note**: Phase 2 delivers only the undo/redo infrastructure (`pushHistory()` / `undo()` / `redo()`). Since no real tools exist yet, a temporary test scaffold — a canvas click listener that calls `pushHistory()` + `setPixel()` — is added solely to make the success criteria verifiable. This scaffold is removed at the start of Phase 3.
**Success Criteria** (what must be TRUE):
  1. Clicking on the canvas three times (via the temporary scaffold) produces three distinct pixel changes; pressing Cmd+Z three times restores the canvas to its exact pre-edit state
  2. After undoing, pressing Shift+Cmd+Z re-applies the actions in order
  3. Undo and redo buttons are visible and active in the top bar at all times
  4. Each canvas click counts as exactly one undo step (confirmed by verifying the history stack length equals the number of clicks)
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — pushHistory/undo/redo 实现、MAX_HISTORY=100、按钮状态管理、键盘快捷键、临时测试脚手架
- [x] 02-02-PLAN.md — Playwright 自动化验证 + 人工视觉验证检查点（Phase 2 成功标准全部确认）

### Phase 3: Core Tools
**Goal**: User can draw, erase, and flood-fill pixels on the canvas, selecting colors with the permanent color picker
**Depends on**: Phase 2
**Requirements**: DRAW-01, DRAW-02, DRAW-03, DRAW-04, DRAW-05, DRAW-06, CLR-01, CLR-02, CLR-03, CLR-04
**Implementation note**: First task of this phase is to remove the Phase 2 temporary test scaffold (the canvas click listener used for history verification). History convention (established in Phase 2): use the "save-after" model — call `pushHistory()` **after** pixel changes are applied, not before. For stroke tools (Pencil, Eraser), call `pushHistory()` on `pointerup` (after stroke completes), not on `pointerdown`. For instant-apply tools (Paint Bucket), call `pushHistory()` immediately after the fill operation.
**Eyedropper (取色器) implementation**: 优先使用浏览器原生 `EyeDropper` Web API（Chrome 95+/Edge 95+），可跨整个屏幕取色，包括编辑器 UI 区域及浏览器窗口外。在不支持该 API 的浏览器（Firefox/Safari）中自动降级为画布内取色模式。取色完成后自动恢复上一个激活工具，无需手动切换。
**Success Criteria** (what must be TRUE):
  1. The Phase 2 test scaffold (temporary click listener) has been removed from the codebase
  2. User can draw on the canvas with Pencil (B) using round or square brush shapes at any integer diameter from 1px up, and each stroke is one undo step
  3. User can erase pixels to transparency with Eraser (E) using the same brush options as Pencil
  4. User can flood-fill a bounded region with Paint Bucket (G) using adjustable tolerance and contiguous/non-contiguous mode
  5. The permanent color picker (bottom-left) lets the user set the active drawing color via HSL wheel, eyedropper click on the canvas, hex input, or RGB inputs — all four update the same active color
  6. Enabling Pixel-perfect mode on the Pencil visually removes the extra corner pixel that appears on diagonal strokes
**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md — 移除 Phase 2 脚手架 + 工具调度基础设施 + 铅笔工具 + 橡皮工具
- [x] 03-02-PLAN.md — Paint Bucket 工具（BFS 填充）+ 顶栏工具参数 UI
- [x] 03-03-PLAN.md — 常驻调色盘：HSL 色轮 + Hex/RGB 输入 + 取色器工具
- [x] 03-04-PLAN.md — Playwright 自动化验证 + 人工目视验证检查点

### Phase 4: Palette Panel
**Goal**: The Ver 1.1 palette system is available inside the editor and stays in sync with the active drawing color
**Depends on**: Phase 3
**Requirements**: PAL-01, PAL-02
**Success Criteria** (what must be TRUE):
  1. Clicking a swatch in the palette panel immediately updates the color picker to that color, ready for drawing
  2. When the color picker's active color matches a palette swatch, that swatch displays a visible highlight border
  3. The palette panel can be collapsed and expanded without losing palette state
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md — 色卡面板 HTML/CSS 移植 + JS 核心函数 + PAL-01 swatch 点击同步
- [ ] 04-02-PLAN.md — PAL-02 发光高亮 + applyPalette 结果预览面板 + web_ui.html 色卡代码删除
- [ ] 04-03-PLAN.md — 浏览器目视验证检查点（Phase 4 成功标准全部确认）

### Phase 04.1: Phase 4 返工：透明像素判断修正 + 色卡直接应用到画布 (INSERTED)

**Goal**: 修正色卡生成时对半透明像素的误计（导致出现虚假黑色等颜色）；将"应用色卡"改为直接写入画布并计入撤销历史，移除右侧非破坏性预览面板
**Requirements**: PAL-03（alpha 分类规则）, PAL-04（破坏性应用 + undo）
**Depends on:** Phase 4
**Plans:** 2 plans

**Success Criteria** (what must be TRUE):
  1. 对含半透明像素的图片生成色卡，只有 alpha ≥ 128 的像素参与颜色统计；alpha ≤ 127 的像素不会产生任何色号条目
  2. 点击"应用色卡"后，画布内容直接被替换（EditorState.pixels 更新，flushPixels 重绘）；alpha ≥ 128 的像素替换为最近色卡色（alpha=255），alpha ≤ 127 的像素替换为纯透明 (0,0,0,0)
  3. 应用色卡操作可以通过 Cmd+Z 撤销，完全还原到应用前的像素状态
  4. 右侧的非破坏性预览面板（原 palette-result-panel）已从 editor.html 移除

Plans:
- [ ] 04.1-01-PLAN.md — 修正 alpha 分类：色卡生成过滤 alpha ≤ 127 像素；应用色卡写入 EditorState.pixels + pushHistory
- [ ] 04.1-02-PLAN.md — 移除 palette-result-panel + 验证检查点

### Phase 4.2: 色卡面板 UI 整理 (INSERTED)

**Goal**: 重新整理色卡限制面板的 UI 结构：移除语义不清的顶部开关；整合"加载色卡"入口使面板布局更直观紧凑
**Depends on**: Phase 4.1
**Requirements**: PAL-UI
**Plans**: 2 plans

**Success Criteria** (what must be TRUE):
  1. 面板顶部没有 toggle 开关，色卡内容区直接呈现
  2. 布局从上到下为：当前色卡（含导出▼）→ combobox（命名/选择/保存）→ 生成区 → 固定底部（映射模式 select + 应用色卡）
  3. swatchesGrid 末尾有「+」色块，点击后将当前前景色追加到色卡
  4. combobox 的 ▼ 展开已保存列表，点击某条目自动加载该色卡；列表底部有「📁 从本地上传」
  5. 底部「映射 + 应用色卡」区域固定可见，不随内容滚动消失
  6. 应用色卡按钮门控仅依赖「有图像 && 色卡非空」，不再依赖已删除的 paletteEnabled 开关

Plans:
- [ ] 04.2-01-PLAN.md — HTML 骨架替换：新 #paletteBody 结构 + 新 CSS 类（pal-scroll-area / pal-sticky-bottom / add-swatch / combobox-row / export-dropdown）
- [ ] 04.2-02-PLAN.md — JS 接线：renderSwatches() + refreshSavedDropdown() + applyPalette() 模式读取 + 旧绑定清理 + 人工验证检查点

### Phase 5: Selection Tools
**Goal**: User can isolate a region of the canvas using Rectangle Marquee or Magic Wand, and drawing tools respect the selection boundary
**Depends on**: Phase 3 (runs in parallel with Phase 4)
**Requirements**: SEL-01, SEL-02, SEL-03, SEL-04, SEL-05
**Success Criteria** (what must be TRUE):
  1. Dragging Rectangle Marquee (M) on the canvas produces a selection that snaps to the detected pixel art grid, with a 1px animated marching-ants border visible during and after dragging
  2. Clicking Magic Wand (W) selects a region of similar-color pixels; Tolerance and Contiguous options visibly change the selection extent
  3. While a selection is active, pencil and eraser strokes are clipped to the selected region
  4. Pressing Cmd+D deselects; Shift+Cmd+I inverts the selection; both commands appear in the top bar while a selection is active
**Plans**: 4 plans

Plans:
- [x] 05-01-PLAN.md — 选区数据模型 + HTML 脚手架 + Rectangle Marquee 工具（网格吸附、拖拽预览、mask 提交）
- [x] 05-02-PLAN.md — Magic Wand 工具（BFS 产生像素 mask）+ 完成顶栏 Deselect/Inverse 按钮绑定
- [x] 05-03-PLAN.md — 工具裁剪（Pencil/Eraser/Bucket 受选区约束）+ Delete/Option+Delete 快捷键
- [x] 05-04-PLAN.md — 浏览器目视验证检查点（Phase 5 成功标准全部确认）

### Phase 05.1: selection visual polish - DPR fix inverse-color preview slow purple-gray ants (INSERTED)

**Goal:** 修复选区渲染的 DPR 双重应用 Bug（导致蚂蚁线 4px 宽粗线 + 紫灰色混色）；切换为 globalCompositeOperation='difference' 单白色反色描边，任何背景均可见
**Requirements**: VISUAL-FIX-01
**Depends on:** Phase 5
**Plans:** 1/1 complete (completed 2026-03-04 via Quick tasks 8–11)

**Success Criteria** (what must be TRUE):
  1. 蚂蚁线线宽为 1 逻辑像素（DPR=2 Retina 屏上为 2 物理像素），不再出现 4px 宽粗线
  2. 蚂蚁线在任意背景（黑/白/彩色）上均清晰可见——黑底显白边，白底显黑边（difference 合成保证）
  3. Marquee 拖拽预览虚线框与蚂蚁线视觉一致
  4. 紫灰色症状彻底消失
  5. rebuildAntsPath / scheduleAnts / 选区工具交互逻辑均未被改动

Plans:
- [x] 05.1-01-PLAN.md — 修复 drawAnts() + _marqueeDrawPreview() 双重 DPR + 反色合成 + 目视验证检查点

### Phase 6: Transform
**Goal**: User can move, scale, and rotate the contents of a selection using pixel-art-safe algorithms
**Depends on**: Phase 4 and Phase 5 (both must be complete)
**Requirements**: XFM-01, XFM-02, XFM-03, XFM-04, XFM-05
**Success Criteria** (what must be TRUE):
  1. With a selection active, Move Tool (V) lets the user drag selection contents to a new position; pixel distances from each canvas edge are displayed while dragging
  2. Eight transform handles appear around the active selection; dragging a handle scales the selection contents; X scale, Y scale, and a lock-aspect checkbox are editable in the top bar
  3. Rotating a selection using RotSprite produces pixel-art-quality results (no anti-aliasing artifacts); the rotation angle is editable in the top bar
  4. Pressing Enter applies a pending transform; pressing ESC cancels it and restores the original pixels; Apply and Cancel buttons are visible in the top bar during any active transform
**Plans**: 3 plans

Plans:
- [ ] 06-01-PLAN.md — Move(V) 工具浮动模型 + transformState 基础设施 + 距离标注 CSS overlay + Apply/Cancel
- [ ] 06-02-PLAN.md — 8-handle 缩放系统（nearest-neighbor）+ 顶栏 X%/Y%/Lock 输入绑定
- [ ] 06-03-PLAN.md — RotSprite 算法（scale2x×3 + 最近邻旋转 + 下采样）+ Angle° 输入 + 目视验证检查点

**Selection border implementation reference (from Phase 5.1 + Quick tasks 8–11):**

> Phase 6 的变换手柄边框、移动预览边框，必须用同一套坐标系实现。

架构要点：
- **`#selection-canvas` 在 `#canvas-area` 内，是 `#zoom-scroll-content` 的平级元素**，不在 `#zoom-container` 内。这是关键——selCanvas 不受 `transform: scale(zoom)` 影响。
- selCanvas 覆盖整个 canvas-area 视口（`clientWidth × clientHeight`），`position: absolute; top: 0; left: 0; pointer-events: none`。
- `selCtx` 仅 `scale(dpr, dpr)`，1 逻辑单位 = 1 CSS 像素。
- **坐标转换**（画布像素 → screen CSS 坐标）：
  ```javascript
  const caRect  = document.getElementById('canvas-area').getBoundingClientRect();
  const pixRect = pixelCanvas.getBoundingClientRect();
  const originX = pixRect.left - caRect.left;   // selCanvas CSS px
  const originY = pixRect.top  - caRect.top;
  const ps      = pixRect.width / EditorState.width;  // CSS px per canvas pixel
  // 画布坐标 (cx, cy) → selCanvas CSS 坐标: originX + cx*ps, originY + cy*ps
  ```
- **lineWidth = 2**（固定 2 CSS 像素，不除以 dpr 或 zoom，任何缩放等级均不变）。
- **外描边偏移 off = 1**（lineWidth/2），使 2px 描边完全落在选区外侧。
- 清除整个 selCanvas：`selCtx.clearRect(0, 0, selCanvas.width/dpr, selCanvas.height/dpr)`。

Phase 6 的变换手柄（8 个角/边控制点）也应在 selCanvas 上绘制，坐标同样通过上述公式计算，手柄尺寸固定为屏幕像素（如 8×8px CSS 方块），与 zoom 无关。

### Phase 7: Integration
**Goal**: The editor is reachable from the Ver 1.1 pipeline, canvas dimensions can be adjusted, and all outputs can be downloaded
**Depends on**: Phase 6
**Requirements**: ENTRY-01, UI-03, CANVAS-03, CFG-01, CFG-02, CFG-03, CFG-04
**Success Criteria** (what must be TRUE):
  1. After running grid alignment in `web_ui.html`, clicking "Open in Editor" loads the aligned image in `editor.html` with grid metadata and palette carried over via sessionStorage
  2. Switching to Canvas Size (S) mode shows four reference lines on the canvas that update in real time as the user types new Width, Height, or L/R/T/B values
  3. Clicking Apply in Canvas Size mode produces a new canvas with the correct dimensions; existing pixel content is shifted to the correct position
  4. Precision and scaled-up download buttons below the central canvas produce correct output files
  5. After applying a palette in the editor, the canvas is updated in-place with the palette colors applied; the operation appears in undo history
**Plans**: TBD

## Progress

**Execution Order:**
1 → 2 → 3 → [4 ∥ 5] → 6 → 7
Phase 4 (Palette Panel) and Phase 5 (Selection Tools) run in parallel after Phase 3 completes.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-03-02 |
| 2. History | 2/2 | Complete | 2026-03-03 |
| 3. Core Tools | 4/4 | Complete | 2026-03-03 |
| 4. Palette Panel | 3/3 | Complete | 2026-03-03 |
| 4.1. Phase 4 返工 (INSERTED) | 1/2 | In Progress|  |
| 4.2. 色卡面板 UI 整理 (INSERTED) | 1/2 | Complete    | 2026-03-03 |
| 5. Selection Tools | 4/4 | Complete | 2026-03-04 |
| 5.1. Selection Visual Polish (INSERTED) | 1/1 | Complete | 2026-03-04 |
| 6. Transform | 1/3 | In Progress|  |
| 7. Integration | 0/TBD | Not started | - |
