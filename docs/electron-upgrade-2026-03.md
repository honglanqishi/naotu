# Naotu Electron 升级技术文档（2026-03）

## 1. 升级目标

本次升级的核心目标：

1. 在 Electron 桌面端实现可用、稳定、可维护的认证与会话链路（Google OAuth + better-auth）。
2. 打通桌面端能力：IPC、系统通知、钱包/签名、后端 worker 事件推送。
3. 统一前后端请求链路，避免 Web/桌面端会话分叉导致的 `401`。
4. 提升开发与生产启动稳定性（Windows 环境、preload 加载、构建路径）。

---

## 2. 架构升级概览

### 2.1 桌面端运行架构

- 主进程：`electron/src/main.ts`
  - 启动/管理 backend 与 frontend 子进程
  - 注册 IPC handlers
  - 承载 OAuth 桌面流
  - 注入会话 cookie
  - 系统通知与菜单
- preload 隔离层：`electron/src/preload.ts`
  - 通过 `contextBridge` 暴露白名单 API
  - 禁止直接暴露原始 `ipcRenderer`
- 渲染层桥接：`frontend/src/lib/desktop-ipc.ts`
  - 统一桌面 API 访问
  - Web 端降级（非桌面环境静默处理）

### 2.2 OAuth 桌面桥接架构

采用“系统浏览器 + 一次性授权码桥接 + loopback 回调”方案：

1. Electron 主进程发起桌面 OAuth（`startDesktopOAuth`）。
2. 系统浏览器打开 `/auth/desktop/start`。
3. 浏览器上下文内调用 `POST /auth/sign-in/social`，确保 `state` 在同一浏览器链路生成与校验。
4. 登录成功后跳转 `frontend/app/desktop-auth-bridge`，桥接页调用 `/auth/desktop/grant` 获取一次性 `grant`。
5. 浏览器跳转到 Electron loopback 地址（`127.0.0.1:{port}`）并携带 `grant`。
6. Electron 回调服务调用 `/auth/desktop/consume` 换取 `sessionToken`，注入桌面 cookie。

后端新增端点：

- `POST /auth/desktop/init`
- `GET /auth/desktop/start`
- `GET /auth/desktop/grant`
- `POST /auth/desktop/consume`

对应服务：`backend/src/services/desktop-auth.service.ts`。

---

## 3. 关键实现与修复点

### 3.1 preload 与沙箱兼容

问题：`sandbox` 模式下 preload 相对模块加载失败（`module not found: ./ipc/channels.js`）。

实现：

- preload 内联 IPC 通道常量，移除运行时相对导入。
- 保留类型导入，保证编译期类型安全。

收益：恢复 `window.naotuDesktop` 注入，桌面端 IPC 能力可用。

### 3.2 OAuth 稳定性（state、origin、redirect）

处理了三类核心问题：

1. `state_mismatch`
   - 根因：主进程 fetch 与系统浏览器上下文分离。
   - 方案：`desktop/start` 在浏览器上下文内发起 `sign-in/social`。

2. `INVALID_ORIGIN`
   - 根因：开发环境 `BETTER_AUTH_URL` 与可信 origin 配置不一致。
   - 方案：规范 `auth.ts` 的 baseURL/trustedOrigins 解析逻辑，并对开发态做兜底。

3. `redirect_uri_mismatch`
   - 根因：OAuth base URL 与 Google Console 配置不一致。
   - 方案：开发态使用与 Google Console 一致的 URL（本地默认 3000 回调），并保留 3001 作为 trusted origin。

### 3.3 登录成功后 `/api/maps` 401

这是本次最关键的业务可用性问题，最终定位为“双重分叉”叠加：

- 分叉 A：`/auth` 与 `/api` 不同 baseURL（前端 `api.ts` 在空值时回退到 `3001`）。
- 分叉 B：桌面 grant 回传给 Electron 的 token 不是浏览器实际 cookie token。

最终修复：

1. 前端 `api.ts` 统一同源策略：
   - `baseURL` 改为 `process.env.NEXT_PUBLIC_API_URL ?? ''`。
2. 桌面 token 源统一：
   - `desktop/grant` 从请求 `cookie` 头提取真实 `better-auth.session_token` 回传。
3. 主进程会话注入双 origin：
   - 同时注入 `BACKEND_URL` 与 `FRONTEND_URL`。

结果：登录态与 `/api/*` 访问链路统一，避免“能登录但拉不到列表”的状态。

### 3.4 开发运行稳定性（Windows）

- 修复 Windows 下 fork/tsx 运行问题：使用 `ELECTRON_RUN_AS_NODE + --import tsx`。
- 调整 dev 启动为先编译后运行，避免 preload 404。
- 新增 `predev:desktop`，自动清理 3000/3001 端口占用。

---

## 4. 技术亮点

1. 标准化桌面 OAuth
   - 使用系统浏览器完成授权流程，避免嵌入式页面兼容问题与策略风险。

2. 一次性授权码桥接（Grant）
   - 短 TTL、一次性消费、nonce 绑定，降低重放风险。

3. 会话一致性治理
   - 明确区分认证链路（state/redirect）与业务链路（api session），逐层统一。

4. 安全边界更清晰
   - preload 白名单 API + contextIsolation + sandbox。
   - 主窗口导航与 CSP 注入范围受控。

5. 可观测性增强
   - 关键链路日志（backend/frontend/electron）可串联排障。

---

## 5. 技术优势

### 5.1 对用户体验

- 登录流程可预期：系统浏览器授权后自动回桌面会话。
- 避免“登录成功但业务接口 401”的割裂体验。

### 5.2 对工程维护

- Web 与桌面认证逻辑分层清楚，问题定位更快。
- 文档化“已知陷阱”减少回归成本。

### 5.3 对安全与合规

- 降低 OAuth 状态错配和跨上下文会话风险。
- 最小暴露 IPC 面，减少渲染进程越权面。

---

## 6. 关键文件清单

- 主进程：`electron/src/main.ts`
- preload：`electron/src/preload.ts`
- 桌面 OAuth：`electron/src/auth/oauth-desktop.ts`
- IPC 合约：`electron/src/ipc/channels.ts`
- 后端 auth 路由：`backend/src/routes/auth.ts`
- 后端桌面桥接服务：`backend/src/services/desktop-auth.service.ts`
- 前端桥接页：`frontend/src/app/desktop-auth-bridge/page.tsx`
- 前端 API 客户端：`frontend/src/lib/api.ts`
- 前端桌面 IPC 适配：`frontend/src/lib/desktop-ipc.ts`

---

## 7. 验证建议（回归清单）

1. 运行 `npm run dev:desktop`。
2. 点击 Google 登录，验证：
   - 系统浏览器打开
   - 授权后返回桌面
   - Dashboard 能正常拉取 `/api/maps`
3. 验证菜单“帮助 → 测试系统通知”可弹系统通知。
4. 观察日志：
   - 无 `state_mismatch`
   - 无 `INVALID_ORIGIN`
   - `/api/maps` 返回 `200`

---

## 8. 后续优化建议

1. 为桌面 OAuth 链路补集成测试（start/grant/consume）。
2. 将关键认证日志加结构化 traceId，提升跨进程追踪能力。
3. 生产环境引入更严格的 cookie 策略与安全头审计。
4. 把 OAuth/会话相关环境变量校验前置到启动阶段（fail-fast）。
