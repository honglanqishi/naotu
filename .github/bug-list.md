
## 已知 Bug 与陷阱清单

> 避免重复踩坑，遇到以下现象请直接查表。

| 现象 | 根因 | 解决方案 |
|---|---|---|
| `get_design_context` 内容不完整 | 节点过大被 MCP 裁剪 | 加 `forceCode: true` 参数 |
| 装饰图片 404 / 显示空白 | 直接用了 `localhost:3845` URL 作为 src | 必须下载到 `public/images/` 再引用 |
| 图片定位偏移 | 父容器缺少 `position: relative` | 确保所有绝对定位的父容器有 `relative` |
| 图片变形 | 未设置 object-fit | 加 `object-contain` 或 `object-cover` |
| Tailwind CSS 不生效 | 缺少 `postcss.config.mjs` | `export default { plugins: { '@tailwindcss/postcss': {} } }` |
| inset 负值内容溢出 | Figma 元素超出画框时的正常输出 | 外层正常定位 + 内层负值 inset 嵌套修正 |
| 页面渲染空白（Application error） | Next.js 热更新瞬态错误 | 手动刷新或重新导航，非代码问题 |
| 后端 401 硬刷新导致编辑内容丢失 | `window.location.href` 强制跳转 | 已改为派发 `auth:unauthorized` 事件 + 软跳转，禁止在 axios 拦截器里用 href |
| `nodeTypes`/`edgeTypes` 导致节点频繁重建 | 定义在组件内部，每次渲染重新创建 | 必须定义在组件外部（已在 MapEditor.tsx 实现） |
| 数据库 schema 两套不同步 | Docker 路径隔离，不能 import 跨包 | `backend/src/db/schema.ts` 与 `database/src/schema.ts` 手动同步 |
| CORS 请求被拒绝 | 误用 `BETTER_AUTH_URL` 作为 CORS origin | CORS origin 只能用 `FRONTEND_URL` |
| bootstrap.ts 代理不生效 | 没有在第一行导入 | `backend/src/index.ts` 第二行必须是 `import './bootstrap.js'` |

| 富文本工具栏按钮无激活态 | 未监听 `selectionchange` + 未调用 `queryCommandState` | 在 RichTextToolbar 中用 `selectionchange` 事件更新 `activeFormats` 状态，按钮 style 通过 `getBtnStyle(format)` 区分激活/未激活样式 |
| 右键子菜单移入时消失 | 鼠标从 MenuItem 移到 fixed 子菜单时触发了 mouseleave 计时器 | 将 `clearCloseTimer`/`startCloseTimer` 作为 `onMouseEnter`/`onMouseLeave` 传入 SubMenu，鼠标进入 SubMenu 即取消计时 |
| 下钻仅在有子节点时显示 | `drillDownAction` 用 `nodeHasChildren` 条件判断是否为 null | 移除条件，`drillDownAction` 始终生成并 push 到菜单 |
| 待办提醒保存后不入库 | 前端写入 `node.data.decorations.todo`，后端读取 `node.data.todo` | 后端同步逻辑改为优先读取 `decorations.todo`，并兼容旧字段回退 |
| 提醒时间偏差或不生效 | 前端保存中文提醒文案，后端只识别旧枚举（如 `10min`） | 前端统一保存稳定 code（`before_15m` 等），后端做新旧值归一化映射 |
| 富文本节点存在 XSS 风险 | `innerHTML`/`dangerouslySetInnerHTML` 未净化 | 保存与渲染均执行 `sanitizeHtml`，屏蔽脚本/事件属性/javascript 协议 |
| reminder worker 重复发信 | 多实例或同实例重叠轮询未做抢占 | 增加运行互斥 + `pending -> processing` 抢占更新，发送后再落 `sent/failed` |
| 多选节点时出现多个富文本工具栏 | 每个 `MindNode` 都按 `selected` 独立渲染 `NodeToolbar` | 通过 ReactFlow `useStore` 统一选择“首个选中节点”为工具栏 owner，仅该节点显示工具栏（编辑态除外） |
| 节点超链接装饰无法编辑/移除且交互不统一 | 超链接走 `prompt` 且无独立装饰组件、无右键菜单 | 新增 `HyperlinkBadge` 组件：左键打开链接，右键菜单支持编辑/移除，编辑改为与待办一致的 Portal 弹窗 |
| 节点装饰图标大小不一致、后续功能增多后易挤压错位 | 装饰入口混用文字徽标与图标，缺少统一槽位规范 | 装饰区统一了图标入口尺寸（`todo/超链接` 支持 compact 快捷位）；标签保留“标签名胶囊”原逻辑与样式，避免功能语义变化 |
| 标签在装饰行中与图标混排导致对齐难、视觉拥挤 | 标签是文字胶囊，不适合和固定尺寸图标同一行混排 | 将标签独立到节点内容前方（节点内边距区域），底部装饰行仅保留非标签入口，标签逻辑不变 |
| 节点底部快捷按钮视觉不齐、尺寸看起来不一致 | 装饰行缺少统一按钮槽位约束，个别入口受内部内容影响 | 为每个非标签装饰入口增加固定 `22x22` 对齐槽位，统一居中与间距，保证一行观感一致 |
| 评论弹窗保存入口不明显，用户不知道如何提交 | 主操作文案使用“发送/确定”，缺少明确保存提示 | 统一改为“保存”文案，并在输入区增加“点击保存或 Ctrl+Enter 保存评论”提示 |
| Dashboard 页面请求失败却看起来像“空列表” | `useQuery` 直接使用 `data ?? []`，未区分 loading/error/empty 三态 | 单独渲染骨架屏、失败提示和空状态，禁止用默认空数组掩盖请求状态 |
| 创建/删除弹窗提交后立刻关闭，失败会丢失上下文 | 在 `mutate()` 后立即关闭弹窗并清空目标/表单 | 仅在 mutation `onSuccess` 中关闭弹窗；失败时保留输入和目标，允许直接重试 |

> 最后更新：2026-03-05 | 修复提醒字段错位/提醒枚举不一致/XSS 风险/worker 重复发送四类问题
> 最后更新：2026-03-05 | 修复多选富文本工具栏重复显示、节点超链接改为右键菜单+统一弹窗编辑
> 最后更新：2026-03-05 | 修复节点装饰图标对齐与尺寸不一致，装饰区改为统一快捷槽位布局
> 最后更新：2026-03-05 | 标签独立到节点内容前方，保留原标签名样式与编辑逻辑，底部装饰行仅保留非标签入口
> 最后更新：2026-03-05 | 修复底部快捷按钮对齐与评论保存入口不明显问题（统一22x22槽位+保存文案提示）
> 最后更新：2026-03-07 | 修复 Dashboard 重构后删除/创建弹窗提前关闭与列表状态被空数组掩盖的问题，补齐 loading/error/empty 三态
