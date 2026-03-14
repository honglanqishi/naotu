
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
| Vercel 生产环境点击 Google 登录一直 pending，浏览器 `/auth/sign-in/social` 最终 504 | 前端把 `/auth/*` 通过 Next.js rewrite 或宽松代理转发到后端时，Vercel Serverless 会在代理层超时；同时 `*.vercel.app` 子域之间不能靠直连 `NEXT_PUBLIC_API_URL` 共享前端所需 cookie | 生产环境必须保持浏览器同域请求 `/auth/*`，由 `frontend/src/app/auth/[...path]/route.ts` 和 `frontend/src/app/api/[...path]/route.ts` 显式代理到 `BACKEND_INTERNAL_URL`；代理只转发必要头，并给后端 fetch 加显式超时，禁止再依赖 `next.config.ts` rewrites 处理生产鉴权流 |
| Vercel 生产环境前端代理已命中后端，但后端真实 `POST /auth/sign-in/social` 仍超时 | `auth.handler(c.req.raw)` 在当前 Vercel Node 请求适配链路下对 `sign-in/social` 存在挂起兼容性问题，而同进程 `auth.api.signInSocial()` 正常 | 在 `backend/src/routes/auth.ts` 单独接管 `/sign-in/social`：解析 JSON 后调用 `auth.api.signInSocial({ headers, body })` 返回 Google 授权 URL，其余 `/auth/*` 保持走 `auth.handler` |
| Google 回调报 `state_mismatch`，日志显示 `State not persisted correctly` | 改走 `auth.api.signInSocial()` 后只返回了 JSON body，没有把 better-auth 生成的 `Set-Cookie`（state cookie）透传给浏览器 | 调用 `auth.api.signInSocial({ returnHeaders:true, returnStatus:true })`，并在后端 direct 路由中用真实 `Response` 返回 `headers`，确保 state cookie 发到浏览器 |

