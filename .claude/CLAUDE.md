# Naotu（脑图）AI 编码指南

## ⚠️ AI Agent 自维护规则（必读，永远执行）
### MCP工具使用指南

**搜索的时候#search_for_pattern ,#find_symbol, #find_referencing_symbols #insert_after_symbol. 这些工具增加搜索效率。**

## 项目架构

**Naotu** 是个人知识思维导图管理系统，Monorepo 结构（根 `package.json` 用 `concurrently` 协调子包）：

| 目录 | 职责 |
|---|---|
| `frontend/` | Next.js 15 + React 19，页面路由、思维导图编辑器 |
| `backend/` | Hono.js v4 REST API，better-auth 认证，Drizzle ORM |
| `database/` | Drizzle schema 定义 + 迁移脚本（PG & SQLite 双套） |
| `electron/` | Electron 桌面壳：主进程（IPC / 签名 / 密钥存储 / 系统通知）、preload 隔离层 |

#### Electron 桌面端模块

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

##### 后端关键模块

| 文件 | 职责 |
|---|---|
| `backend/src/types/hono.ts` | 全局 `AppEnv` 类型（`AuthUser`、`AuthSession`），所有路由/中间件共用，**禁止在路由文件内重复定义 `Env`** |
| `backend/src/services/reminders.service.ts` | 提醒业务逻辑：`ReminderCode`、`normalizeReminderCode`、`computeRemindAt`（数据驱动 `OFFSET_MS` map）、`syncReminders` |

###### 前端关键模块

| 文件 | 职责 |
|---|---|
| `frontend/src/hooks/useMindMaps.ts` | 脑图列表 + 增删请求（包含 toast、路由跳转），`MindMap` 接口唯一声明处 |
| `frontend/src/hooks/useAuthRedirect.ts` | Auth guard + Zustand 同步 + `getUserInitials()` 工具函数 |
| `frontend/src/hooks/useWallet.ts` | 桌面端钱包管理 hook（创建/导入/删除/签名），仅 Electron 环境启用 |
| `frontend/src/hooks/useDesktopNotifications.ts` | 桌面端事件监听（交易状态/通知点击），Web 端静默降级 |
| `frontend/src/components/ui/Modal.tsx` | 通用弹窗（黑色背景 + 卡片），替代重复的弹窗 div 模板 |

###### 关键开发命令

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

