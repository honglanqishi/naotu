# ==================
# 构建阶段
# ==================
FROM node:22-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package.json ./
RUN npm install

# 复制源码（包含 database schema 引用）
COPY . .
COPY ../database ./database

# 编译 TypeScript
RUN npm run build

# ==================
# 生产运行阶段
# ==================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

CMD ["node", "dist/index.js"]