| 富文本工具栏按钮无激活态 | 未监听 `selectionchange` + 未调用 `queryCommandState` | 在 RichTextToolbar 中用 `selectionchange` 事件更新 `activeFormats` 状态，按钮 style 通过 `getBtnStyle(format)` 区分激活/未激活样式 |
| 右键子菜单移入时消失 | 鼠标从 MenuItem 移到 fixed 子菜单时触发了 mouseleave 计时器 | 将 `clearCloseTimer`/`startCloseTimer` 作为 `onMouseEnter`/`onMouseLeave` 传入 SubMenu，鼠标进入 SubMenu 即取消计时 |
| 下钻仅在有子节点时显示 | `drillDownAction` 用 `nodeHasChildren` 条件判断是否为 null | 移除条件，`drillDownAction` 始终生成并 push 到菜单 |
| 待办提醒保存后不入库 | 前端写入 `node.data.decorations.todo`，后端读取 `node.data.todo` | 后端同步逻辑改为优先读取 `decorations.todo`，并兼容旧字段回退 |
| 提醒时间偏差或不生效 | 前端保存中文提醒文案，后端只识别旧枚举（如 `10min`） | 前端统一保存稳定 code（`before_15m` 等），后端做新旧值归一化映射 |
| 富文本节点存在 XSS 风险 | `innerHTML`/`dangerouslySetInnerHTML` 未净化 | 保存与渲染均执行 `sanitizeHtml`，屏蔽脚本/事件属性/javascript 协议 |
| reminder worker 重复发信 | 多实例或同实例重叠轮询未做抢占 | 增加运行互斥 + `pending -> processing` 抢占更新，发送后再落 `sent/failed` |
| 多选节点时出现多个富文本工具栏 | 每个 `MindNode` 都按 `selected` 独立渲染 `NodeToolbar` | 通过 ReactFlow `useStore` 统一选择“首个选中节点”为工具栏 owner，仅该节点显示工具栏（编辑态除外） |
| 节点超链接装饰无法编辑/移除且交互不统一 | 超链接走 `prompt` 且无独立装饰组件、无右键菜单 | 新增 `HyperlinkBadge` 组件：左键打开链接，右键菜单支持编辑/移除，编辑改为与待办一致的 Portal 弹窗 |
| 节点装饰图标大小不一致、后续功能增多后易挤压错位 | 装饰入口混用文字徽标与图标，缺少统一槽位规范 | 装饰区统一了图标入口尺寸（`todo/超链接` 支持 compact 快捷位）；标签保留“标签名胶囊”原逻辑与样式，避免功能语义变化 || Figma 还原图标歪七扭八/比例变形 | `<img>` 只写了 `width` 或 `height` 其中一个，浏览器按 `auto` 推算另一轴，与 SVG 原始 viewBox 比例不匹配 | **必须同时写 `width` 和 `height`**，数值取 Figma 对应 Container 节点精确值（如 `w:13.969 h:1.969`），不得省略任一轴，不得用 `auto` |
| Figma 还原后旧图标文件与设计稿不符 | 本地 `/images/editor/` 存的是旧占位 SVG，未从 Figma MCP 重新下载 | 每次 Figma 还原任务必须用 `Invoke-WebRequest` 将所有 `localhost:3845/assets/*.svg` 重新下载覆盖本地旧文件 || 标签在装饰行中与图标混排导致对齐难、视觉拥挤 | 标签是文字胶囊，不适合和固定尺寸图标同一行混排 | 将标签独立到节点内容前方（节点内边距区域），底部装饰行仅保留非标签入口，标签逻辑不变 |
| 节点底部快捷按钮视觉不齐、尺寸看起来不一致 | 装饰行缺少统一按钮槽位约束，个别入口受内部内容影响 | 为每个非标签装饰入口增加固定 `22x22` 对齐槽位，统一居中与间距，保证一行观感一致 |
| 评论弹窗保存入口不明显，用户不知道如何提交 | 主操作文案使用“发送/确定”，缺少明确保存提示 | 统一改为“保存”文案，并在输入区增加“点击保存或 Ctrl+Enter 保存评论”提示 |
| Dashboard 页面请求失败却看起来像“空列表” | `useQuery` 直接使用 `data ?? []`，未区分 loading/error/empty 三态 | 单独渲染骨架屏、失败提示和空状态，禁止用默认空数组掩盖请求状态 |
| 创建/删除弹窗提交后立刻关闭，失败会丢失上下文 | 在 `mutate()` 后立即关闭弹窗并清空目标/表单 | 仅在 mutation `onSuccess` 中关闭弹窗；失败时保留输入和目标，允许直接重试 |

> 最后更新：2026-03-05 | 修复提醒字段错位/提醒枚举不一致/XSS 风险/worker 重复发送四类问题
> 最后更新：2026-03-05 | 修复多选富文本工具栏重复显示、节点超链接改为右键菜单+统一弹窗编辑
> 最后更新：2026-03-05 | 修复节点装饰图标对齐与尺寸不一致，装饰区改为统一快捷槽位布局
> 最后更新：2026-03-05 | 标签独立到节点内容前方，保留原标签名样式与编辑逻辑，底部装饰行仅保留非标签入口
| `useCallback` 引用后声明的 `const` 触发 TS2448 | TypeScript 严格模式下 `const` 时间死区坑：在某个 hook 的 callback 里调用了文件后续才声明的变量，TypeScript 报 `Block-scoped variable used before its declaration` | 将该 callback 移到被依赖变量声明之后，或改成 `useRef` 绕过 |
| Figma 设计稿中 `LayoutStyle` toggle 写了 `'flow'` | 项目 `LayoutStyle` 类型只有 `'mindmap' \| 'tree-lr' \| 'tree-tb'`，不存在 `'flow'` | 改为 `'tree-lr'` |

