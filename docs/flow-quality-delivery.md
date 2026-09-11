# 分级分支顺序与连线交叉优化

生成和“重新布局”现在识别明确的分支序号，并从有限候选中选择顺序正确、穿节点和交叉更少的布局。截图重建样例的“故障分级判断”由二、一、三改为一、二、三；业务节点、类型与连接关系不变。

## 实现范围

- 识别一级/二级、第三级、数字序号、P0/L1 等明确标记。重复序号、非序号标签和混合标签不猜测顺序。
- 对已识别的判断分支设置有序出口：DOWN 从左到右，RIGHT 从上到下。候选评分也优先比较对应目标节点顺序。
- 在同一个 ELK Worker 中依次尝试 8 个确定性候选，比较顺序、穿节点、线段交叉、无关线路重叠、折点、线长和面积。不同回路处理策略让返回验证线路有机会绕开主线。
- 保留现有单主线/直接整改回路的专用布局，以及整体 30 秒超时和取消机制。
- 路径坐标规范到小数点后六位，消除同一正交坐标的浮点尾差；此前尾差会干扰线段方向和交叉计数。
- 预览和导出继续共享版本快照。打开已有项目保持原布局，点击“重新布局”创建新版本后再手动保存。

实现参数参考 ELK 官方的[端口与分层布局支持](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html)和[反馈边绕行选项](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-feedbackEdges.html)。排序约束与减少交叉可能冲突，因此选择时排序优先；有限候选搜索不保证所有拓扑都能零交叉。

## 验证

- `npm run quality`：35 项后端测试、101 项前端测试、契约一致性、类型检查、构建全部通过。
- 根据用户截图人工重建的合成样例（18 个节点、22 条边），使用同一数据比较旧参数与新策略。规范浮点尾差后，DOWN 和 RIGHT 的横竖线段内部交叉均从 4 处降到 0；乱序从 1 处降到 0，穿节点和无关共线重叠均为 0。共享连接点不计作交叉。结果见 [checks.json](evidence/flow-quality/checks.json)。
- 真实 Chrome 验证“加载旧布局 → 点击重新布局 → v2 → PNG/SVG”，确认预览与导出连线路径一致，JSON 快照重载后坐标不变，页面异常为 0。两种方向均留有 1440×900、1920×1080 工作台截图。
- 导出[纵向样例 PNG](evidence/flow-quality/DOWN.png)和 [SVG](evidence/flow-quality/DOWN.svg)已目视检查。横向长流程仍是长画布，需要放大阅读，不代表适合缩成单页小图。
- 本机没有 agent-browser CLI，改用已有 Playwright 驱动真实 Chrome。此次没有调用外部模型；截图重建样例不是用户原始 JSON，也不代表真实模型生成全链路验收。

复验：启动正式前端，执行 `node --import tsx scripts/verify-flow-quality.mjs`。可用 `BIAOSHU_WEB_URL` 指定服务地址、`PLAYWRIGHT_MODULE` 指定已有 Playwright 模块路径、`BIAOSHU_EVIDENCE_DIR` 指定输出目录；默认结果位于被 Git 忽略的 `tmp/flow-quality/`。
