# Naotu（脑图）AI 编码指南

## ⚠️ AI Agent 自维护规则（必读，永远执行）

**每次完成重大变更后，必须立即更新本文件，无需等待用户提醒。**

触发条件（满足任一即更新）：
- 修复了一个需要多轮排查的 bug
- 新增或修改了项目架构、路由、数据库 schema
- 发现了一个此前文档未记录的"坑"（行为异常、隐性约束）
- 完成了 Figma 还原任务并遇到了新问题

更新操作：
1. 将 bug / 陷阱追加到 D:\naotu\.github\bug-list.md **「已知 Bug 与陷阱清单」** 表格（现象 / 根因 / 解决方案三列）
2. 将架构变化更新到对应章节
3. 在文件末尾追加一行 `> 最后更新：{日期} | {本次变更摘要}`

> 不更新本文件 = 让下一个 AI session 重复踩同一个坑，等于浪费用户时间。


## MCP工具使用指南

**搜索的时候#find_symbol, #find_referencing_symbols #insert_after_symbol. 这三个工具增加搜索效率。**

---

> 最后更新：2026-03-07 | 修复 Dashboard 重构后删除/创建弹窗提前关闭与列表状态丢失问题：mutation 成功后再关弹窗，列表必须区分 loading/error/empty 三态

> 最后更新：2026-03-06 | 二次重写 DashboardContent：严格还原 Figma node 9:2 绝对定位布局（h-[586px] relative 容器，5张绝对定位卡片），解决首次 CSS Grid 方案与设计稿出入过大问题，TypeScript EXIT:0

> 最后更新：2026-03-05 | 标签独立到节点内容前方，保留原标签名样式与编辑逻辑，底部装饰行仅保留非标签入口
> 最后更新：2026-03-05 | 修复底部快捷按钮对齐与评论保存入口不明显（统一22x22槽位、保存文案与快捷键提示）

> 最后更新：2026-03-05 | 修复节点装饰图标对齐与尺寸不一致，装饰区统一快捷位（标签保持原标签名样式）

> 最后更新：2026-03-05 | 修复多选富文本工具栏重复显示、节点超链接改为右键菜单+统一弹窗编辑

## 项目架构

**Naotu** 是个人知识思维导图管理系统，Monorepo 结构（根 `package.json` 用 `concurrently` 协调子包）：

| 目录 | 职责 |
|---|---|
| `frontend/` | Next.js 15 + React 19，页面路由、思维导图编辑器 |
| `backend/` | Hono.js v4 REST API，better-auth 认证，Drizzle ORM |
| `database/` | Drizzle schema 定义 + 迁移脚本（PG & SQLite 双套） |
| `electron/` | Electron 桌面壳：主进程（IPC / 签名 / 密钥存储 / 系统通知）、preload 隔离层 |

### Electron 桌面端模块

| 文件 | 职责 |
|---|---|
| `electron/src/main.ts` | 主进程入口：`BrowserWindow`、子进程管理（backend/frontend dev server）、OAuth IPC、CSP、菜单 |
| `electron/src/preload.ts` | `contextBridge` 隔离层，向 renderer 暴露 `window.naotuDesktop` 白名单 API |
| `electron/src/ipc/channels.ts` | IPC 通道名枚举 + 全部类型合约（三端共用：主进程 / preload / renderer） |
| `electron/src/ipc/handlers.ts` | `ipcMain.handle` 集中注册：钱包 CRUD、签名、通知、应用信息 |
| `electron/src/services/keystore.ts` | 私钥本地加密存储（AES-256-GCM + PBKDF2 600K 迭代），文件落盘于 `%APPDATA%/naotu/vault/` |
| `electron/src/services/signer.ts` | 多链签名抽象层：`ChainSigner` 接口 + `EvmSigner`/`SolanaSigner`/`BitcoinSigner`，链 SDK 延迟加载 |
| `electron/src/services/notification.ts` | 系统级通知（`Notification` API）：交易状态推送、待办提醒、点击跳转 |
| `electron/src/auth/oauth-desktop.ts` | 桌面端 Google OAuth（Loopback IP / RFC 8252 §7.3），临时 HTTP server + 系统浏览器 |
| `frontend/src/lib/desktop-ipc.ts` | Renderer 侧 IPC 桥接层：封装 `window.naotuDesktop`，Web 端降级为 no-op |
| `frontend/src/hooks/useWallet.ts` | 钱包管理 React Query hook（创建/导入/删除/签名），遵循项目 hook 封装规范 |
| `frontend/src/hooks/useDesktopNotifications.ts` | 桌面端事件监听 hook：交易状态推送 → toast，通知点击 → 路由跳转 |

### 后端关键模块