> 最后更新：2026-03-05 | 修复底部快捷按钮对齐与评论保存入口不明显问题（统一22x22槽位+保存文案提示）
> 最后更新：2026-03-07 | 修复 Dashboard 重构后删除/创建弹窗提前关闭与列表状态被空数组掩盖的问题，补齐 loading/error/empty 三态
> 最后更新：2026-03-07 | 1:1 还原 MapEditor Figma 设计（node 9:411）：深色调色板、头部、左侧工具栏、右侧属性面板、底部缩放栏；保留全部功能逻辑
| MapEditor 做 1:1 还原时工具栏/属性栏位置总是“居中漂移” | 用 `top:50% + translateY` 实现，无法匹配 Figma 的固定像素锚点（`left aside: top 325.5`、`right aside: top 247`） | 面板改为绝对像素锚点定位，并保持容器尺寸固定（`64x373`、`288x530`）以避免不同视口下偏移 |

> 最后更新：2026-03-07 | 新增 Figma 1:1 还原陷阱：固定像素锚点面板不能使用 `translateY` 居中定位
| Electron dev 模式 fork `.bin/tsx` 失败 (Windows) | `fork()` 尝试以 Node 模块方式执行 `.bin/tsx`，该文件在 Windows 为 bash shell 脚本 | 改用 `fork('src/index.ts', [], { execArgv: ['--import', 'tsx'], env: { ELECTRON_RUN_AS_NODE: '1' } })` |
| Electron dev 模式 preload 加载 404 | `tsx` 直接运行 main.ts 时 `__dirname` 是 `src/`，但 preload 必须是编译后的 `.js` | 改为先 `tsc` 编译整个 electron/ 再 `npx electron .`（从 `dist/` 运行），废弃 tsx 直接跑主进程的方案 |

> 最后更新：2026-03-09 | Electron 桌面端全功能补齐：链 SDK 安装（ethers/@solana/web3.js/bitcoinjs-lib），LoginForm 桌面端 OAuth IPC 适配，reminder worker 推送系统通知，main.ts 生产模式构建路径，dev:desktop 端到端启动验证通过
| Electron 控制台报 `Unable to load preload script` + `module not found: ./ipc/channels.js`，Google 登录按钮无反应 | 开启 `sandbox:true` 时，preload 里的相对模块导入会在沙箱 `preloadRequire` 阶段失败，导致 `window.naotuDesktop` 未注入，登录逻辑退化为 Web 路径且被导航策略拦截 | `preload.ts` 禁止运行时相对导入：把 IPC 通道常量内联（仅保留 type import）；重新编译 `electron/dist` 后再启动 |
| Google 登录弹出窗口白屏 | 主进程对所有响应统一注入 CSP，第三方 Google OAuth 页面资源被 CSP 拦截；同时 OAuth 启动 URL 未走 better-auth 标准入口 | CSP 仅对本地前后端 origin 注入；桌面端 OAuth 先调用 `POST /auth/sign-in/social` 获取 Google 授权 URL，再在 popup 加载返回的 `url` |
| 桌面端改用系统浏览器后无法把登录态带回 Electron | Google/OAuth 登录在系统浏览器完成，session cookie 保存在浏览器上下文，Electron 无法直接读取 | 新增 `desktop/init → desktop/grant → desktop/consume` 一次性授权码桥接：浏览器端通过 `desktop-auth-bridge` 页面换取短时 grant，Electron loopback 回调消费 grant 获取 `sessionToken` 并注入 `better-auth.session_token` |
| 系统浏览器 OAuth 出现 `state_mismatch` | 在 Electron 主进程里 `fetch /auth/sign-in/social` 会把 `better-auth.state` cookie 写到 Node 请求上下文，不在系统浏览器；同时 `/auth/sign-in/social` 仅接受 JSON，不接受表单 content-type | 改为浏览器访问 `/auth/desktop/start`，由页面脚本 `fetch('/auth/sign-in/social', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include' })` 获取 Google URL 后再跳转，确保 state 生成与校验都在同一浏览器会话 |
| 系统浏览器启动页报 `sign-in/social failed: 403 INVALID_ORIGIN` | `backend/.env` 里 `BETTER_AUTH_URL` 误配为前端 `http://localhost:3000`，导致 better-auth 在开发态用错 baseURL/trusted origin，`Origin: http://localhost:3001` 被拒绝 | 在 `backend/src/lib/auth.ts` 增加开发环境兜底：若 `BETTER_AUTH_URL` 缺失或等于 `FRONTEND_URL`，自动回退到后端 origin（默认 `http://localhost:3001`），并把 `3000/3001/127.0.0.1` 都加入 `trustedOrigins` |
| 桌面端 OAuth 成功后 `GET /api/maps` 持续 401 | 仅向后端 origin (`3001`) 注入了 `better-auth.session_token`，前端实际请求走 `3000` 同源 + rewrite，浏览器未携带 `3000` 域下 cookie | Electron 登录成功后同时向 `BACKEND_URL` 与 `FRONTEND_URL` 注入 session cookie，确保 `/api/*` 代理请求携带认证态 |
| 修完 `INVALID_ORIGIN` 后又出现 `redirect_uri_mismatch` | 将开发态 `baseURL` 强制回退到后端 `3001`，会让 Google 授权链接里的 `redirect_uri` 变成 `http://localhost:3001/auth/callback/google`，与当前 Google Console 仅配置 `3000` 不一致 | 开发态 `baseURL` 改为“优先 `BETTER_AUTH_URL`，缺省用 `FRONTEND_URL`”；并把 `3001` 仅放入 `trustedOrigins`（不作为默认 redirect base） |
| Google 登录成功但 `/api/maps` 持续 401，而 `/auth/get-session` 正常 | 前端 `api.ts` 在 `NEXT_PUBLIC_API_URL` 为空时用 `||` 回退到 `http://localhost:3001`，导致 `/api/*` 走跨域直连 3001；同时 auth-client 走同源 3000 rewrite，认证链路被分叉 | `api.ts` 改为 `process.env.NEXT_PUBLIC_API_URL ?? ''`，空字符串保持同源请求；`/auth/*` 与 `/api/*` 统一走 3000 rewrite，消除会话来源不一致 |
| 桌面 OAuth 看似成功但后端接口持续 401（中间件能看到 cookie 名） | `desktop/grant` 用 `session.session.token` 发给 Electron 注入，该字段在当前 better-auth 流程下并不等于浏览器实际 cookie token 值，导致后端会话校验失败 | `desktop/grant` 改为从请求 `cookie` 头中直接提取 `better-auth.session_token`（或 `__Secure-` 版本）并作为 grant 载荷返回，Electron 注入后与浏览器会话一致 |

