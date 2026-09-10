# 会话三新增区域视觉复核

Demo 基线保持 `2c473bfb7334b8bccee8b36a886cbe186318f6a7`，未修改 `demo/` 或会话二基准截图。会话二主工作台集中验收见 [原记录](../session-two/visual-comparison.md)。本次 `before/` 来自单独运行的会话二提交 `ccb85ae`；`after/` 主对照来自本次正式生产构建。

对照条件：macOS 26.6.2 arm64、同一已安装 Google Chrome 152 可执行文件、两侧均 headless、1440×900 和 1920×1080、DPR 1、100% 缩放、系统字体加载完成。两侧使用相同内置文字及固定替身结果，经典黑白模板、v1、A4 竖向。原生文件操作另用普通有窗口 Chrome 验证，不混入像素对照。早期有窗口截图与 headless 控件箭头有差异，最终主对照已统一浏览器运行模式；没有改变基线源码。

| 区域 | 1440×900 前 / 后 | 1920×1080 前 / 后 |
|---|---|---|
| 流程图工作台与新增设置入口 | [前](before/flow-1440.png) / [后](after/flow-1440.png) | [前](before/flow-1920.png) / [后](after/flow-1920.png) |
| 甘特图工作台 | [前](before/gantt-1440.png) / [后](after/gantt-1440.png) | [前](before/gantt-1920.png) / [后](after/gantt-1920.png) |
| 流程图导出弹窗 | [前](before/export-1440.png) / [后](after/export-1440.png) | [前](before/export-1920.png) / [后](after/export-1920.png) |
| 甘特图导出弹窗 | [前](before/gantt-export-1440.png) / [后](after/gantt-export-1440.png) | [前](before/gantt-export-1920.png) / [后](after/gantt-export-1920.png) |
| JSON 流展开窗口 | [前](before/json-gantt-1440.png) / [后](after/json-gantt-1440.png) | [前](before/json-gantt-1920.png) / [后](after/json-gantt-1920.png) |
| 新增模型设置弹窗 | 无旧弹窗；[新增](after/settings-1440.png) | 无旧弹窗；[新增](after/settings-1920.png) |

人工视觉复核：导航、顶部操作区、三步流程、三列工作台和模板区的排列、比例、字体、边框、颜色、圆角保持一致。JSON 流窗口复用原组件和 CSS；未见未经授权的主要区域布局变化。运行耗时及保存状态文案属于真实状态差异。没有遮盖整块页面制作对照。

新增与允许差异：

- 左侧底部增加“模型设置”入口；设置弹窗复用原 `dialog`、`field-label`、输入框、提示块和绿色主按钮。原页面没有模型设置弹窗，因此不能声称该弹窗有一一对应的旧截图；其入口以前后工作台对照，弹窗外观沿用已有组件。
- 导出弹窗保持原 540px 宽度、边框、圆角、阴影和按钮风格。内部增加两列纸型、方向、图题、背景选项和 SVG 按钮；预览滚动区从 47vh 调整到 30vh，为新增控件留空间。预览增加纸面边距及可选图题，这是导出需求带来的允许变化。
- 顶部“内存版本”改为真实保存状态，页脚改为手动保存和 PNG/SVG 说明。
- [A3 横向透明背景](after/gantt-a3-transparent.png) 属于功能补充截图，不与默认 A4 纸面对照。

功能验收与视觉复核独立：上述对照只证明本次新增区域在当前 Chrome/macOS 条件下的外观。真实模型两图闭环、Edge、Windows、Linux 和跨平台字体一致性未由这些截图证明。
