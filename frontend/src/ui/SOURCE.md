# 与大产品的组件复用

视觉来源：`bidAgent-frontend`，参考提交 `6035431e97a14c3fb931beb0a059f598588dce32`，以及用户提供的三张页面截图。

- `product-tokens.css`：复用宿主 `src/styles.css` 的浅色、深色设计变量（品牌、字体、背景层级、边框、圆角、阴影）。选择器限定在 `.bid-graph`，不改宿主 document。
- `GlassSelect.tsx`：从宿主 `src/components/GlassSelect.tsx` 复用，保留键盘选择、Escape、外部点击关闭和定位逻辑。浮层仍挂在 body，外包带当前主题的 `.bid-graph-portal`，避免容器查询引起 fixed 定位偏移，也避免样式泄漏。
- `glass-select.css`：提取宿主单选浮层规则；未搬运依赖业务页面的规则。模块覆盖层以本地 token 提供表面样式。
- `WorkspaceChrome.tsx`：将宿主侧栏卡片、蓝色选中态、下划线视图导航和三态主题切换模式整理为本模块的外壳组件；不包含宿主身份、知识库或六步骤业务。
- `product-layout.css`：图表工具专属布局，容器宽度决定响应式，不假设占满浏览器。

当前是带来源记录的源码复用，不是两个仓库已经共享一个 npm 包。下一次实际接入时，可将 tokens、GlassSelect 移入宿主的公共 UI 包，并替换这里的 import；无需改动图表领域、布局、渲染与版本逻辑。不要通过本机绝对路径跨仓库 import。

主题偏好沿用宿主的 `bid-agent.theme-mode` 键。独立入口负责选择主题；嵌入入口跟随祖先的 `data-theme`，不改 html、body 或宿主主题状态。
