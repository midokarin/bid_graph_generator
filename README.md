# 标绘：标书图表生成程序

当前开发为 **P0 会话三：文件、导出与独立运行设置**。
实际验收状态见 [会话三记录](docs/session-three-delivery.md)，真实模型闭环通过前不声明 P0 完成。
`demo/` 保留为独立交互参考，不参与正式工程，也不代表真实模型能力。

## 安装与启动

要求 Python 3.11+、Node.js 22.12+。在仓库根目录执行：

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
npm ci
```

Windows 中使用 `python` 创建虚拟环境，安装命令改为：

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
npm ci
```

两个终端分别运行：

```sh
npm run backend
```

```sh
npm run dev
```

后端：[API 文档](http://127.0.0.1:8000/api/v1/docs)；前端：[正式启动页](http://127.0.0.1:5173)。
启动入口只监听 `127.0.0.1`，前端 `/api` 代理至后端。生产构建输出在 `frontend/dist/`。
Windows 如果系统没有 `python3` 别名，可直接用 `python scripts/manage.py backend` / `python scripts/manage.py quality`。

若端口已被其他程序占用，设置 `BIAOSHU_API_PORT`（两个终端保持一致）和 `BIAOSHU_WEB_PORT`，例如 macOS/Linux：

```sh
BIAOSHU_API_PORT=8010 npm run backend
BIAOSHU_API_PORT=8010 BIAOSHU_WEB_PORT=5174 npm run dev
```

Windows PowerShell 可通过 `$env:BIAOSHU_API_PORT="8010"`、`$env:BIAOSHU_WEB_PORT="5174"` 设置后启动。

默认 `BIAOSHU_PROVIDER=stub`，生成固定的合成样例，**不会理解原文或调用外部模型**。
正式工作台支持生成两种图、展开阶段与 JSON 流、文字编辑、流程节点拖动、全局样式与模板、重新布局、查看和恢复内存版本。
流程图可选择 DOWN/RIGHT；甘特使用后端日/周/月确定性排期。替身固定返回包含六种节点与整改回路的流程图、包含并行/提前/延迟与两个里程碑的甘特图。
顶部“保存项目”首次打开系统文件选择窗口，后续默认覆盖。工作台已移除本地项目管理板块，不再提供打开项目或另存为入口。下载弹窗提供 PNG/SVG、图题和背景选项。没有自动保存或恢复副本，关闭页面前请手动保存。

## 一条质量命令

```sh
npm run quality
```

依次检查 Schema 与 TS 生成文件是否漂移、运行后端测试、共享契约样例、前端类型检查与生产构建。无模型 Key 或网络也能运行测试。

修改 Pydantic 契约后显式再生成：

```sh
npm run contracts
```

测试样例都是人工合成数据，维护脚本为 `scripts/build_fixtures.py`；有效图表与项目示例在 `packages/contracts/examples/`，有效/无效用例在 `packages/contracts/cases.json`。

服务启动后可额外执行真实 HTTP 启动检查（仅允许替身模式；端口按实际启动值填写）：

```sh
.venv/bin/python scripts/smoke_http.py --api-port 8010 --web-port 5174
```

## API 快速验证

创建任务（把 `diagram_type` 改为 `gantt` 可测试甘特图）：

```sh
curl -s http://127.0.0.1:8000/api/v1/generations \
  -H 'Content-Type: application/json' \
  -d '{"diagram_type":"flowchart","source_text":"开始，然后结束。","direction":"DOWN"}'
```

用返回的 `job_id` 订阅，另一个终端可取消：

```sh
curl -N http://127.0.0.1:8000/api/v1/generations/JOB_ID/events
curl -X DELETE http://127.0.0.1:8000/api/v1/generations/JOB_ID
```

事件有单调递增 `id`，重连可带 `Last-Event-ID`。正常顺序：

```text
status: queued → generating
delta: {attempt: 0, text: "…"}
status: validating
（校验失败则 validation_error → repairing → delta → validating，最多两次）
schedule: {tasks: [{id, start, end, row}, …]}（仅甘特；本地派生）
result: {spec, supplements, summary}
status: completed
```

失败发送 `error: {message, code, details}` 和 `failed`；取消发送 `cancelled`，之后不再发出结果。
任务完成后取消为幂等操作，不撤销已经完成的结果。关闭 SSE 连接不等于取消任务，必须调用 DELETE。
SSE 中间文本仅供观察，只有 `result` 可供正式业务消费。HTTP 404 表示任务不存在/过期，422 为输入错误，429 为任务缓存已满。

## 模型配置

左下角“模型设置”填写 Base URL、模型名和 API Key，保存后立即用于后续生成。空 Key 保留已有密钥；读取接口只返回遮盖状态。配置保存在用户配置目录中的 `biaoshu2/settings.json`：macOS 为 `~/Library/Application Support`，Windows 为 `%APPDATA%`，Linux 为绝对路径 `$XDG_CONFIG_HOME` 或 `~/.config`。密钥以明文保存，文件仅当前用户可读写（平台权限语义以实际系统为准）。

已有配置文件优先；首次运行无配置文件时读取以下环境变量，不自动写入文件。例外是显式设置的 `BIAOSHU_TIMEOUT`，它也覆盖已保存的时限，便于升级旧版配置。

| 变量 | 默认值 | 作用 |
|---|---|---|
| `BIAOSHU_PROVIDER` | `stub` | `stub` 或 `openai` |
| `BIAOSHU_BASE_URL` | `https://api.openai.com/v1` | OpenAI 兼容接口前缀 |
| `BIAOSHU_MODEL` | 空 | 供应商模型名 |
| `BIAOSHU_API_KEY` | 空 | 仅后端读取的 Key |
| `BIAOSHU_STRUCTURED_OUTPUT` | `auto` | `auto`、`required`、`off` |
| `BIAOSHU_TIMEOUT` | `600` | 每次生成/修复的总秒数，包含模型推理与 JSON 输出，上限 600；显式设置时覆盖本机已保存的旧时限 |

`auto` 优先请求原生 `json_schema`；仅当供应商明确报告 `response_format` 不受支持时，退回提示词 Schema。鉴权、限流、一般 Schema 错误不触发降级。`off` 可适配只支持提示词约束的接口。无论模式如何，本地校验始终执行。

真实模式会将原文、图种专属提示词、Schema 及预留要求发送到所配置的供应商；修复只发送错误 JSON、校验错误和系统约束，不重发原文。真实调用的验收结果单独列在会话三记录中。

## 工程边界与数据

- `backend/app/domain/`：Pydantic 权威模型、纯校验、迁移入口、集中技术限制。
- `backend/app/providers/`：可配置 OpenAI 兼容流式适配器、固定替身。
- `backend/app/services/`：生成/修复/取消、有限 JSON 清理、临时诊断日志。
- `backend/app/api/`：创建、SSE、取消；领域层不依赖 FastAPI。
- `frontend/src/domain/`：生成的 TS 类型、基于权威 Schema 的 Ajv 校验与语义规则。
- `frontend/src/adapters/`：薄的独立模式宿主边界，不绑定具体宿主协议。
- `packages/contracts/`：生成 Schema、合成示例和两端共用反例。

JSON Schema 无法单独表达引用完整性、依赖环和项目快照一致性：Schema 中的 `x-domain` 标识附加规则，Python/Pydantic 和 TS/Ajv 都必须执行这些规则。TS 类型只是静态约束，未知 JSON 必须经过运行时校验。
整数按 JSON 数值语义校验，`1` 和 `1.0` 同值，字符串数字、布尔数值、非整数均不被接受。

项目格式和图表 Schema 版本分别为 `1.0`。业务 `spec`、`layout`、`style` 分开；版本保存完整快照、补充项和说明。项目 `metadata` 是唯一自由扩展区。迁移入口支持 `1.0` 和明确的 `0.9` 兼容测试格式：除版本号和可缺省的 `metadata` 外，全部核心字段必须满足 1.0 契约。迁移只升级文件版本并补空扩展区，保留完整布局和历史，提示另存为；没有已发布的 0.9 程序，不能宣称任意旧 Demo 文件兼容。未来版本及其他未知格式拒绝。版本以完整契约快照保存在内存中；编辑从当前查看版本创建新版本，恢复也分配新版本号。两图种各自保留版本链，不裁剪旧版本。文件保存包含当前选择、原文、所有版本以及扩展区中的纸面导出设置。Chrome/Edge 使用系统文件 API；缺少该能力时回退为上传/下载，下载无法确认落盘，因此保留未保存提示。

甘特图最早开始为从 0 起算的偏移，普通任务工期为正、里程碑为零。Python 排期使用确定性拓扑遍历及十进制运算；前端只读取派生起止时间绘制。流程图使用 ELK 官方 Web Worker，保存节点坐标与连线折点；拖动、样式和历史查看不调用 ELK。

任务与事件只驻留内存，重启丢失；最多保留 100 个任务，完成任务超过 1 小时后在创建新任务时清理。每次输出上限 200,000 字符。临时诊断只保存任务 ID、阶段和尝试次数，不记录输入、输出或 Key；位于系统临时目录，最多 2 MB，正常退出删除本次文件，启动时删除已退出进程的同类遗留文件，同时保留仍在运行的进程文件。

上述文字长度、数值范围、超时、心跳、任务保留和日志大小均为集中管理的临时技术参数，不代表已确认产品参数。

导出以 300 DPI 计算纸面宽度，并保持布局比例；长图纵向延长而不分页。PNG 的安全限制为 80,000,000 像素且单边高度不超过 32767；超出时仍可使用 SVG。项目文件上限 20 MB；这些数值为集中可测试的技术参数。系统字体未内嵌，Windows/Linux 和跨平台像素一致性须另行实机验证。
