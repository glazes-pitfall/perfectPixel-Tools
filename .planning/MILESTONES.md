# Milestones

## v1.2 Pixel Art Editor (Shipped: 2026-03-04)

**Phases completed:** 10 phases, 29 plans, 166 commits
**Timeline:** 2026-03-02 → 2026-03-04 (3 days)
**Scale:** +32,154 lines across 146 files; `editor.html` 4,954 LOC

**Key accomplishments:**
1. 构建完整的单文件浏览器像素编辑器 (`editor.html`) — 三层 Canvas 架构，DPR 正确隔离，EditorState 作为唯一像素数据源
2. 实现快照式撤销/重做，覆盖所有绘图与画布尺寸变更，支持跨尺寸 undo（history entry 含 width/height）
3. 交付铅笔（B）、橡皮（E）、油漆桶（G）+ HSL 色轮 + EyeDropper API + Hex/RGB 调色盘
4. 移植 Ver 1.1 色卡系统：破坏性应用直接写入 EditorState.pixels、Alpha 分类修正、双向调色盘同步
5. 实现矩形选框（M）+ 魔棒（W）+ difference 合成 Aseprite 风格蚂蚁线，绘图工具受选区边界约束
6. 交付 RotSprite 旋转（JS 实现 Scale2×3 + 最近邻旋转 + 下采样）+ 8 控制点缩放 + 角手柄双模式
7. 完成 Ver 1.1 → 编辑器 sessionStorage 握手、Canvas Size 工具（S 键）和整数倍精确下载弹窗

**Known Gaps:**
- UI-03（色卡对比图）推迟至 Ver 1.3+：Phase 4.1 确立破坏性应用模式后，非破坏性预览面板已不兼容

---
