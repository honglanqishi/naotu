import 'dotenv/config';
import './bootstrap.js'; // 全局代理配置（必须紧跟 dotenv，早于所有网络相关模块）

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { sql } from 'drizzle-orm';
import { db } from './db/client.js';
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

// ── 全面数据库诊断（排除法） ─────────────────────────────
app.get('/health/db', async (c) => {
    const diag: Record<string, unknown> = {};

    // ① 环境变量检查
    diag.nodeEnv = process.env.NODE_ENV ?? '(unset)';
    diag.hasDbUrl = !!process.env.DATABASE_URL;
    diag.hasProxy = !!(process.env.HTTPS_PROXY || process.env.https_proxy);
    diag.proxyValue = process.env.HTTPS_PROXY || process.env.https_proxy || 'none';
    diag.vercel = !!process.env.VERCEL;
    diag.vercelRegion = process.env.VERCEL_REGION ?? '(unset)';

    if (process.env.DATABASE_URL) {
        try {
            const u = new URL(process.env.DATABASE_URL);
            diag.dbHost = u.host;
            diag.dbName = u.pathname.slice(1);
            diag.dbUser = u.username;
            diag.dbProtocol = u.protocol;
        } catch (e) {
            diag.dbUrlParseError = String(e);
        }
    }

    // ② 原始 fetch 测试 — 绕过 drizzle，直接 HTTP POST 到 Neon SQL 端点
    if (process.env.DATABASE_URL) {
        const t0 = Date.now();
        try {
            const u = new URL(process.env.DATABASE_URL);
            const resp = await Promise.race([
                fetch(`https://${u.host}/sql`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Neon-Connection-String': process.env.DATABASE_URL,
                    },
                    body: JSON.stringify({ query: 'SELECT 1 as ok', params: [] }),
                }),
                new Promise<never>((_, rej) =>
                    setTimeout(() => rej(new Error('RAW_FETCH_TIMEOUT_8S')), 8_000)
                ),
            ]);
            const body = await resp.text().catch((e: unknown) => String(e));
            diag.rawFetch = {
                status: resp.status,
                latencyMs: Date.now() - t0,
                body: body.slice(0, 500),
            };
        } catch (e) {
            diag.rawFetch = { error: String(e), latencyMs: Date.now() - t0 };
        }
    }

    // ③ Drizzle ORM 查询测试
    {
        const t0 = Date.now();
        try {
            const result = await Promise.race([
                db.execute(sql`SELECT 1 as ok`),
                new Promise<never>((_, rej) =>
                    setTimeout(() => rej(new Error('DRIZZLE_TIMEOUT_8S')), 8_000)
                ),
            ]);
            diag.drizzle = { ok: true, latencyMs: Date.now() - t0, result };
        } catch (e) {
            diag.drizzle = { error: String(e), latencyMs: Date.now() - t0 };
        }
    }

    // ④ 表存在性检查
    {
        const t0 = Date.now();
        try {
            const tables = await Promise.race([
                db.execute(sql`
                    SELECT table_name FROM information_schema.tables
                    WHERE table_schema = 'public'
                    ORDER BY table_name
                `),
                new Promise<never>((_, rej) =>
                    setTimeout(() => rej(new Error('TABLES_TIMEOUT_8S')), 8_000)
                ),
            ]);
            diag.tables = { ok: true, latencyMs: Date.now() - t0, tables };
        } catch (e) {
            diag.tables = { error: String(e), latencyMs: Date.now() - t0 };
        }
    }

    const allOk = diag.rawFetch && (diag.rawFetch as Record<string, unknown>).status === 200
        && diag.drizzle && (diag.drizzle as Record<string, unknown>).ok === true;
    return c.json({ status: allOk ? 'ok' : 'error', ...diag }, allOk ? 200 : 500);
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
