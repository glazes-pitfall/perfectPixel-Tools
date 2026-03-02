# PerfectPixel Ver 1.2

## What This Is

PerfectPixel 是一个专为 AI 生成像素画设计的本地 Web 工具。Ver 1.1 提供了自动网格对齐和色卡管理功能；Ver 1.2 在此基础上新增一个完整的像素级编辑器，让用户在完成网格对齐后可以直接在浏览器中修正细节、重新调整构图，最终通过色卡限制输出符合目标调色盘的作品。

工具面向使用 AI 生成像素画素材的创作者，目标是把"AI 生成 → 网格精炼 → 手工修正 → 色卡规范化"这条完整工作流集中在一个工具内完成，无需在多个软件间来回切换。

## Core Value

**让 AI 生成的像素画在一个工具里走完从粗糙到精准的全流程**——网格对齐、编辑修正、色卡规范化，一气呵成，无需外部编辑器。

## Requirements

### Validated

<!-- Ver 1.1 已验证的功能 -->

- ✓ 基于 FFT 自动检测像素网格尺寸 — Ver 1.1
- ✓ 用 Sobel 边缘检测精细化网格线对齐 — Ver 1.1
- ✓ 三种采样方式（center / median / majority） — Ver 1.1
- ✓ 手动指定网格尺寸覆盖自动检测 — Ver 1.1
- ✓ fix_square 正方形修正选项 — Ver 1.1
- ✓ Web UI 上传图片 → 输出精准版 + N 倍放大版 — Ver 1.1
- ✓ 色卡生成（FastOctree / MaxCoverage / MedianCut / 覆盖增强） — Ver 1.1
- ✓ 色卡应用（向量映射 / LAB 映射 / 色卡替换） — Ver 1.1
- ✓ 色卡格式解析（.gpl / .pal / .act / PNG） — Ver 1.1
- ✓ 色卡格式导出（.gpl / .pal / .act） — Ver 1.1
- ✓ 色块编辑器（RGB + 颜色选择器） — Ver 1.1
- ✓ 色卡本地保存（localStorage） — Ver 1.1

### Active

<!-- Ver 1.2 目标新增功能 -->

**编辑器入口**
- [ ] 像素化处理完成后，结果区新增「在编辑器中打开」按钮，点击跳转至编辑器页面

**编辑器整体布局**
- [ ] 编辑器为独立页面（非弹窗），布局为：左栏 / 中央画布 / 右栏 / 顶栏
- [ ] 左栏：色卡限制面板（从 Ver 1.1 平移，可折叠）+ 画布编辑器面板（可折叠）+ 常驻调色盘（左下角固定）
- [ ] 右栏：工具箱面板（6 种工具图标 + 快捷键提示）
- [ ] 顶栏：当前工具的详细参数设置区 + 撤销/重做按钮（常驻右侧）
- [ ] 中央画布：可编辑图像（下方有精准版/N 倍放大版下载）；应用色卡后右侧显示色卡映射对比图

**常驻调色盘**
- [ ] 颜色选择器（Hue-Saturation 圆盘或类似实现）
- [ ] 取色器（Eyedropper，点击画布像素取色）
- [ ] 十六进制颜色输入框
- [ ] RGB 三通道数值输入框

**色卡面板扩展（在 Ver 1.1 基础上新增）**
- [ ] 点击色卡中某个颜色时，自动同步该颜色至常驻调色盘
- [ ] 调色盘当前颜色与色卡中某颜色匹配时，给该色卡色块加高亮选框

**Rectangle Marquee Tool（快捷键 M）**
- [ ] 选区对齐到像素网格（基于检测到的 grid 尺寸）
- [ ] 拖动时实时显示选区边界（1px 宽反色虚线框，Aseprite 风格）

**Magic Wand Tool（快捷键 W）**
- [ ] Tolerance 容差参数（数值输入）
- [ ] Contiguous 勾选框（是否只选毗邻像素）