| 文件 | 职责 |
|---|---|
| `backend/src/types/hono.ts` | 全局 `AppEnv` 类型（`AuthUser`、`AuthSession`），所有路由/中间件共用，**禁止在路由文件内重复定义 `Env`** |
| `backend/src/services/reminders.service.ts` | 提醒业务逻辑：`ReminderCode`、`normalizeReminderCode`、`computeRemindAt`（数据驱动 `OFFSET_MS` map）、`syncReminders` |

### 前端关键模块

| 文件 | 职责 |
|---|---|
| `frontend/src/hooks/useMindMaps.ts` | 脑图列表 + 增删请求（包含 toast、路由跳转），`MindMap` 接口唯一声明处 |
| `frontend/src/hooks/useAuthRedirect.ts` | Auth guard + Zustand 同步 + `getUserInitials()` 工具函数 |
| `frontend/src/hooks/useWallet.ts` | 桌面端钱包管理 hook（创建/导入/删除/签名），仅 Electron 环境启用 |
| `frontend/src/hooks/useDesktopNotifications.ts` | 桌面端事件监听（交易状态/通知点击），Web 端静默降级 |
| `frontend/src/components/ui/Modal.tsx` | 通用弹窗（黑色背景 + 卡片），替代重复的弹窗 div 模板 |

## 关键开发命令

```bash
# 推荐：一键启动（SQLite，无需 Docker）
pnpm dev           # 根目录：自动迁移 + 并发启动 backend:3001 + frontend:3000

# 可选：本地 PostgreSQL（需 Docker）
pnpm dev:pg        # 启动 postgres + backend + frontend

# 仅执行数据库迁移
pnpm migrate:local  # SQLite（开发）
pnpm migrate        # PostgreSQL（生产）

# 前端单元测试（Jest + Testing Library）
pnpm --dir frontend test
```

## 数据库双模式切换

`backend/src/db/client.ts` 根据 `NODE_ENV` **自动**切换：
- `development` → **SQLite** via `@libsql/client`，文件为 `../local.db`
- `production` → **PostgreSQL** via `postgres-js`，需 `DATABASE_URL` 环境变量

`database/src/schema.ts`（PG）和 `database/src/schema.sqlite.ts`（SQLite）同步维护。  
`backend/src/db/` 内亦有镜像 schema，**与 `database/src/` 手动同步，不能相互 import**（Docker 路径隔离）。

## 认证流程

- `better-auth` 处理 Google OAuth，session 以 **httpOnly cookie** 存储。
- 后端所有业务路由通过 `authMiddleware`（`backend/src/middleware/auth.middleware.ts`）保护；session user 挂载到 `c.get('user')`。
- 前端 `api.ts` 的 axios 实例设置 `withCredentials: true`，401 时派发 `auth:unauthorized` 自定义事件。
- `frontend/src/app/providers.tsx` 的 `AuthGuard` 监听该事件，用 `router.push` 软跳转（避免硬刷新丢失编辑状态）。

## 思维导图编辑器

核心组件：`frontend/src/components/editor/MapEditor.tsx`（~957 行，`'use client'`）

- 使用 **@xyflow/react**（ReactFlow）渲染节点/边。
- 自定义节点类型 `mindNode`（`MindNode.tsx`）、边类型 `hierarchyEdge` / `associationEdge`。
- **nodeTypes/edgeTypes 必须定义在组件外部**，避免每次渲染重建。
- 节点 ID 用 `crypto.randomUUID()` 生成（浏览器原生，无需依赖）。
- 折叠/隐藏逻辑：`getHiddenNodeIds()` 递归收集子孙节点。
- 布局工具：`frontend/src/lib/layoutUtils.ts`（`calculateLayout` / `applyLayout`）。

## API 层规范

- 后端路由用 `@hono/zod-validator` + Zod schema 做入参校验（见 `backend/src/routes/maps.ts`）。
- 前端数据请求统一用 **TanStack Query**（`useQuery` / `useMutation`）；`api.ts` 的 axios 实例为唯一 HTTP 入口。
- Zustand store（`frontend/src/store/authStore.ts`）仅存 UI 状态（auth loading）；服务端数据用 TanStack Query 缓存。

## 待办提醒系统

- 数据落库：`todo_reminders`（`database/src/schema.ts` + `database/src/schema.sqlite.ts`，并同步 `backend/src/db/` 镜像）。
- 同步入口：保存导图时在 `backend/src/routes/maps.ts` 的 `syncReminders()` 从 `node.data.decorations.todo` 提取提醒（兼容旧 `node.data.todo`）。
- worker：`backend/src/workers/reminder.worker.ts` 每分钟扫描 `pending` 且到期的提醒，先抢占为 `processing`，发信后更新 `sent/failed`。
- 邮件：`backend/src/services/email.service.ts` 使用 nodemailer，邮件模板必须对用户输入做 HTML 转义。

