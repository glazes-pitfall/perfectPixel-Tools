# Perfect Pixel — Ver 1.1 版本说明

> 打包时间：2026-02-19
> 基于原项目：[theamusing/perfectPixel](https://github.com/theamusing/perfectPixel)

---

## 版本定位

Ver 1.1 是在原始 perfectPixel 算法库基础上构建的**本地 Web UI 增强版**。原项目仅提供 Python API 和 ComfyUI 集成；本版本在此之上增加了完整的浏览器操作界面（`web_app.py` + `web_ui.html`），无需任何前端构建工具，开箱即用。

---

## 运行方式

```bash
pip install flask opencv-python numpy pillow
python3 web_app.py
# 浏览器访问 http://localhost:5001
```

---

## 功能清单

### 一、核心算法（原版 perfectPixel，未改动）

| 功能 | 说明 |
|------|------|
| 自动网格检测 | 基于 FFT 频谱分析检测像素网格尺寸，无需手动指定 |
| 网格精细化 | 用 Sobel 边缘检测将网格线对齐到真实像素边界 |
| 像素采样 | 支持 `center`（中心点）、`median`（中位数）、`majority`（众数）三种采样方式 |
| 手动覆盖 | 可手动指定 `grid_w × grid_h`，跳过自动检测 |
| 正方形修正 | `fix_square` 选项：当检测结果接近正方形时强制输出正方形 |

**底层实现：**
- `src/perfect_pixel/perfect_pixel.py`（OpenCV 后端，速度快）
- `src/perfect_pixel/perfect_pixel_noCV2.py`（仅 NumPy，轻量后端）

---

### 二、Web 后端 `web_app.py`

基于 Flask，在本地 5001 端口提供以下 API：

| 端点 | 方法 | 功能 |
|------|------|------|
| `/` | GET | 返回 web_ui.html |
| `/api/process` | POST | 上传图片 → 自动检测并输出像素图（精准版 + 放大版） |
| `/api/generate-palette` | POST | 从图像自动生成色卡（FastOctree / MaxCoverage / MedianCut / 覆盖增强算法） |
| `/api/apply-palette` | POST | 将指定色卡应用到像素图（向量映射 / LAB 映射 / 色卡替换三种模式） |
| `/api/parse-palette` | POST | 解析上传的色卡文件（支持 .gpl / .pal / .act / .png 格式） |
| `/api/export-palette` | POST | 将当前色卡导出为指定格式 |

**后端辅助算法：**

- **RGB → LAB 转换**（`rgb_to_lab()`）：用于感知均匀的颜色距离计算
- **色卡应用 — 向量映射**（`apply_palette_vector()`）：每个像素找最近色卡色，支持 RGB 和 LAB 空间
- **色卡应用 — 色卡替换**（`apply_palette_swap()`）：先量化到中间色卡，再做 one-to-one 映射
- **覆盖增强算法**（`quantize_coverage_boost()`）：自定义量化算法，在标准 FastOctree 基础上用形态学开运算 + 连通域分析找出被忽略的小色块区域，额外补充代表色，适合主色调强势导致小面积颜色被压缩的场景
- **色卡格式解析**：`parse_gpl()` / `parse_pal()` / `parse_act()` / `parse_png_palette()`
- **色卡格式导出**：`export_gpl()` / `export_pal()` / `export_act()`

---

### 三、Web 前端 `web_ui.html`

单文件，内联 CSS + JS，无外部依赖。

#### 布局

```
┌─────────────────────────────────────────┐
│  Header: Perfect Pixel  [本地版]         │
├─────────────┬───────────────────────────┤
│  左侧边栏    │  右侧主区域               │
│  (可独立滚动) │  (可独立滚动)            │
│  · 处理参数  │  ┌──────┐ ┌──────┐      │
│  · 色卡限制  │  │ 原图  │ │ 输出  │     │
│             │  └──────┘ └──────┘      │
│             │  ┌──────┐ ┌──────┐      │
│             │  │ 色卡  │ │色卡结果│    │
│             │  └──────┘ └──────┘      │
└─────────────┴───────────────────────────┘
```

#### 核心交互功能

**图像处理区：**
- 拖拽或点击上传图片（支持原图 Input 卡直接拖入）
- 处理参数：采样方式（中心点 / 中位数 / 众数）、手动网格尺寸、`fix_square`
- 处理结果显示：精准版（像素 1:1）+ 放大版（×8 预览）
- 下载：精准版 PNG / 放大版 PNG

**色卡限制区（Sidebar 可折叠面板）：**

| 子功能 | 说明 |
|--------|------|
| 上传色卡 | 支持拖拽/点击上传 .gpl / .pal / .act / PNG 色卡图片 |
| 自动生成色卡 | 从当前图像提取颜色，支持 FastOctree / MaxCoverage / MedianCut / 覆盖增强 4 种算法 |
| 颜色数量 | 滑块（2~64）+ 数字输入框（无上限，支持 128、256 等） |
| 色卡预览 | 色块网格展示，支持点击单个色块弹出颜色编辑器（RGB 三通道 + 颜色选择器） |
| 保存色卡 | 命名保存到本地 LocalStorage，下拉框切换（含色块预览） |
| 应用色卡 | 3 种映射模式：向量映射 / LAB 映射 / 色卡替换 |
| 导出色卡 | 导出为 .gpl / .pal / .act 格式 |

**色卡结果卡：**
- 显示应用色卡后的像素图（精准版 + 放大版）
- 下载精准版 / 放大版

#### UI 技术细节

- **暗色主题**：`--bg: #0f0f13`，紫色 accent `#7c6af7`
- **独立滚动**：`body { height:100vh; overflow:hidden }` + sidebar / main 各自 `overflow-y:auto`；sidebar flex 子项 `flex-shrink:0` 防止内容被压缩
- **色卡 UI**：自定义色块网格（非 `<select>`），可折叠面板（`.palette-section`）
- **颜色编辑弹窗**：绝对定位 popup，智能防溢出（检测 viewport 边界自动翻转方向）
- **Loading 状态**：全局 spinner + 按钮 disabled 状态联动
- **状态栏**：处理进度、错误、成功消息统一显示

---

## 项目文件结构

```
perfectPixel/
├── web_app.py          # Flask 后端（本地 Web UI 核心，Ver1.1 新增）
├── web_ui.html         # 前端单文件（本地 Web UI 核心，Ver1.1 新增）
├── VERSION_1.1.md      # 本文件
├── src/
│   └── perfect_pixel/
│       ├── perfect_pixel.py         # 核心算法（OpenCV 后端）
│       └── perfect_pixel_noCV2.py  # 核心算法（NumPy 后端）
├── integrations/
│   └── comfyui/        # ComfyUI 节点集成
├── assets/             # 文档图片资源
├── images/             # 示例图片
├── example.py          # 原版 API 使用示例
├── pyproject.toml      # 包配置
└── readme.md           # 原版说明文档
```

---

## 与原版的差异

| 项目 | 原版（≤1.0） | Ver 1.1 |
|------|------------|---------|
| 使用方式 | Python API / ComfyUI 节点 | 浏览器 Web UI |
| 色卡功能 | 无 | 完整色卡生成、编辑、应用、导出 |
| 覆盖增强算法 | 无 | `quantize_coverage_boost()` |
| 颜色映射 | 无 | 向量映射 / LAB 映射 / 色卡替换 |
| 色卡格式支持 | 无 | GPL / PAL / ACT / PNG |
| 核心算法 | 不变 | 不变（直接调用原版 `get_perfect_pixel()`） |

---

## 已知限制（待下一版改进）

- 无像素编辑器（扣图、画笔、缩放等）——计划 Ver 1.2 实现
- 无撤销/重做
- 色卡保存依赖 LocalStorage，清除浏览器数据会丢失
- 仅支持单文件处理（无批量模式）
