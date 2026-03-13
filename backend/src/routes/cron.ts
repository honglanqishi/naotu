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
    const secret = c.req.header('x-cron-secret');
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    await processReminders();
    return c.json({ success: true, timestamp: new Date().toISOString() });
});

export { cronRoutes };