## 项目约定

- 前端组件：小文件、单一职责，`'use client'` 最小化范围，优先 Server Component。
- 后端路由位于 `backend/src/routes/`，每个资源一个文件，在 `index.ts` 统一注册。
- CORS origin 使用 `FRONTEND_URL` 环境变量（`≠ BETTER_AUTH_URL`）。
- `backend/src/bootstrap.ts` 必须在所有网络模块前导入（全局代理配置）。
- 生产部署：Docker Compose + Nginx 反向代理，SSL 用 Let's Encrypt。

---

## 代码规范与开发注意事项（2026-03-08 全工程审查后确立）

> 以下规范源自一次完整的代码审查返工，**违反任一条都可能导致下次审查时再次重构**。

### 一、后端规范

#### ✅ 类型定义：只用 AppEnv，绝不在路由文件重复定义

```typescript
// ❌ 禁止 — 每个路由各自定义 Env
// maps.ts
type Env = { Variables: { user: { id: string } } }
const app = new Hono<Env>()

// tags.ts
type Env = { Variables: { user: { id: string } } }  // 重复！

// ✅ 正确 — 统一从 types/hono.ts 导入
import type { AppEnv } from '../types/hono.js'
const app = new Hono<AppEnv>()
```

唯一声明处：`backend/src/types/hono.ts`，修改类型只改这一个文件。

#### ✅ 业务逻辑：放 service，不放路由

路由文件只做三件事：**解析参数 → 调用 service → 返回响应**。任何超过 20 行的业务逻辑都应提取到 `backend/src/services/` 下。

```typescript
// ❌ 禁止 — 路由文件内写大段业务逻辑
app.put('/:id', async (c) => {
  // 100 行 switch 判断提醒偏移量...
  // 循环同步数据库...
})

// ✅ 正确 — route 只调用 service
import { syncReminders } from '../services/reminders.service.js'
app.put('/:id', async (c) => {
  const map = await db.update(...)
  await syncReminders(map.id, nodes, userId)
  return c.json({ success: true })
})
```

#### ✅ 数据驱动替代 switch：用 Map/Record 查表

```typescript
// ❌ 禁止 — 100 行 switch
switch (code) {
  case 'on_day':     return new Date(start.getTime() - 0); break;
  case 'min_5':      return new Date(start.getTime() - 5 * 60_000); break;
  // ... 20 个 case
}

// ✅ 正确 — 数据驱动，1 行计算
const OFFSET_MS: Record<ReminderCode, number> = {
  on_day: 0,
  min_5: 5 * 60_000,
  min_15: 15 * 60_000,
  // ...
}
const remindAt = new Date(startAt.getTime() - OFFSET_MS[code])
```

---

### 二、前端规范

#### ✅ 数据请求：必须封装成自定义 Hook

凡是用到 `useQuery` / `useMutation` 的逻辑，**必须提取到 `frontend/src/hooks/` 下的自定义 hook**，不得直接写在组件文件里。

```typescript
// ❌ 禁止 — 组件内直接写 useQuery/useMutation
export default function DashboardContent() {
  const { data: maps } = useQuery({ queryKey: ['maps'], queryFn: ... })
  const createMutation = useMutation({ mutationFn: ... })
  // ... 组件内夹杂大量数据逻辑
}

// ✅ 正确 — 数据逻辑封装进 hook
// hooks/useMindMaps.ts
export function useMindMaps() {
  const { data: maps, isLoading } = useQuery(...)
  const { mutate: createMap } = useMutation(...)
  return { maps, isLoading, createMap }
}

// 组件内只调用
export default function DashboardContent() {
  const { maps, isLoading, createMap } = useMindMaps()
}
```

**现有 Hook 清单（新增前先确认是否可复用）：**

| Hook | 职责 |
|---|---|
| `useMindMaps()` | 脑图列表查询 + 创建 + 删除（含 toast 和路由跳转） |
| `useAuthRedirect()` | Auth guard + Zustand 同步，返回 `{ session, isPending }` |
| `getUserInitials(name?)` | 从 `useAuthRedirect.ts` 导出的工具函数，取用户名首字母大写 |

#### ✅ Auth 跳转：只用 useAuthRedirect，禁止各页面重复写

```typescript
// ❌ 禁止 — 各组件各自 useSession + useEffect + router.push
useEffect(() => {
  if (!session) router.push('/login')
}, [session])

// ✅ 正确 — 统一调用 hook，一行搞定
const { session } = useAuthRedirect()  // 未登录自动跳转 /login
```

