# PerfectPixel

## What This Is

PerfectPixel 是一个专为 AI 生成像素画设计的本地 Web 工具。Ver 1.1 提供自动网格对齐和色卡管理功能；Ver 1.2 在此基础上新增一个完整的单文件浏览器像素编辑器（`editor.html`），让用户完成网格对齐后可直接在浏览器中修正细节、重新调整构图，最终通过色卡限制输出符合目标调色盘的作品。

**当前状态：** Ver 1.2 已发布（2026-03-04）。`editor.html` 为 4,954 行单文件，包含完整绘图/选区/变换/下载功能集。

## Core Value

**让 AI 生成的像素画在一个工具里走完从粗糙到精准的全流程**——网格对齐、编辑修正、色卡规范化，一气呵成，无需外部编辑器。

## Requirements

### Validated (Ver 1.1 + Ver 1.2)

<!-- Ver 1.1 已验证 -->
- ✓ 基于 FFT 自动检测像素网格尺寸 — v1.1
- ✓ 用 Sobel 边缘检测精细化网格线对齐 — v1.1
- ✓ 三种采样方式（center / median / majority） — v1.1
- ✓ 手动指定网格尺寸覆盖自动检测 — v1.1
- ✓ fix_square 正方形修正选项 — v1.1
- ✓ Web UI 上传图片 → 输出精准版 + N 倍放大版 — v1.1
- ✓ 色卡生成（FastOctree / MaxCoverage / MedianCut / 覆盖增强） — v1.1
- ✓ 色卡应用（向量映射 / LAB 映射 / 色卡替换） — v1.1
- ✓ 色卡格式解析（.gpl / .pal / .act / PNG） — v1.1
- ✓ 色卡格式导出（.gpl / .pal / .act） — v1.1
- ✓ 色块编辑器（RGB + 颜色选择器） — v1.1
- ✓ 色卡本地保存（localStorage） — v1.1

<!-- Ver 1.2 已验证 -->
- ✓ 像素化完成后「在编辑器中打开」按钮（sessionStorage 握手）— v1.2
- ✓ 编辑器独立页面（editor.html），4 区布局，沿用 Ver 1.1 暗色主题 — v1.2
- ✓ 常驻调色盘：HSL 色轮 + 取色器 + Hex/RGB 输入 — v1.2
- ✓ 色卡面板移植：swatch 点击同步调色盘，调色盘颜色高亮匹配色块 — v1.2
- ✓ 色卡应用改为破坏性写入（直接更新 EditorState.pixels，可 undo）— v1.2
- ✓ Alpha 分类修正：alpha ≤ 127 像素不参与色卡统计 — v1.2
- ✓ 矩形选框（M）：网格吸附 + Aseprite 风格蚂蚁线 — v1.2
- ✓ 魔棒（W）：BFS 像素 mask + Tolerance + Contiguous — v1.2
- ✓ 铅笔（B）/ 橡皮（E）/ 油漆桶（G）+ Pixel-perfect 模式 — v1.2
- ✓ 快照式撤销/重做，覆盖全部操作，跨画布尺寸变更 — v1.2
- ✓ RotSprite 旋转（Scale2×3 + 最近邻旋转 + 下采样）— v1.2
- ✓ 8 控制点缩放变换 + 角手柄双模式（缩放/旋转切换）— v1.2
- ✓ Move Tool（V）：移动选区时显示四边距离标注 — v1.2
- ✓ Canvas Size（S）：6 参数参考线实时预览 + Apply — v1.2
- ✓ 整数倍精确下载弹窗（client-side toBlob，imageSmoothingEnabled=false）— v1.2

### Active

（Ver 1.3 目标需求——本里程碑完成后由 /gsd:new-milestone 定义）

### Out of Scope

| Feature | Reason |
|---------|--------|
| UI-03 色卡应用对比图 | Phase 4.1 确立破坏性应用模式后，非破坏性预览不兼容；推迟至 Ver 1.3+ |
| 图层系统 | 超出当前目标范围；复杂度乘数过大，考虑 Ver 2.0 |
| 动画帧/时间轴 | 与像素画后处理定位无关 |
| 批量处理 | Ver 1.2 不涉及，留给后续版本 |
| OAuth/用户账户 | 本地工具，不需要 |
| 服务端色卡持久化 | localStorage 暂时够用，Ver 1.3 再考虑 |

## Context

**当前代码基础（Ver 1.2）：**
- 核心算法库：`src/perfect_pixel/`（禁止改动，已发布到 PyPI）
- Web 后端：`web_app.py`（Flask，port 5010），566 行
- Web 前端：`web_ui.html`（网格对齐 UI），402 行
- 像素编辑器：`editor.html`（完整像素编辑器），4,954 行，无构建步骤

**关键技术约束（Ver 1.2 确立）：**
- pixel-canvas 禁止 DPR 缩放（1:1 对应图像坐标）；overlay canvases 使用 DPR
- 所有像素读写通过 EditorState.pixels（Uint8ClampedArray），从不读取 canvas 元素（premultiplied alpha 隔离）
- RotSprite 限制 128×128px 以内（防止内存冻结）
- History entry 存储 {pixels, width, height} 而非仅 pixels（支持画布尺寸 undo）

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 编辑器为独立页面而非弹窗 | 需要大量屏幕空间给工具栏/画布/色卡面板 | ✓ 正确——4 区布局在全屏模式下体验良好 |
| 色卡面板直接平移，不重写 | 节省开发量，行为已验证 | ✓ 正确——平移顺利，节省了约 2 个计划 |
| RotSprite 列为必须项 | 用户明确要求；基本缩放配合 RotSprite 才算完整变换体验 | ✓ 正确——算法按 Aseprite 规格实现 |
| 选区基于像素网格对齐 | AI 像素画的核心特性 | ✓ 正确——SEL-01 网格吸附已实现 |
| 色卡应用改为破坏性写入（Phase 4.1） | 非破坏性预览面板语义混乱，用户直接要求 | ✓ 正确——undo 支持弥补了不可逆顾虑 |
| pixel-canvas 禁止 DPR | getImageData/putImageData 忽略 canvas transform | ✓ 正确——避免了全局坐标系崩溃 |
| history entry = {pixels, width, height} | applyCanvasSize 改变尺寸后 undo 需还原尺寸 | ✓ 正确——跨尺寸 undo 正常工作 |
| selCanvas 在 canvas-area 内（不在 zoom-container 内） | 不受 CSS transform:scale 影响 | ✓ 正确——手柄和蚂蚁线尺寸与 zoom 无关 |
| difference 合成替代双色描边（蚂蚁线） | 任意背景均可见，无需两遍绘制 | ✓ 正确——Quick task 8–11 验证效果好 |

## Constraints

- **技术栈**：后端 Python + Flask，前端纯 HTML/JS/CSS，禁止引入打包工具
- **核心库保护**：`src/perfect_pixel/` 禁止修改
- **依赖限制**：不给核心库添加新依赖；Web 层可使用 Flask, OpenCV, NumPy, Pillow
- **单文件前端**：editor.html 沿用内联风格，不引入外部框架

---
*Last updated: 2026-03-04 after v1.2 milestone*
