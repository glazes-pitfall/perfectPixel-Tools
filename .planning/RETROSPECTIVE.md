# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.2 — Pixel Art Editor

**Shipped:** 2026-03-04
**Phases:** 10 (7 planned + 3 inserted) | **Plans:** 29 | **Timeline:** 3 days

### What Was Built
- 完整的浏览器像素编辑器 `editor.html`（4,954 行单文件）——三层 Canvas + EditorState 架构
- 铅笔/橡皮/油漆桶 + 矩形选框/魔棒 + Move/缩放/RotSprite 旋转，共 7 种工具
- 快照式撤销/重做，支持跨画布尺寸变更；Canvas Size 工具；sessionStorage 入口握手；整数倍下载
- 色卡系统从 Ver 1.1 完整移植，并升级为破坏性写入 + undo 模式

### What Worked
- **GSD 计划驱动**：每个 Phase 先研究再规划，避免了大量试错——特别是 RotSprite 算法（Phase 6）提前研究 Aseprite C++ 实现，直接产出正确的 JS 版本
- **三层 Canvas 架构决策**：Phase 1 确立 pixel-canvas 禁 DPR + EditorState.pixels 唯一数据源，之后所有工具和变换无需修改坐标系
- **Playwright 自动化验证**：Phase 2/4.2/7 使用 Playwright 脚本验证，减少人工回归测试负担
- **快速插入 decimal phase**：Phase 4.1/4.2/5.1 在发现设计问题后快速插入修正，不影响后续阶段编号

### What Was Inefficient
- **Phase 4 返工**（Phase 4.1/4.2 插入）：applyPalette 起初设计为非破坏性预览，Phase 4 完成后用户明确要求改为破坏性写入，导致两个额外 phase 返工。若初始设计阶段更仔细讨论「应用语义」可避免
- **蚂蚁线视觉问题**（Quick tasks 8-11）：Phase 5 已完成后才发现 DPR 双重应用 bug，额外花了 4 个 quick task 修复。selCanvas 坐标系（不在 zoom-container 内）的约束应在 Phase 5 规划中明确
- **03-04/05-04 SUMMARY 缺失**：视觉验证检查点 plan 没有生成 SUMMARY.md，导致里程碑归档时显示 3/4 plans

### Patterns Established
- `history entry = {pixels, width, height}` 而非仅 pixels — 支持画布尺寸 undo（Phase 7 经验）
- `selCanvas` 必须在 `canvas-area` 内（不在 `zoom-container` 内）— 不受 CSS transform:scale 影响
- `difference` 合成描边 — 任意背景均可见，单次绘制即可（Phase 5.1 经验）
- save-after 模型：`pushHistory()` 在操作完成后调用（即时工具 bucket 除外）
- EyeDropper Web API 优先，降级到画布内取色 — 跨平台覆盖率最优

### Key Lessons
1. **设计阶段确认「写入语义」**：破坏性 vs 非破坏性应用是用户体验核心决策，必须在 Phase 0 期间与用户对齐，而非实现后再改
2. **overlay canvas 坐标系要在 Phase 1 完全文档化**：selCanvas 不跟随 zoom 的约束如果在 Phase 1 确立，Phase 5/6 的实现就能直接正确
3. **视觉验证 plan 应生成 SUMMARY**：即使没有代码，UAT 结论也应记录在 SUMMARY.md 中，否则归档时计划计数不一致
4. **quick task 用于 hotfix 有效**：11 个 quick task 快速修复了多个视觉和 bug 问题，不打乱正式 phase 流程

### Cost Observations
- 主要模型：claude-sonnet-4-6（执行），搭配专用 subagent（gsd-executor, gsd-planner, gsd-verifier）
- 3 天内完成 7 个 phase + 3 个插入 phase，平均每天约 3-4 个 phase

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.2 | 10 | 29 | 首次使用 GSD 工作流；建立了 decimal phase 插入模式 |

### Top Lessons (Verified Across Milestones)

1. 「写入语义」（破坏性 vs 非破坏性）在设计阶段必须明确
2. Overlay canvas 坐标系约束须在 Phase 1 完全文档化