#### ✅ 弹窗：统一用 <Modal>，禁止重复写底层 div

```tsx
// ❌ 禁止 — 每个弹窗各自写蒙层 + 卡片 div
<div className="fixed inset-0 z-50 bg-black/60 ...">
  <div className="bg-[#1a1a1a] rounded-2xl ...">
    ...
  </div>
</div>

// ✅ 正确 — 统一用 Modal 组件
import Modal from '@/components/ui/Modal'
<Modal open={showDialog} onClose={() => setShowDialog(false)}>
  ...内容...
</Modal>
```

#### ✅ 常量：组件外声明，语义化命名

```typescript
// ❌ 禁止 — 16 个无意义变量名，写在组件内部
const imgContainer1 = '/images/...'
const imgContainer2 = '/images/...'
// ... 到 imgContainer16

// ✅ 正确 — 模块级常量对象，语义化 key
const ASSETS = {
  logo:        '/images/dashboard/logo.svg',
  avatar:      '/images/dashboard/avatar.svg',
  createPlus:  '/images/dashboard/create-plus.svg',
  // ...
} as const

// ❌ 禁止 — 数组/配置定义在组件函数内（每次渲染重建）
export default function Comp() {
  const themes = [{ id: 1, color: '...' }, ...]
}

// ✅ 正确 — 模块顶部定义
const THEMES = [{ id: 1, color: '...' }, ...] as const
export default function Comp() { ... }
```

#### ✅ 接口/类型：唯一声明，从所有者模块导出

```typescript
// ❌ 禁止 — MindMap 接口在多个文件里各自定义
// DashboardContent.tsx 里定义了 interface MindMap { ... }
// useMindMaps.ts 里又定义了 interface MindMap { ... }

// ✅ 正确 — 只在 hook 或 lib 里定义，组件 import
// hooks/useMindMaps.ts
export interface MindMap { id: string; title: string; ... }

// DashboardContent.tsx
import type { MindMap } from '@/hooks/useMindMaps'
```

---

### 三、TypeScript 规范

- **禁止使用 `any`**：路由参数用 Zod 推导类型，DB 查询结果用 Drizzle 推导类型。
- **每次改动后必须通过编译**：`npx tsc --noEmit`，零错误才算完成。
- **类型只声明一次**：接口/类型在最接近数据源的地方声明，其他地方 import，绝不复制粘贴。

---

### 四、提交前检查清单（每次开发完必须过一遍）

```
□ 后端有没有在路由文件里重复定义 Env 类型？       → 统一用 AppEnv
□ 路由文件里有没有超过 20 行的业务逻辑内联？       → 提取到 services/
□ 前端组件里有没有直接写 useQuery/useMutation？    → 封装进 hooks/
□ 有没有重复的弹窗 div 模板代码？                  → 使用 <Modal>
□ 常量/配置有没有定义在组件函数内部？               → 移至模块顶部
□ 同一个接口有没有在多个文件里各自定义？             → 唯一声明
□ 有没有用 getUserInitials 替代手动取首字母逻辑？   → 从 useAuthRedirect 导入
□ 前后端 tsc --noEmit 是否零错误？                 → 必须过编译
```

---

## React & Next.js 性能规范（2026-03-08 Vercel React Best Practices 审查后确立）

> 以下规范来自 Vercel 官方 React 性能指南（57 条规则），已针对本项目裁剪为必须执行的核心条目。

### 一、Concurrent Mode（并发模式）

**React 19 / Next.js 15 已自动开启 Concurrent Mode**（`createRoot` 默认行为），不需要任何配置。  
但你必须主动利用并发特性：

| 特性 | 用途 | 触发场景 |
|---|---|---|
| `Suspense` | 流式 SSR + 骨架屏 | 每个"加载中"都应包裹 Suspense |
| `useTransition` | 非紧迫状态更新（不阻塞输入） | 搜索过滤、排序、大数据更新 |
| `useDeferredValue` | 推迟昂贵的子树重渲染 | 大量节点的思维导图过滤 |

### 二、Bundle 分包（CRITICAL）

#### ✅ 重型客户端组件必须用 next/dynamic + ssr:false

> ⚠️ **Next.js 15 约束**：`ssr: false` 只能在 `'use client'` 组件中使用，Server Component 里直接写会报构建错误。
> 正确做法：把动态导入封装成一个 Client Component 包装层，再由 Server Component 页面引入该包装层。

