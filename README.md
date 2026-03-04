# Naotu · 脑图 🧠

> 个人知识思维导图管理系统 — 基于 2026 现代全栈技术栈

## 技术栈

| 层 | 技术 |
|---|---|
| **前端** | Next.js 15 · React 19 · TypeScript · Tailwind CSS v4 Zustand  |
| **思维导图** | @xyflow/react · mind-elixir · AntV G6 v5 · Mermaid.js |
| **后端** | Hono.js v4 · better-auth (Google OAuth) |
| **数据库** | PostgreSQL 17 · Drizzle ORM · SQLite（本地开发） |
| **部署** | Docker Compose · Nginx · Let's Encrypt |

## 目录结构

```
naotu/
├── frontend/        # Next.js 15 前端
├── backend/         # Hono.js REST API
├── database/        # Drizzle Schema + 迁移
├── docker-compose.yml
├── nginx.conf
└── .env.example
```

## 本地开发

### 前提条件

- Node.js 22+
- Docker + Docker Compose
- Google Cloud Console 项目（用于 OAuth）

### 1. 克隆并配置环境变量

```bash
git clone <your-repo>
cd naotu
cp .env.example .env
# 编辑 .env，填写 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET 等
```

### 2. Google OAuth 配置

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建 OAuth 2.0 凭据（Web 应用类型）
3. 授权重定向 URI 填写：
   - 本地：`http://localhost:3001/auth/callback/google`
   - 生产：`https://your-domain.com/auth/callback/google`

   客户端ID：`<your-google-client-id>.apps.googleusercontent.com`
   客户端密钥：`<your-google-client-secret>`

### 3. 启动服务

#### 方式 A：本地开发（SQLite，推荐）

无需 Docker，一条命令启动全部服务：

```bash
# 根目录执行（自动迁移 + 并发启动 backend & frontend）
npm run dev
```

首次运行会自动执行 SQLite 迁移并创建 `local.db`，后续直接复用。

> 后端在 `NODE_ENV=development`（tsx 默认）下会自动使用 SQLite，无需配置 `DATABASE_URL`。

#### 方式 B：本地 Docker PostgreSQL（可选）

如果你希望在本地也使用 PostgreSQL，确保 Docker 正常运行后：

```bash
# 运行 PG 迁移（首次）
npm run migrate

# 启动 PostgreSQL + backend + frontend
npm run dev:pg
```

访问 http://localhost:3000

## 生产部署（Ubuntu VPS）

### 1. 服务器准备

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 安装 Certbot
sudo apt install certbot python3-certbot-nginx -y
```

### 2. 申请 SSL 证书

```bash
sudo certbot certonly --standalone -d your-domain.com
```

### 3. 修改 nginx.conf

将 `your-domain.com` 替换为你的实际域名。

### 4. 配置 .env

```bash
cp .env.example .env
# 填写所有生产环境配置
```

### 5. 启动全部服务

```bash
docker compose up -d

# 执行数据库迁移（首次）
docker compose exec backend sh -c "cd /app && node -e \"require('./dist/db/migrate.js')\""
```

### 6. 查看日志

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

## API 文档

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/auth/sign-in/social?provider=google` | 发起 Google 登录 |
| POST | `/auth/sign-out` | 退出登录 |
| GET | `/auth/get-session` | 获取当前 session |

### 思维导图

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/maps` | 获取所有导图 |
| POST | `/api/maps` | 创建导图 |
| GET | `/api/maps/:id` | 获取单个导图 |
| PUT | `/api/maps/:id` | 更新导图（节点+边） |
| DELETE | `/api/maps/:id` | 删除导图 |

### 标签

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tags` | 获取标签列表 |
| POST | `/api/tags` | 创建标签 |
| DELETE | `/api/tags/:id` | 删除标签 |

## 数据模型

```
User (better-auth 管理)
  ├── MindMap[]   # 思维导图（含 nodes/edges JSON）
  └── Tag[]       # 知识分类标签
```

## 路线图

- [x] 阶段 A：基础框架（登录 + 导图 CRUD）
- [ ] 阶段 B：思维导图编辑器增强（自定义节点、样式）
- [ ] 阶段 C：标签系统 + 搜索
- [ ] 阶段 D：AI 辅助（节点生成建议）
- [ ] 阶段 E：导入/导出（Markdown、PNG、SVG）
