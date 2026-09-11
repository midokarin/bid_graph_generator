# 大产品风格适配与前端接入入口

本次用户要求以大产品 UI 替换 Demo 外观。因此本文件的视觉基线优先于旧规格第 8.5 节中的 Demo 外观约束；原有图表数据、渲染、手动保存与版本规则继续适用。工作区中已有的规格人工修改未纳入本次提交。

## 已完成的模块边界

- 蓝白工作台、项目卡片侧栏、可收起侧栏、生成结果 / 生成过程 / 版本记录标签、按需模板面板、浅色 / 深色 / 跟随系统主题。
- 复用大产品设计变量与 GlassSelect 源码，来源和差异见 `frontend/src/ui/SOURCE.md`。
- 保留多任务、多方案生成、取消、编辑确认、模板、版式试调、版本恢复、项目文件与 PNG/SVG 导出。项目卡片可打开已有项目。
- 样式全部限定在 `.bid-graph`。原组件样式放在 `bid-graph-base` 层，产品样式覆盖它；独立页面的 body reset 单独放在 `standalone.css`。
- `frontend/src/module.ts` 是接入入口：导出 `DiagramWorkspace`、属性类型、`HostAdapter` 与 `GenerationAdapter`，不主动挂载 root、不导入宿主路由。
- `embedded` 隐藏独立侧栏与模型设置，保留可展开的图表任务列表。每个嵌入实例拥有独立状态。宿主通过 `projectName` 展示当前项目名。

## 接入示例

迁入宿主后从模块入口导入，所有 adapter 对象保持稳定（在外部创建或 useMemo）。宿主切换项目时先检查 dirty，再用项目 ID 作为 React key 重新挂载模块，避免跨项目保留旧图。

```tsx
import {DiagramWorkspace, type HostAdapter} from './features/diagrams/module';

// 以下服务由实际接入阶段实现；名称是示意，不是宿主已有 API。
const host: HostAdapter = {
  getInitialText: async () => selectedText,
  generation: diagramGenerationService,
  openProject: openDiagramProject,
  saveProject: saveDiagramProject,
  exportImage: receiveDiagramImage,
  onDirtyChange: setDiagramDirty,
};

<DiagramWorkspace
  key={projectId}
  embedded
  host={host}
  projectName={projectName}
/>
```

宿主继续使用自己的 `data-theme="light|dark"` 和布局容器。不要导入 `main.tsx` 或 `standalone.css`。模块应有可用宽度，760px 面板与 390px 窄屏已经覆盖。

服务约定：

| 接口 | 语义 |
| --- | --- |
| `getInitialText()` | 初始文字，不会自动触发生成；读取失败显示提示，用户可手工输入 |
| `generation.getHealth()` | 返回服务状态与模型类型；`stub` 在界面明确显示替身模型 |
| `generation.createGeneration(request)` | 创建任务，返回 job_id、state、events_url |
| `generation.consumeGeneration(url, emit, signal)` | 由宿主提供带认证的流；发送既有 status/delta/schedule/result 事件；尊重取消信号 |
| `generation.cancelGeneration(jobId)` | 取消对应后端任务；多方案同样走此适配器 |
| `openProject()` | 返回 `{text, handle, name}` 或 null；模块负责契约校验与旧版迁移 |
| `saveProject(project, handle, saveAs?)` | 返回 `{handle, confirmed}`；仅确认写入且当前数据未变才清除 dirty。失败应抛出异常 |
| `exportImage(blob, name)` | 接收 PNG/SVG，可异步上传或插入宿主文档；失败抛出异常 |
| `onDirtyChange(dirty)` | 通知所有图表任务的汇总未保存状态；宿主用于路由离开与关闭面板提示 |

未传 `generation` 时沿用本地 `/api/v1`，这只是独立模式兼容，不表示宿主认证已接通。流中的 `events_url` 完全由注入的 `consumeGeneration` 处理，因此宿主可使用自己的带鉴权 fetch 流，不必依赖原生 EventSource。

接入时需一并迁入 `frontend/src` 及 `packages/contracts`（App 与校验器仍依赖共享样例/Schema），保留 ELK Worker 的 Vite 资源构建；依赖以 `frontend/package.json` 为准。本次没有建立可发布 npm 库，也没有修改大产品仓库。

## 验证与边界

统一质量命令：`npm run quality`。

浏览器验证：启动前端后运行 `BIAOSHU_WEB_URL=http://127.0.0.1:5191 node scripts/verify-product-ui.mjs`。需可导入 Playwright 和已安装 Chrome；也可通过 `PLAYWRIGHT_MODULE` 指定 Playwright 入口。测试拦截所有 `/api/v1` 请求，使用契约样例，不调用真实模型。

截图与检查结果见 `docs/evidence/product-ui/`。此次验证覆盖 UI、替身生成、两图种、模板、版式、版本、任务切换、下载与宿主 adapter。实际大产品路由、登录鉴权、项目存储、正文插图、真实模型调用和宿主服务端冻结权限尚未联调，不能将本次结果视为实际接入完成。