```tsx
// ❌ 禁止 — 直接 import，@xyflow/react (~300KB) 参与 SSR bundle，首屏阻塞
import { MapEditor } from '@/components/editor/MapEditor';
return <MapEditor mapId={id} />;

// ❌ 禁止 — Server Component（async function page）里直接写 ssr:false，Next.js 15 构建报错
// app/map/[id]/page.tsx
const MapEditor = dynamic(() => import('...'), { ssr: false }); // 💥 Build Error

// ✅ 正确 — 分两步：
// 第一步：创建 'use client' 包装层（components/editor/MapEditorClient.tsx）
'use client';
import dynamic from 'next/dynamic';
const MapEditor = dynamic(
    () => import('@/components/editor/MapEditor').then((m) => m.MapEditor),
    { ssr: false },
);
export function MapEditorClient({ mapId }: { mapId: string }) {
    return <MapEditor mapId={mapId} />;
}

// 第二步：Server Component 页面引入包装层 + Suspense
import { MapEditorClient } from '@/components/editor/MapEditorClient';
return (
    <Suspense fallback={<LoadingSpinner />}>
        <MapEditorClient mapId={id} />
    </Suspense>
);
```

**判断标准：满足任一条即用 `next/dynamic({ ssr: false })`：**
- 依赖 `window` / `document` / `canvas` / WebGL
- bundle 大小 > 50KB（如 @xyflow/react、Monaco Editor、图表库）
- 仅在用户交互后才需要（拖拽、编辑器等）

#### ✅ 不要从 barrel 文件（index.ts）导入

```tsx
// ❌ 禁止 — 触发整个 barrel，即使只用其中一个函数
import { something } from '@/components';

// ✅ 正确 — 直接导入文件路径
import { something } from '@/components/SomeComponent';
```

### 三、Re-render 优化（MEDIUM）

#### ✅ 列表项目组件必须用 React.memo

```tsx
// ❌ 禁止 — 任何父级 state 变化都触发所有 card 重渲
{maps.map((map) => (
    <div key={map.id} onClick={() => setMenuOpenId(map.id)}>...</div>
))}

// ✅ 正确 — 只有 props 变化的 card 才重渲染
const MapCard = memo(function MapCard({ map, isMenuOpen, onMenuToggle }: Props) {
    ...
});
{maps.map((map) => (
    <MapCard key={map.id} isMenuOpen={menuOpenId === map.id} onMenuToggle={handleMenuToggle} />
))}
```

#### ✅ 传给 memo 组件的回调必须用 useCallback 稳定化

```tsx
// ❌ 禁止 — 每次渲染创建新函数引用，破坏 memo 效果
const handleMenuToggle = (id: string) => setMenuOpenId(...);

// ✅ 正确 — setter 本身稳定，deps 为空
const handleMenuToggle = useCallback((id: string) => {
    setMenuOpenId((prev) => (prev === id ? null : id));
}, []);
```

#### ✅ 只订阅回调内真正需要的 state（避免多余订阅）

```tsx
// ❌ 禁止 — 组件订阅了 count，但只在事件处理器里用到
const count = useStore((s) => s.count);
const handleClick = () => console.log(count);

// ✅ 正确 — 用 ref 读取 transient value，组件不订阅
const countRef = useRef(count);
countRef.current = count;
const handleClick = () => console.log(countRef.current);
```

### 四、事件监听规范

```tsx
// ❌ 禁止 — 默认 active listener，浏览器必须等待 preventDefault 判断
document.addEventListener('click', handler);
document.addEventListener('scroll', handler);

// ✅ 正确 — passive:true，告知浏览器不会调用 preventDefault，滚动更流畅
document.addEventListener('click', handler, { passive: true });
document.addEventListener('scroll', handler, { passive: true });
```

> 注意：若处理器内**必须**调用 `e.preventDefault()`（如阻止表单提交），则不能加 passive。

### 五、补充检查清单（每次开发完一并核对）

```
□ 新增重型组件（>50KB）有没有用 next/dynamic({ ssr: false })？
□ 新增页面有没有 Suspense 流式 fallback？
□ 列表渲染的 item 组件有没有 React.memo？
□ 传给 memo 子组件的函数有没有 useCallback？
□ document.addEventListener 有没有加 { passive: true }（不用 preventDefault 的场合）？
□ 有没有在 Suspense 内启动数据请求（而不是在外层等待）？
```

## CI/CD 约定（2026-03-15 新增）

