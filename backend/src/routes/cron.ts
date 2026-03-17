import { Hono } from 'hono';
import { processReminders } from '../workers/reminder.worker.js';
import type { AppEnv } from '../types/hono.js';

const cronRoutes = new Hono<AppEnv>();

/**
 * GET /api/cron/reminders
 *
 * 供外部 cron 服务（如 cron-job.org、Vercel Cron）每分钟调用。
 * 用 x-cron-secret 请求头验证身份，防止未授权触发。
 *
 * 环境变量：CRON_SECRET=<任意随机字符串>
 * 调用方在请求头加：x-cron-secret: <同一字符串>
 */
cronRoutes.get('/reminders', async (c) => {
    // 支持两种鉴权方式：
    // 1. Vercel 内置 Cron 自动携带的 x-vercel-cron: 1 头
    // 2. 外部 cron 服务（cron-job.org 等）使用 x-cron-secret
    const isVercelCron = c.req.header('x-vercel-cron') === '1';
    const secret = c.req.header('x-cron-secret');
    const configuredSecret = process.env.CRON_SECRET;
    const validSecret = !!configuredSecret && secret === configuredSecret;

    if (!isVercelCron && !configuredSecret) {
        return c.json({ error: 'CRON_SECRET is not configured' }, 503);
    }

    if (!isVercelCron && !validSecret) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    await processReminders();
    return c.json({ success: true, timestamp: new Date().toISOString() });
});

export { cronRoutes };