**选区通用功能**
- [ ] 选区激活时，顶栏显示：Deselect (Cmd+D) 和 Inverse (Shift+Cmd+I)
- [ ] 选区四角 + 四边共 8 个控制点，拖拽可进行变换
- [ ] 变换/旋转使用 RotSprite 算法（参考 Aseprite 实现）
- [ ] 变换激活时，顶栏显示：Apply ☑️（Enter）、Cancel ✖️（ESC）、X 缩放倍率、Y 缩放倍率、等比缩放勾选框、旋转角度（均可键入）

**Move Tool（快捷键 V）**
- [ ] 移动选区内容时，显示选区距画布四边的像素距离（Aseprite 风格）

**Pencil Tool（快捷键 B）**
- [ ] 画笔形状：圆形（Pixel Circle）/ 方形
- [ ] 画笔直径：从 1px 起的整数
- [ ] Pixel-perfect 模式勾选框（避免对角线出现多余像素）

**Paint Bucket Tool（快捷键 G）**
- [ ] Tolerance 容差参数
- [ ] Contiguous 勾选框

**Eraser Tool（快捷键 E）**
- [ ] 与 Pencil Tool 共用形状/直径/Pixel-perfect 逻辑，绘制透明像素

**撤销 / 重做**
- [ ] 撤销（Cmd+Z）/ 重做（Shift+Cmd+Z）常驻顶栏右侧
- [ ] 支持所有绘图、变换、画布大小调整操作

**Canvas Size（快捷键 S）**
- [ ] 进入模式后显示 4 根参考线（实时预览新画布边界）
- [ ] 参数：宽（Width）、高（Height）
- [ ] 边界扩张：Left / Right / Top / Bottom（正值扩张，负值收缩）
- [ ] 点击「应用」后生成新画布，旧内容位置对应偏移

### Out of Scope

- 图层系统 — 超出 Ver 1.2 目标范围，考虑 Ver 2.0
- 动画帧 / 时间轴 — 与像素画后处理定位无关
- 服务端色卡持久化 — LocalStorage 暂时够用，Ver 1.3 再考虑
- 批量处理 — Ver 1.2 不涉及，留给后续版本

## Context

**现有代码基础（Ver 1.1）：**
- 核心算法库：`src/perfect_pixel/`（禁止改动，已发布到 PyPI）
- Web 后端：`web_app.py`（Flask，port 5010）
- Web 前端：`web_ui.html`（单文件，内联 CSS + JS，无构建步骤）
- 色卡功能完整：生成、编辑、应用、导出均已实现

**编辑器技术参考：**
- 参考 Aseprite 的像素编辑算法和 UX 模式（Aseprite 代码公开：https://github.com/aseprite/aseprite，C++ 实现，参考逻辑不复制代码）
- RotSprite 旋转算法是 Aseprite 核心算法之一，需用 JavaScript/Python 重新实现

**UI 一致性：**
- 沿用 Ver 1.1 暗色主题（`--bg: #0f0f13`，紫色 accent `#7c6af7`）
- 编辑器前端同样作为单文件或扩展至 `web_ui.html`，无需引入构建工具

## Constraints

- **技术栈**：后端 Python + Flask，前端纯 HTML/JS/CSS，禁止引入打包工具（webpack、vite 等）
- **核心库保护**：`src/perfect_pixel/` 目录下的两个算法文件禁止修改
- **依赖限制**：不给核心库添加新依赖；Web 层可按需使用已有依赖（Flask, OpenCV, NumPy, Pillow）
- **单文件前端**：编辑器 UI 沿用内联风格，不引入外部框架（React/Vue 等）

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 编辑器为独立页面而非弹窗 | 编辑器工具栏、画布、色卡面板需要大量屏幕空间 | — Pending |
| 色卡面板直接平移，不重写 | 节省开发量，行为已经过验证 | — Pending |
| RotSprite 列为 Ver 1.2 必须项 | 用户明确要求；基本缩放配合 RotSprite 才算完整变换体验 | — Pending |
| 选区基于像素网格对齐 | AI 像素画的核心特性就是网格规整，选区不对齐会破坏操作感 | — Pending |

---
*Last updated: 2026-03-02 after initialization*