- Web 端采用“双轨”发布：**GitHub Actions 只做 CI，Vercel 只做 frontend 自动部署**，禁止在 Actions 里再调用第二套前端 deploy，避免双重发布源。
- 依赖管理统一使用 `pnpm` workspace：根目录持有唯一 `pnpm-lock.yaml`，禁止继续提交各子包 `package-lock.json`。
- `.github/workflows/ci.yml` 负责 monorepo 基础校验：`pnpm install --frozen-lockfile` 后执行 `database build + Drizzle config check`、`backend build`、`frontend build`、`electron build`。
- `.github/workflows/electron-release.yml` 只用于桌面端发版，默认仅在 `v*` tag 或手动触发时执行，不得塞进日常 PR CI。
- 遇到网络问题，先使用 `127.0.0.1:7890` 作为 `HTTP_PROXY/HTTPS_PROXY` 代理，再执行 `pnpm install`、`pnpm add` 等联网命令。
- frontend 在 CI 中只需要最小占位环境变量使 `next build` 通过；**CI 能编过 ≠ Vercel 生产环境变量完整**，上线前仍需核对 Vercel Dashboard。
- 涉及 `database/`、`backend/src/db/`、鉴权代理链路（`frontend/src/app/api`、`frontend/src/app/auth`）的变更时，必须同时考虑“CI 构建通过”和“生产迁移 / 平台环境变量 / Vercel Root Directory”三件事，不能只看其中一个。
- `frontend/next.config.ts` 中的 `outputFileTracingRoot` 只用于生产构建；在 pnpm workspace 下若开发态也开启，Turbopack 可能把仓库根误判为 Next 项目根并报 `Next.js package not found`。

---

> 最后更新：2026-03-05 | 修复提醒同步字段不一致、提醒枚举归一化、XSS 防护与 worker 抢占发送

## Figma 设计稿还原（1:1 实现）

### 核心流程

```
获取 nodeId → get_design_context(forceCode:true) → get_screenshot → 下载图片到 public/ → 编码 → tsc 验证
```

### 获取节点 ID

URL 格式：`?node-id=2-173` → nodeId 为 `2:173`（连字符换冒号）

### 读取设计上下文

```
# 必须加 forceCode:true，否则大节点会被裁剪，拿不到完整资源 URL 和定位
get_design_context(nodeId: "2:173", forceCode: true)
```

返回内容包含：`localhost:3845/assets/{hash}.svg` 临时 URL + CSS `inset` 定位值。

### 图片资源下载（关键）

Figma MCP 返回的 `localhost:3845` 地址**仅本机运行时有效**，必须下载到 `public/images/`：

```powershell
# 创建目录
New-Item -ItemType Directory -Path "D:\naotu\frontend\public\images" -Force

# 下载（命名规则：node-{nodeId冒号换横线}.svg）
Invoke-WebRequest -Uri "http://localhost:3845/assets/{hash}.svg" `
  -OutFile "D:\naotu\frontend\public\images\node-2-174.svg"

# 验证（正常 SVG 应 >100KB，几字节说明下载失败）
Get-ChildItem "D:\naotu\frontend\public\images" | Select-Object Name, Length
```

代码中引用：`<img src="/images/node-2-174.svg" />`（`public/` 下直接用 `/` 路径）

### ⚠️ img 尺寸铁律（违反必出变形）

**每一个 `<img>` 标签必须同时写 `width` 和 `height`，数值直接取 Figma `data-name="Container"` 节点的精确尺寸，不得近似、不得省略任一轴。**

```tsx
// ❌ 错误 — 缺 height，浏览器 auto 推算与 SVG viewBox 不匹配
<img src="..." style={{ width: 14 }} />

// ❌ 错误 — 缺 width
<img src="..." style={{ height: 15 }} />

// ❌ 错误 — auto 是隐患
<img src="..." style={{ width: 30, height: 'auto' }} />

