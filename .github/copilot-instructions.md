# Naotu（脑图）AI 编码指南

## ⚠️ AI Agent 自维护规则（必读，永远执行）

**每次完成重大变更后，必须立即更新本文件，无需等待用户提醒。**

触发条件（满足任一即更新）：
- 修复了一个需要多轮排查的 bug
- 新增或修改了项目架构、路由、数据库 schema
- 发现了一个此前文档未记录的"坑"（行为异常、隐性约束）
- 完成了 Figma 还原任务并遇到了新问题

更新操作：
1. 将 bug / 陷阱追加到 **「已知 Bug 与陷阱清单」** 表格（现象 / 根因 / 解决方案三列）
2. 将架构变化更新到对应章节
3. 在文件末尾追加一行 `> 最后更新：{日期} | {本次变更摘要}`

> 不更新本文件 = 让下一个 AI session 重复踩同一个坑，等于浪费用户时间。

---

## 项目架构

**Naotu** 是个人知识思维导图管理系统，Monorepo 结构（根 `package.json` 用 `concurrently` 协调子包）：

| 目录 | 职责 |
|---|---|
| `frontend/` | Next.js 15 + React 19，页面路由、思维导图编辑器 |
| `backend/` | Hono.js v4 REST API，better-auth 认证，Drizzle ORM |
| `database/` | Drizzle schema 定义 + 迁移脚本（PG & SQLite 双套） |

## 关键开发命令

```bash
# 推荐：一键启动（SQLite，无需 Docker）
npm run dev           # 根目录：自动迁移 + 并发启动 backend:3001 + frontend:3000

# 可选：本地 PostgreSQL（需 Docker）
npm run dev:pg        # 启动 postgres + backend + frontend

# 仅执行数据库迁移
npm run migrate:local  # SQLite（开发）
npm run migrate        # PostgreSQL（生产）
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

## 项目约定

- 前端组件：小文件、单一职责，`'use client'` 最小化范围，优先 Server Component。
- 后端路由位于 `backend/src/routes/`，每个资源一个文件，在 `index.ts` 统一注册。
- CORS origin 使用 `FRONTEND_URL` 环境变量（`≠ BETTER_AUTH_URL`）。
- `backend/src/bootstrap.ts` 必须在所有网络模块前导入（全局代理配置）。
- 生产部署：Docker Compose + Nginx 反向代理，SSL 用 Let's Encrypt。

---

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

> 最后更新：2026-03-04 | 新增 AI 自维护规则、Figma 还原流程、11 条 Bug 陷阱清单
