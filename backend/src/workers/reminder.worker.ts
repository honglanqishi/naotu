import { db } from '../db/client.js';
import { todoReminders } from '../db/tables.js';
import { eq, and, lte } from 'drizzle-orm';
import { emailService } from '../services/email.service.js';

let isRunning = false;

/**
 * 当运行在 Electron 子进程中时，通过 IPC 向主进程推送系统通知。
 * 非 Electron 环境（独立后端）静默忽略。
 */
function notifyDesktopParent(title: string, body: string, route?: string): void {
    if (typeof process.send === 'function') {
        process.send({
            type: 'reminder:notify',
            payload: { title, body, route },
        });
    }
}

/**
 * 核心提醒处理逻辑 — 可被 setInterval（本地）或 HTTP cron 端点（Vercel）调用
 */
export async function processReminders(): Promise<void> {
    if (isRunning) return;

    isRunning = true;
    try {
        const now = new Date();

        // 1. 获取所有待发送且时间已到的提醒
        const pendingReminders = await db
            .select()
            .from(todoReminders)
            .where(and(eq(todoReminders.status, 'pending'), lte(todoReminders.remindAt, now)));

        if (pendingReminders.length === 0) return;

        console.log(`[Worker] Found ${pendingReminders.length} reminders to process.`);

        for (const reminder of pendingReminders) {
            const [claimed] = await db
                .update(todoReminders)
                .set({
                    status: 'processing',
                    updatedAt: new Date(),
                })
                .where(and(eq(todoReminders.id, reminder.id), eq(todoReminders.status, 'pending')))
                .returning({ id: todoReminders.id });

            if (!claimed) {
                continue;
            }

            // 2. 发送邮件
            const success = await emailService.sendReminderEmail(
                reminder.email,
                reminder.title,
                reminder.notes || ''
            );

            // 2b. 同时推送桌面系统通知（Electron 环境下）
            if (success) {
                notifyDesktopParent(
                    `⏰ 待办提醒：${reminder.title}`,
                    reminder.notes || '你有一个待办事项已到期',
                    `/map/${reminder.mindmapId}`,
                );
            }

            // 3. 更新状态
            await db
                .update(todoReminders)
                .set({
                    status: success ? 'sent' : 'failed',
                    updatedAt: new Date(),
                })
                .where(and(eq(todoReminders.id, reminder.id), eq(todoReminders.status, 'processing')));
        }
    } catch (error) {
        console.error('[Worker Error]', error);
    } finally {
        isRunning = false;
    }
}

/**
 * 待办提醒后台工作者
 * 本地/非 Vercel 环境：每分钟自动轮询
 * Vercel 环境：由 /api/cron/reminders HTTP 端点触发，此函数跳过
 */
export async function startReminderWorker() {
    if (process.env.REMINDER_WORKER_ENABLED === 'false') {
        console.log('⏸️ Reminder worker disabled by REMINDER_WORKER_ENABLED=false');
        return;
    }
    if (process.env.VERCEL) {
        console.log('⏸️ Reminder worker skipped on Vercel — use /api/cron/reminders endpoint');
        return;
    }

    console.log('⏰ Reminder worker started...');
    setInterval(() => processReminders(), 60 * 1000);
}
