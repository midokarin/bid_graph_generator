# 流程图返回线间距调整

多条返回线接入同一个节点时，旧布局虽然没有交叉，仍会留下贴近的平行线及紧靠节点的转折。本次统一调整 ELK 同层和跨层的线线/线节点间距为 36 个布局单位，标签留白为 12；预览、版本与导出复用同一份几何结果。

使用上一轮截图重建的故障样例验证：

- 两条长返回线的平行距离由约 11 增至 37；最近的末端转折至节点距离由 10 增至 36。横向、纵向均有实际坐标回归断言。
- 保持一、二、三级的顺序，无交叉、无穿节点、无无关线路重叠。纵向布局面积增加约 4.2%，横向约 12.6%。这些是当前样例的实测结果，不是所有复杂拓扑的硬保证。
- 35 项后端测试、103 项前端测试、类型检查、契约一致性及构建全部通过。
- 真实 Chrome 验证“旧快照 → 点击重新布局 → v2 → PNG/SVG”，预览与导出连线路径一致，JSON 快照重载后坐标不变，页面异常为零。工作台留有 1440×900、1920×1080 截图，局部截图直接来自正式 SVG，已目视检查。
- [修改前局部](evidence/flow-spacing/DOWN-before-return-detail.png)、[修改后局部](evidence/flow-spacing/DOWN-after-return-detail.png)、[完整纵向 PNG](evidence/flow-spacing/DOWN.png)、[浏览器结果](evidence/flow-spacing/checks.json)。

已有图点击“重新布局”后生效，再手动保存。打开项目不会自动移动已有节点。没有修改业务内容或调用外部模型；本次为本地布局及渲染验证。

实现依据：[ELK 官方间距说明](https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/spacingdocumentation.html)。复验入口为 `node --import tsx scripts/verify-flow-quality.mjs`，可指定 `BIAOSHU_WEB_URL`、`PLAYWRIGHT_MODULE`、`BIAOSHU_EVIDENCE_DIR`；`BIAOSHU_BASELINE_DIR` 可传入含 `DOWN.json`/`RIGHT.json` 旧布局的目录进行对比。没有 agent-browser CLI 时使用已有 Playwright 驱动真实 Chrome。
