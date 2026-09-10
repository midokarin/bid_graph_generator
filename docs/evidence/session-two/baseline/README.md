# 实现前视觉基线

基线：`2c473bfb7334b8bccee8b36a886cbe186318f6a7` 的 `demo/`，截图前通过 Git diff 确认 Demo 无变化。

环境：macOS，独立 Chrome 152（headless），1440×900 与 1920×1080，DPR 1，浏览器缩放 100%，document.fonts.status=loaded；系统字体与 Demo 默认 sans-serif。测试浏览器未使用个人配置。

截图在正式页面实现之前取得。flow、style、history、export 使用 Demo 流程样例 v1；gantt 使用 Demo 甘特样例 v1。所有截图为完整视口，未遮盖页面区域。

正式实现复用 Demo 的 App、StyleSettings、TemplatePanel、VersionHistory、RunStream、templates 和原 CSS。根据主规格替换模拟生成和数据状态，移除 Demo 的 localStorage 保存、工期合规阻断；文件与正式导出入口留待会话三。新增方向、重新布局和 JSON 控件沿用既有样式。
