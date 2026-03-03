# Requirements: PerfectPixel Ver 1.2

**Defined:** 2026-03-02
**Core Value:** 让 AI 生成的像素画在一个工具里走完从粗糙到精准的全流程——网格对齐、编辑修正、色卡规范化，一气呵成，无需外部编辑器。

## v1 Requirements

Requirements for Ver 1.2 release. Each maps to roadmap phases.

### ENTRY — 编辑器入口

- [ ] **ENTRY-01**: 像素化处理完成后，结果区新增「在编辑器中打开」按钮，点击通过 sessionStorage 传递图像数据并跳转至 editor.html

### UI — 编辑器布局

- [x] **UI-01**: 编辑器为独立页面（editor.html），4 区布局：左栏 / 中央画布 / 右栏工具箱 / 顶栏参数
- [x] **UI-02**: 左栏包含色卡限制面板（可折叠）、画布编辑器面板（可折叠）、常驻调色盘（左下角固定）
- [ ] **UI-03**: 应用色卡后，中央画布右侧显示色卡映射对比图（含精准版/N倍放大版下载）

### CANVAS — 画布渲染

- [x] **CANVAS-01**: 画布支持缩放（CSS transform），缩放时工具坐标系保持 1:1 像素精度
- [x] **CANVAS-02**: 画布以 `image-rendering: pixelated` 渲染，禁止插值模糊
- [ ] **CANVAS-03**: 中央画布下方提供精准版下载和 N 倍放大版下载

### HIST — 撤销/重做

- [x] **HIST-01**: 支持撤销（Cmd+Z）/ 重做（Shift+Cmd+Z），覆盖所有绘图、变换、画布大小调整操作
- [x] **HIST-02**: 撤销/重做按钮常驻顶栏右侧

### CLR — 常驻调色盘

- [x] **CLR-01**: 颜色选择器（色相-饱和度实现），常驻左下角，不随面板折叠消失
- [x] **CLR-02**: 取色器（Eyedropper），点击画布像素取色并同步至调色盘
- [x] **CLR-03**: 十六进制颜色输入框（支持手动键入）
- [x] **CLR-04**: RGB 三通道数值输入框（支持手动键入）

### PAL — 色卡面板扩展

- [x] **PAL-01**: 点击色卡色块时，自动同步该颜色至常驻调色盘
- [ ] **PAL-02**: 调色盘当前颜色与色卡某色块匹配时，给该色块加高亮选框

### DRAW — 绘图工具

- [x] **DRAW-01**: Pencil Tool（快捷键 B）：支持圆形（Pixel Circle）/ 方形笔头
- [x] **DRAW-02**: Pencil Tool（快捷键 B）：支持画笔直径（从 1px 起的整数）
- [x] **DRAW-03**: Pencil Tool（快捷键 B）：支持 Pixel-perfect 模式勾选框
- [x] **DRAW-04**: Paint Bucket Tool（快捷键 G）：支持 Tolerance 容差参数（数值输入）
- [x] **DRAW-05**: Paint Bucket Tool（快捷键 G）：支持 Contiguous 勾选框（是否只选毗邻像素）
- [x] **DRAW-06**: Eraser Tool（快捷键 E）：与 Pencil 共用形状/直径/Pixel-perfect 逻辑，绘制透明像素

### SEL — 选区工具

- [x] **SEL-01**: Rectangle Marquee Tool（快捷键 M）：选区对齐到检测到的像素网格
- [x] **SEL-02**: Rectangle Marquee Tool（快捷键 M）：拖动时实时显示 1px 宽反色虚线选区边界（Aseprite 风格）
- [x] **SEL-03**: Magic Wand Tool（快捷键 W）：支持 Tolerance 容差参数
- [x] **SEL-04**: Magic Wand Tool（快捷键 W）：支持 Contiguous 勾选框
- [x] **SEL-05**: 选区激活时，顶栏显示 Deselect（Cmd+D）和 Inverse（Shift+Cmd+I）

