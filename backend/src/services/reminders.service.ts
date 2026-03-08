/**
 * 待办提醒业务逻辑
 *
 * 职责：
 *  - normalizeReminderCode：将前端传入的各种提醒字符串统一映射到内部枚举码
 *  - computeRemindAt：根据内部码计算实际提醒时间（数据驱动，避免大 switch）
 *  - syncReminders：解析导图节点中的 todo.reminder，写入 todoReminders 表
 */

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { todoReminders, generateId } from '../db/tables.js';

// ── 枚举类型 ──────────────────────────────────────────────────────────────────
export type ReminderCode =
    | 'none'
    | 'before_5m'
    | 'before_10m'
    | 'before_15m'
    | 'before_30m'
    | 'before_1h'
    | 'before_2h'
    | 'before_3h'
    | 'before_4h'
    | 'before_5h'
    | 'before_6h'
    | 'before_7h'
    | 'before_8h'
    | 'before_9h'
    | 'before_10h'
    | 'before_11h'
    | 'before_12h'
    | 'before_0_5d'
    | 'before_18h'
    | 'before_1d'
    | 'before_2d'
    | 'before_3d'
    | 'before_4d'
    | 'before_1w'
    | 'before_2w';

// ── 前端字符串 → 枚举码 映射 ─────────────────────────────────────────────────
const CODE_ALIAS_MAP: Record<string, ReminderCode> = {
    none: 'none',
    '10min': 'before_10m',
    '1hour': 'before_1h',
    '1day': 'before_1d',
    '开始前5分钟': 'before_5m',
    '开始前10分钟': 'before_10m',
    '开始前15分钟': 'before_15m',
    '开始前30分钟': 'before_30m',
    '开始前1小时': 'before_1h',
    '开始前2小时': 'before_2h',
    '开始前3小时': 'before_3h',
    '开始前4小时': 'before_4h',
    '开始前5小时': 'before_5h',
    '开始前6小时': 'before_6h',
    '开始前7小时': 'before_7h',
    '开始前8小时': 'before_8h',
    '开始前9小时': 'before_9h',
    '开始前10小时': 'before_10h',
    '开始前11小时': 'before_11h',
    '开始前12小时': 'before_12h',
    '开始前0.5天': 'before_0_5d',
    '开始前18小时': 'before_18h',
    '开始前1天': 'before_1d',
    '开始前2天': 'before_2d',
    '开始前3天': 'before_3d',
    '开始前4天': 'before_4d',
    '开始前1周': 'before_1w',
    '开始前2周': 'before_2w',
};

/**
 * 将前端传入的任意字符串规范化为内部 ReminderCode。
 * 未知值统一降级到 'none'。
 */
export function normalizeReminderCode(raw: unknown): ReminderCode {
    if (typeof raw !== 'string') return 'none';
    return CODE_ALIAS_MAP[raw] ?? 'none';
}

// ── 枚举码 → 提前量（毫秒）映射 ─────────────────────────────────────────────
const OFFSET_MS: Record<ReminderCode, number> = {
    none: 0,
    before_5m: 5 * 60_000,
    before_10m: 10 * 60_000,
    before_15m: 15 * 60_000,
    before_30m: 30 * 60_000,
    before_1h: 1 * 3600_000,
    before_2h: 2 * 3600_000,
    before_3h: 3 * 3600_000,
    before_4h: 4 * 3600_000,
    before_5h: 5 * 3600_000,
    before_6h: 6 * 3600_000,
    before_7h: 7 * 3600_000,
    before_8h: 8 * 3600_000,
    before_9h: 9 * 3600_000,
    before_10h: 10 * 3600_000,
    before_11h: 11 * 3600_000,
    before_12h: 12 * 3600_000,
    before_0_5d: 12 * 3600_000,  // 0.5 天 = 12 小时
    before_18h: 18 * 3600_000,
    before_1d: 24 * 3600_000,
    before_2d: 48 * 3600_000,
    before_3d: 72 * 3600_000,
    before_4d: 96 * 3600_000,
    before_1w: 7 * 24 * 3600_000,
    before_2w: 14 * 24 * 3600_000,
};

/**
 * 根据事件开始时间和提醒码计算实际提醒时间。
 * 不修改入参，返回新 Date 实例。
 */
export function computeRemindAt(startAt: Date, code: ReminderCode): Date {
    return new Date(startAt.getTime() - OFFSET_MS[code]);
}

// ── 节点 reminder 数据结构（最小必需字段） ───────────────────────────────────
interface ReminderSpec {
    email: string;
    title: string;
    startDate: string;
    startTime: string;
    remind?: unknown;
    notes?: string;
}

interface NodeLike {
    id: string;
    data?: {
        decorations?: { todo?: { checked?: boolean; reminder?: ReminderSpec } };
        todo?: { checked?: boolean; reminder?: ReminderSpec };
    };
}

/**
 * 提取并同步思维导图中的待办提醒到 todoReminders 表。
 *
 * 策略：
 *  1. 清除该导图全部 pending/processing 提醒（旧数据可能过时）
 *  2. 重新解析未完成节点上的 reminder，批量插入
 *
 * ⚠️ 已 sent/failed 记录不删，留作发送历史。
 */
export async function syncReminders(mindmapId: string, nodes: NodeLike[]): Promise<void> {
    // 1. 解析有效提醒
    const reminders: {
        id: string;
        mindmapId: string;
        nodeId: string;
        email: string;
        title: string;
        remindAt: Date;
        notes: string;
        status: 'pending';
    }[] = [];

    for (const node of nodes) {
        // 兼容旧字段 node.data.todo 和新字段 node.data.decorations.todo
        const todo = node.data?.decorations?.todo ?? node.data?.todo;
        if (!todo?.reminder || todo.checked) continue;

        const r = todo.reminder;
        if (!r.email || !r.title || !r.startDate || !r.startTime) continue;

        const startDate = new Date(r.startDate);
        if (Number.isNaN(startDate.getTime())) continue;

        const [hoursStr, minutesStr] = r.startTime.split(':');
        const hours = Number(hoursStr);
        const minutes = Number(minutesStr);
        if (Number.isNaN(hours) || Number.isNaN(minutes)) continue;

        startDate.setHours(hours, minutes, 0, 0);

        const code = normalizeReminderCode(r.remind);
        const remindAt = computeRemindAt(startDate, code);

        reminders.push({
            id: generateId(),
            mindmapId,
            nodeId: node.id,
            email: r.email,
            title: r.title,
            remindAt,
            notes: r.notes ?? '',
            status: 'pending',
        });
    }

    // 2. 清除旧的 pending/processing 提醒
    await db
        .delete(todoReminders)
        .where(
            and(
                eq(todoReminders.mindmapId, mindmapId),
                inArray(todoReminders.status, ['pending', 'processing']),
            ),
        );

    // 3. 批量插入新提醒
    if (reminders.length > 0) {
        await db.insert(todoReminders).values(reminders);
    }
}
