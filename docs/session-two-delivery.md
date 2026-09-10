# P0 会话二交付记录

日期：2026-09-11。范围：双图渲染、工作台编辑与版本链路。只调用固定替身，无外部模型调用。

## 前置检查

完整阅读 `AGENTS.md`、主规格及会话一交付记录。会话一提交 `fad4901`，视觉要求提交 `67cf9c5`；开始时统一质量命令通过：后端 16 项、前端 64 项、类型检查与构建。人工删除主规格参考章节的修改及未跟踪 `AGENTS.md` 保留，不纳入本次功能提交。

实现前确认 `demo/` 与 `2c473bfb7334b8bccee8b36a886cbe186318f6a7` 无差异并记录十张基线截图。没有修改 Demo 或覆盖基线截图。

## 本次交付

- 正式页面复用 Demo 的 App、CSS、图标、模板、版式、运行窗口和历史组件；数据改为正式契约。
- SSE 阶段、分次 JSON 流、修复记录折叠、错误详情、取消；仅完整校验通过后创建版本。
- ELK 官方 Worker：DOWN/RIGHT、六种节点、任意多分支和整改回路；React/SVG 绘制。将外接矩形端点延伸至菱形、文档实际轮廓；保存全部折点。拖动更新相连路径，样式不重排，只有生成/重新布局执行 ELK。
- Python 确定性甘特排期：日/周/月、FS 提前/延迟、最早开始、并行、多里程碑；十进制计算避免浮点累加顺序差异；SVG 按任务数纵向增长。
- 节点/任务文字编辑、全局字体/字号/颜色/线宽/圆角/透明背景、四个模板、整图 AI 补充标志。
- 完整契约快照，包含 spec/layout/style/supplements/summary 和版本来源/时间；历史查看不创建版本，恢复创建新版本号。两图种各自保留内存版本链，不裁剪历史。写入前重新校验。
- 文字可读边界集中在 `frontend/src/layout/flow.ts`，过长文字提示精简，不无限缩小字体。临时技术限制不视为产品最终参数。

## 实际自动验证

[`npm run quality` 完整输出](evidence/session-two/quality.txt)：后端 18 项、前端 67 项、类型检查及生产构建通过。

新增关键验证：两图种 JSON → 实际 ELK/Python 排期 → SVG；DOWN/RIGHT、三分支、六形状及整改回路；菱形端点确实在轮廓上；布局 JSON 序列化/重载坐标与折点不变；编辑/样式保持布局；恢复快照等于旧内容且版本递增；日/周/月、并行/提前/延迟/最早开始/多个里程碑、同输入及依赖遍历顺序变化后的排期一致、环拒绝。API 检查派生 schedule 事件与结果，保留会话一修复和取消覆盖。

`git diff --check` 通过。没有密钥、真实业务输入输出或临时模型日志进入交付。

## 实际浏览器验证

macOS 上独立 Chrome 152（headless），开发服务与生产构建预览均实际运行，后端为 stub。

1. 流程图生成 v1（六种节点、整改回路、AI 补充）。修改“执行”为“执行并记录”，确认后 v2；历史查看 v1，再恢复为 v3，v1/v2 仍存在。[编辑历史](evidence/session-two/after/edit-history.png)、[恢复历史](evidence/session-two/after/restored-history.png)。
2. 拖动节点后应用商务蓝模板。浏览器 DOM 证据比较确认节点 x/y/width/height、全部边路径一致；[模板前](evidence/session-two/drag-before-template.json)、[模板后](evidence/session-two/drag-after-template.json)。重新布局创建新版本。
3. 甘特生成五项任务，包含两项里程碑；编辑“实施”为“实施与记录”创建 v2，起止位置仍为 0–3、2–7、4–6、7–7、7–7。[历史截图](evidence/session-two/after/gantt-edit-history.png)、[DOM 排期](evidence/session-two/gantt-edited.json)。
4. 展开运行窗口及首次生成 JSON，显示真实替身输出。[截图](evidence/session-two/after/json-stream.png)。
5. 生产构建通过官方 Worker 完成 DOWN 与 RIGHT 生成；RIGHT 创建 v2，SVG viewBox 为 `0 0 1611 257`。[截图](evidence/session-two/after/production-right.png)。最终浏览器错误列表为空。

开发阶段确实遇到自建 Worker 内嵌 ELK bundled 版本失败，已改用官方 Worker 并用生产构建复验，未以 Node 测试代替 Worker 证据。浏览器取消尝试遇到替身先完成，未把该尝试计为有效取消验收；取消后不产出结果由现有 API 测试覆盖。

## 视觉对照

见[集中视觉记录](evidence/session-two/visual-comparison.md)。两个视口覆盖双图工作台、版式、历史和输出预览弹窗。保留全部原图，无遮盖区域。新增局部控件、真实文案和动态画布差异单独列出；未更改主要页面分区及整体风格。

## 边界与下一会话前置条件

本次不实现项目文件、正式 PNG/SVG 导出、设置页及真实模型总验收。没有节点/连线增删、依赖编辑、自然语言二次修改、localStorage/IndexedDB 或自动恢复副本。

保存/下载入口沿用 Demo 位置：保存提示尚未接入；下载入口显示同源 SVG 预览，下载按钮禁用。A4/A3、纸面方向仍为工作台局部选项，纸面尺寸与文件持久化留给会话三。关闭页面丢失内存版本。

会话三开始前：阅读约束与本交付，确认本次 Git 提交/推送；重新运行质量命令；启动替身验证两图内存版本链；沿用本次布局快照和 SVG，补齐文件、纸面、导出及配置，最后经授权做真实模型和 Chrome/Edge 完整闭环。Windows/Linux、Edge 和跨平台像素一致性尚未验证。

本次交付后停止，不进入会话三，不宣称 P0 总验收完成。
