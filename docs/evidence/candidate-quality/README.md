# 多方案差异与布局质量验收

日期：2026-09-11。全部使用固定合成资料和本地替身服务，没有调用外部模型。

## 本次修改

- 加强三种受控提示词：正常主干、判断分支、阶段层次采用不同组织重点；保留原文步骤、条件、依赖和整改路径。
- 各候选使用不同布局参数，每张比较 24 组 ELK 布局；保留主干布局和安全间距调整作为备选。全部保持业务结构及用户方向。
- 优先控制分支顺序错误、节点遮挡、交叉、重叠和标签遮挡；同等缺陷下限制额外折点及画布面积。实际字号参与节点和标签尺寸计算，标签可沿所属连线附近避让。
- 相近排版和检测到的缺陷用简短标记提示；只有至少两个无上述检测缺陷的候选可比较时才给出布局推荐。
- 仍是 3 次首次模型生成、最多 2 条并行流水线；本地布局搜索不增加模型调用，结构修复沿用既有额度。

## 验证结果

- `npm run quality`：37 个后端测试、118 个前端测试通过，类型检查及生产构建通过。
- [固定样例测量](measurements.json)：3 份结构 × 横向/纵向，共 6 组，每组得到 3 种不同几何布局，前五项检测缺陷均为零；折点数与原策略一致。旧策略在这些样例中也无交叉，因此这些结果不证明普遍降低交叉率。
- 单张布局搜索本机 Node 实测 118～344 毫秒；此数据不包含模型生成耗时，也不代表所有设备和规模。
- 新回归测试覆盖实际大字号和长中文分支标签、标签避让、显式顺序保持、输入不变、正交连线、相似检测、推荐边界和搜索取消。
- [完整浏览器结果](browser-result.json)：本地 API、SSE、ELK Worker、候选比较/放大、采用后版本、手动保存、PNG/SVG 导出、任务切换、输入变化失效、甘特单方案、无浏览器异常。
- [取消与失败结果](cancellation-result.json)：部分失败、取消剩余任务、忽略迟到结果、阻止队列继续、恢复原图及任务隔离。
- 已查看 1440×900、1920×1080 候选截图及采用后截图；保留现有页面分区和简化文案。移动端 390px 无横向溢出。

## 复现

先启动独立替身后端及指向它的前端，浏览器脚本默认访问 `http://127.0.0.1:5192`。后端必须明确使用 `create_app(Settings(provider="stub"))`，避免已保存的模型设置覆盖环境变量。脚本也会校验服务类型。

```sh
npm run quality
node --import tsx scripts/measure-candidate-quality.mts
BIAOSHU_EVIDENCE_DIR=docs/evidence/candidate-quality node scripts/verify-candidates.mjs
BIAOSHU_EVIDENCE_DIR=docs/evidence/candidate-quality node scripts/verify-candidate-cancel.mjs
```

浏览器脚本需要 Playwright 和 Chrome；可通过 `PLAYWRIGHT_MODULE` 指向已有 Playwright 模块。

## 边界

真实模型的业务理解和三种提示词的实际差异尚未实测。几何指标是近似检测，不是业务正确性判断或零交叉保证。纯线性图和强顺序约束图的合理差异有限；必要时宁可保留相近结果，也不增加检测缺陷。字号变大可能扩大画布，采用后仍可按原流程调整和检查。

布局参数参考 [ELK Layered 官方说明](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html) 和 [favorStraightEdges](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-nodePlacement-favorStraightEdges.html)。