### XFM — 变换工具

- [ ] **XFM-01**: 选区四角+四边共 8 个控制点，拖拽可进行缩放变换
- [ ] **XFM-02**: 选区旋转使用 RotSprite 算法（JavaScript 重新实现 Aseprite 的 Scale2x×3 + 最近邻旋转 + 下采样流程）
- [ ] **XFM-03**: 变换/旋转激活时，顶栏显示 Apply ☑️（Enter）和 Cancel ✖️（ESC）
- [ ] **XFM-04**: 变换/旋转激活时，顶栏显示 X 缩放倍率、Y 缩放倍率（可键入）、等比缩放勾选框、旋转角度（可键入）
- [ ] **XFM-05**: Move Tool（快捷键 V）：移动选区时显示选区距画布四边的像素距离

### CFG — 画布大小

- [ ] **CFG-01**: Canvas Size（快捷键 S）：进入模式后显示 4 根参考线实时预览新画布边界
- [ ] **CFG-02**: Canvas Size 参数：Width（宽）、Height（高）（可键入）
- [ ] **CFG-03**: Canvas Size 参数：Left / Right / Top / Bottom（正值扩张，负值收缩，可键入）
- [ ] **CFG-04**: 点击「应用」后生成新画布，旧画布内容按偏移量移动到正确位置

## v2 Requirements

Acknowledged but deferred to Ver 1.3+.

### 绘图增强

- **DRAW-V2-01**: 画笔直径 > 1px 时的圆形像素圈（Zingl 椭圆算法）
- **DRAW-V2-02**: 网格叠加显示（画布上显示像素网格参考线）

### 持久化

- **PERSIST-V2-01**: 服务端色卡持久化（替换 localStorage）

## Out of Scope

| Feature | Reason |
|---------|--------|
| 图层系统 | 超出 Ver 1.2 目标范围；复杂度乘数过大，考虑 Ver 2.0 |
| 动画帧/时间轴 | 与像素画后处理定位无关 |
| 批量处理 | Ver 1.2 不涉及，留给后续版本 |
| OAuth/用户账户 | 本地工具，不需要 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENTRY-01 | Phase 7 | Pending |
| UI-01 | Phase 1 | Complete |
| UI-02 | Phase 1 | Complete |
| UI-03 | Phase 7 | Pending |
| CANVAS-01 | Phase 1 | Complete |
| CANVAS-02 | Phase 1 | Complete |
| CANVAS-03 | Phase 7 | Pending |
| HIST-01 | Phase 2 | Complete |
| HIST-02 | Phase 2 | Complete |
| CLR-01 | Phase 3 | Complete |
| CLR-02 | Phase 3 | Complete |
| CLR-03 | Phase 3 | Complete |
| CLR-04 | Phase 3 | Complete |
| PAL-01 | Phase 4 | Complete |
| PAL-02 | Phase 4 | Pending |
| DRAW-01 | Phase 3 | Complete |
| DRAW-02 | Phase 3 | Complete |
| DRAW-03 | Phase 3 | Complete |
| DRAW-04 | Phase 3 | Complete |
| DRAW-05 | Phase 3 | Complete |
| DRAW-06 | Phase 3 | Complete |
| SEL-01 | Phase 5 | Complete |
| SEL-02 | Phase 5 | Complete |
| SEL-03 | Phase 5 | Complete |
| SEL-04 | Phase 5 | Complete |
| SEL-05 | Phase 5 | Complete |
| XFM-01 | Phase 6 | Pending |
| XFM-02 | Phase 6 | Pending |
| XFM-03 | Phase 6 | Pending |
| XFM-04 | Phase 6 | Pending |
| XFM-05 | Phase 6 | Pending |
| CFG-01 | Phase 7 | Pending |
| CFG-02 | Phase 7 | Pending |
| CFG-03 | Phase 7 | Pending |
| CFG-04 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 — traceability finalized after roadmap creation*
