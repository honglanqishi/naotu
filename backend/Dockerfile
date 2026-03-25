# ==================
# 构建阶段
# ==================
FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable

# 复制整个项目（Monorepo环境）
COPY . .

# 安装工作区依赖并编译后端
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @naotu/backend build

# ==================
# 生产运行阶段
# ==================
FROM node:22-alpine AS runner

WORKDIR /app
RUN corepack enable

ENV NODE_ENV=production

# 复制构建结果
COPY --from=builder /app /app

EXPOSE 3001

CMD ["pnpm", "--filter", "@naotu/backend", "start"]
