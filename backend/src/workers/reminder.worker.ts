import { db } from '../db/client.js';
import { todoReminders } from '../db/tables.js';
import { eq, and, lte } from 'drizzle-orm';
import { emailService } from '../services/email.service.js';

let isRunning = false;

/**
 * 待办提醒后台工作者
 * 定期检查并发送到期的提醒邮件
 */
export async function startReminderWorker() {
    if (process.env.REMINDER_WORKER_ENABLED === 'false') {
        console.log('⏸️ Reminder worker disabled by REMINDER_WORKER_ENABLED=false');
        return;
    }

    console.log('⏰ Reminder worker started...');

    // 每分钟检查一次
    const INTERVAL = 60 * 1000;

    setInterval(async () => {
        if (isRunning) {
            return;
        }

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
    }, INTERVAL);
}