> 最后更新：2026-03-09 | 修复 Electron preload 沙箱模块加载失败（`./ipc/channels.js`）导致桌面 IPC 注入失效与 Google 登录无响应问题
> 最后更新：2026-03-09 | 修复 Google OAuth 弹窗白屏：CSP 注入范围收敛到本地 origin，并改为 better-auth 标准 `sign-in/social` 启动流程
> 最后更新：2026-03-09 | 桌面端 OAuth 升级为系统浏览器标准流：loopback 回调 + 一次性 grant 桥接 + sessionToken 注入 Electron cookie
> 最后更新：2026-03-09 | 修复系统浏览器 OAuth 的 state_mismatch：OAuth 启动从主进程 fetch 改为浏览器上下文 JSON fetch，保证 better-auth state cookie 一致性
> 最后更新：2026-03-09 | 修复系统浏览器 OAuth 的 INVALID_ORIGIN：开发环境自动校正 better-auth baseURL/trustedOrigins，兼容 backend:3001 与 frontend:3000 双 origin
> 最后更新：2026-03-09 | 修复桌面端 OAuth 后列表接口 401：登录成功后将 session cookie 同步注入 3001 与 3000 双 origin
> 最后更新：2026-03-09 | 修复 OAuth 回归 `redirect_uri_mismatch`：开发态恢复以 `BETTER_AUTH_URL/FRONTEND_URL(3000)` 作为 redirect base，仅扩展 trustedOrigins 覆盖 3001
> 最后更新：2026-03-09 | 修复登录成功后 maps 401 根因：`api.ts` 去掉 `|| http://localhost:3001` 回退，统一同源代理避免 auth/api 会话分叉
> 最后更新：2026-03-09 | 修复桌面 OAuth 后 401 深层根因：grant 透传 token 改为直接使用浏览器 cookie 中的 session token，避免 `session.session.token` 与真实 cookie 值不一致