// ✅ 正确 — 两轴都写 Figma 精确值
<img src="..." style={{ width: 13.969, height: 1.969 }} />
<img src="..." style={{ width: 22.031, height: 12 }} />
```

Figma 代码中每个图标容器写法为：`<div className="... w-[13.969px]" data-name="Container">` 或 `size-[16.672px]` —— 取这两个值直接写入 style，绝不近似取整。

每次 Figma 还原任务同时必须：
1. 用 `Invoke-WebRequest` 将所有 `localhost:3845/assets/*.svg` **重新下载覆盖**本地旧文件（旧文件可能是占位 SVG）
2. 下载后校验文件大小（正常图标 SVG 应 ≥ 400 bytes，几字节说明下载失败）

### inset 定位解读

Figma 输出 `inset-[73.47%_66.42%_12.49%_21.67%]` 等价于 top/right/bottom/left，父容器必须有 `position: relative`：

```tsx
<main className="relative h-screen w-full overflow-hidden">
  <div className="absolute" style={{ top: '73.47%', right: '66.42%', bottom: '12.49%', left: '21.67%' }}>
    <img src="/images/node-2-174.svg" alt="" className="w-full h-full object-contain" />
  </div>
</main>
```

### 特殊情况

- **旋转元素**：加 `style={{ transform: 'rotate(-114.31deg)' }}`
- **超出父容器**：外层正常 inset + 内层负值 inset 修正
- **Next.js img 警告**：文件顶部加 `/* eslint-disable @next/next/no-img-element */`

### 验证

```powershell
# TS 编译检查
cd D:\naotu\frontend ; npx tsc --noEmit 2>&1 | Select-Object -First 40
```

---


> 最后更新：2026-03-07 | MapEditor 样式壳层按 Figma node 9:411 重构：固定锚点布局（Header/Left Aside/Right Aside/Bottom Controls）+ 英文文案对齐，保留 activeTool/zoomLevel/节点编辑与删除等原交互逻辑

> 最后更新：2026-03-07 | 确立 img 双轴尺寸铁律：width+height 必须同时写且取 Figma Container 精确值（不得省略/近似/用 auto），重新下载全部 SVG 覆盖旧占位文件，修复颜色圆圈 ring（4px white）与 gap（18.8px）

> 最后更新：2026-03-08 | 全工程代码审查重构：后端新增 `types/hono.ts`（AppEnv）消除路由重复 Env 类型；提醒逻辑提取到 `services/reminders.service.ts`（OFFSET_MS 数据驱动替代 100 行 switch）；前端新增 `hooks/useMindMaps`、`hooks/useAuthRedirect`、`components/ui/Modal` 三个复用模块；DashboardContent 从 589 行缩减为单职责 + 16 常量归并 ASSETS 对象；前后端 tsc --noEmit 零错误

> 最后更新：2026-03-08 | React/Next.js 性能优化：MapEditor 改用 next/dynamic({ ssr:false })+Suspense 流式（@xyflow/react 不再阻塞 SSR）；DashboardContent 提取 MapCard 为 React.memo 组件（menuOpenId 状态变化只重渲受影响卡片）；openDialog/handleMenuToggle/handleDeleteRequest 改为 useCallback 稳定化；document.addEventListener 加 { passive: true }；前端 tsc --noEmit 零错误

> 最后更新：2026-03-09 | Electron 桌面端全功能补齐：链 SDK 依赖安装（ethers/@solana/web3.js/bitcoinjs-lib 等 6 包）；LoginForm 桌面端 Google OAuth 走 IPC（isDesktop→desktopGoogleLogin+onLoginSuccess 事件监听）；reminder.worker 通过 process.send() 向 Electron 主进程推送系统通知；main.ts 生产模式构建路径（standalone server+extraResources）；修复 Windows fork .bin/tsx 失败（改为 ELECTRON_RUN_AS_NODE+--import tsx）；修复 preload 加载 404（改为 tsc 编译后 electron . 启动）；dev:desktop 端到端验证通过；前后端+electron 三包 tsc --noEmit 零错误

> 最后更新：2026-03-09 | 修复 Electron 沙箱 preload 模块加载失败（`module not found: ./ipc/channels.js`）：`preload.ts` 去除运行时相对导入并内联 IPC 通道常量，恢复 `window.naotuDesktop` 注入，桌面端 Google 登录按钮恢复响应
> 最后更新：2026-03-09 | 修复桌面端 Google OAuth 白屏：`main.ts` 的 CSP 仅注入本地前后端 origin，`oauth-desktop.ts` 改为调用 better-auth 标准 `POST /auth/sign-in/social` 获取授权 URL 后再加载 popup
> 最后更新：2026-03-09 | 桌面端 Google OAuth 升级为系统浏览器标准流（openExternal）：新增 `/auth/desktop/init|grant|consume` 一次性授权码桥接与 `frontend/app/desktop-auth-bridge` 页面，Electron 通过 loopback 回调消费 grant 后注入 `better-auth.session_token`
> 最后更新：2026-03-09 | 修复系统浏览器 OAuth `state_mismatch`：新增 `/auth/desktop/start` 在浏览器上下文以 JSON `POST /auth/sign-in/social` 初始化 state，再跳转 Google，避免主进程 fetch 造成 cookie 上下文错位
> 最后更新：2026-03-09 | 修复系统浏览器 OAuth `INVALID_ORIGIN`：`auth.ts` 开发环境自动修正 `BETTER_AUTH_URL` 误配（3000）为后端 origin（3001），并扩展 trustedOrigins 覆盖 localhost/127.0.0.1
> 最后更新：2026-03-09 | 修复桌面端 OAuth 后 `GET /api/maps` 401：主进程登录成功后同时向 `BACKEND_URL` 与 `FRONTEND_URL` 注入 `better-auth.session_token`，覆盖 Next 同源代理场景
> 最后更新：2026-03-09 | 修复 OAuth 回归 `redirect_uri_mismatch`：开发态 `auth.ts` 不再强制使用后端 3001 作为 baseURL，改为优先 `BETTER_AUTH_URL/FRONTEND_URL(3000)`，同时保留 3001 在 trustedOrigins 以兼容桌面启动 origin
> 最后更新：2026-03-09 | 修复登录成功后列表 401 的最终根因：`frontend/api.ts` 在 `NEXT_PUBLIC_API_URL=''` 时被 `||` 回退到 3001，导致 `/auth` 与 `/api` 分叉；改为 `?? ''` 统一同源 rewrite
> 最后更新：2026-03-09 | 修复桌面 OAuth 后接口仍 401：`/auth/desktop/grant` 不再用 `session.session.token`，改为从浏览器 `cookie` 头提取 `better-auth.session_token` 回传 Electron 注入
> 最后更新：2026-03-14 | 修复 Vercel 生产环境 Google 登录 `/auth/sign-in/social` 持续 pending/504：生产不再依赖 `next.config.ts` rewrites 代理鉴权，而改用 `frontend/src/app/auth/[...path]/route.ts` 与 `frontend/src/app/api/[...path]/route.ts` 显式代理到 `BACKEND_INTERNAL_URL`，仅转发必要头并为后端 fetch 设置显式超时；`NEXT_PUBLIC_API_URL` 不作为该场景主方案（`*.vercel.app` 间无法满足前端同域 cookie 需求）
> 最后更新：2026-03-14 | 修复 Vercel 生产环境后端 `auth.handler(c.req.raw)` 对 `/auth/sign-in/social` 仍挂起：在 `backend/src/routes/auth.ts` 单独改为 `auth.api.signInSocial({ headers, body })`，绕过 Node 请求适配链路兼容性问题，其余 `/auth/*` 继续保留原 handler
> 最后更新：2026-03-14 | 总结 Vercel Web Google OAuth 连环故障：该问题耗时两天的原因不是单一根因，而是 rewrite 超时、`auth.handler(c.req.raw)` 真实 POST 挂起、`auth.api.signInSocial` 未透传 state cookie、frontend/backend callback 域不一致四层串联遮蔽；以后必须按“浏览器同域 `/auth/*` -> direct signIn 是否返回完整 headers -> state cookie 是否落浏览器 -> `redirect_uri`/callback 域是否一致”的顺序排查
> 最后更新：2026-03-15 | 新增 GitHub Actions CI/CD 基线：`.github/workflows/ci.yml` 负责 monorepo 构建校验，frontend 生产发布继续交由 Vercel Git 集成，electron 发版拆到独立 tag workflow，避免与 Web 自动部署混线
> 最后更新：2026-03-15 | 切换全仓依赖管理到 pnpm workspace：根脚本、GitHub Actions、README 同步改为 pnpm；网络问题先走 `127.0.0.1:7890` 代理后再执行联网安装
> 最后更新：2026-03-15 | 修复 pnpm workspace 下 Next dev Turbopack 启动崩溃：`outputFileTracingRoot` 仅保留给生产构建，避免开发态误判项目根并报 `Next.js package not found`
> 最后更新：2026-03-15 | 修复运行时一致性与安全问题：CRON_SECRET 未配置默认放行、none 提醒误入库、脑图更新与提醒同步改为单事务、OAuth 代理改用 clone 读取响应并校验 Google 跳转域
> 最后更新：2026-03-15 | 建立前端 Jest 单测基线：新增 next/jest 配置、Testing Library setup，以及登录页/看板页的页面组合测试与核心交互测试
> 最后更新：2026-03-17 | 重构 MapEditor H5 响应式：新增移动端布局分支（头部精简、左侧工具栏重排、右侧属性抽屉、底部工具栏自适应）并修复全局 `touch-action` 影响画布手势问题
> 最后更新：2026-03-17 | 重构 Login + Dashboard H5 响应式：登录卡片改移动端优先尺寸/滚动容器，Dashboard 改自适应导航与抽屉侧栏、主区去固定高度、卡片网格按断点降列，移动端可操作性恢复
> 最后更新：2026-03-17 | 修复生产环境新增 auth 接口（含 sign-out）超时误报：前端 auth/api 代理改为按路由分级超时（25s/15s）并将超时明确返回 504
> 最后更新：2026-03-17 | 修复生产环境 sign-out 仍挂起：后端显式接管 `POST /auth/sign-out`，改用 `auth.api.signOut({ asResponse:true })` direct 路由绕过 `auth.handler(c.req.raw)` 兼容性问题
> 最后更新：2026-03-17 | 建立全接口超时兜底：后端新增 `withTimeout` 并接入 authMiddleware/maps/tags/cron，`app.onError` 统一返回 504；前端 auth/api 代理改按 HTTP 方法分级超时（写28s/读20s）
