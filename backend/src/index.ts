import 'dotenv/config';
import './bootstrap.js'; // 全局代理配置（必须紧跟 dotenv，早于所有网络相关模块）

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { authRoutes } from './routes/auth.js';
import { mapsRoutes } from './routes/maps.js';
import { tagsRoutes } from './routes/tags.js';
import { cronRoutes } from './routes/cron.js';
import { startReminderWorker } from './workers/reminder.worker.js';

const app = new Hono();

// =============================================
// 全局中间件
// =============================================
app.use('*', logger());
app.use('*', secureHeaders());
// CORS：允许前端域名跨域访问
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
const allowedOrigins = new Set([
    FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
]);

app.use(
    '*',
    cors({
        origin: (origin) => {
            if (!origin) return FRONTEND_URL;
            const clean = origin.replace(/\/$/, '');
            // 精确匹配 + 允许所有 *.vercel.app 预览域名
            if (allowedOrigins.has(clean) || clean.endsWith('.vercel.app')) {
                return clean;
            }
            return FRONTEND_URL;
        },
        allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true,
        exposeHeaders: ['Set-Cookie'],
    })
);

// =============================================
// 健康检查
// =============================================
app.get('/health', (c) => {
    return c.json({
        status: 'ok',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});

// =============================================
// 路由注册
// =============================================
app.route('/auth', authRoutes);
app.route('/api/maps', mapsRoutes);
app.route('/api/tags', tagsRoutes);
app.route('/api/cron', cronRoutes);

// =============================================
// 404 处理
// =============================================
app.notFound((c) => {
    return c.json({ error: 'Not found' }, 404);
});

// =============================================
// 全局错误处理
// =============================================
app.onError((err, c) => {
    console.error(`[Error] ${err.message}`, err);
    return c.json(
        {
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? err.message : undefined,
        },
        500
    );
});

// =============================================
// 本地开发：启动 HTTP 服务器 + 提醒 Worker
// Vercel 环境跳过（由 api/index.ts 接管请求，cron 路由处理提醒）
// =============================================
if (!process.env.VERCEL) {
    startReminderWorker();
    const { serve } = await import('@hono/node-server');
    const port = Number(process.env.BACKEND_PORT) || 3001;
    console.log(`🚀 Naotu Backend running on port ${port}`);
    serve({ fetch: app.fetch, port });
}

export default app;
