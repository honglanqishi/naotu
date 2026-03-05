import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { mindmaps, todoReminders, generateId } from '../db/tables.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

type Env = {
    Variables: {
        user: any;
        session: any;
    };
};

type ReminderCode =
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

function normalizeReminderCode(raw: unknown): ReminderCode {
    if (typeof raw !== 'string') return 'none';

    const codeMap: Record<string, ReminderCode> = {
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

    return codeMap[raw] ?? 'none';
}

function computeRemindAt(startAt: Date, code: ReminderCode): Date {
    const remindAt = new Date(startAt);

    switch (code) {
        case 'before_5m':
            remindAt.setMinutes(remindAt.getMinutes() - 5);
            break;
        case 'before_10m':
            remindAt.setMinutes(remindAt.getMinutes() - 10);
            break;
        case 'before_15m':
            remindAt.setMinutes(remindAt.getMinutes() - 15);
            break;
        case 'before_30m':
            remindAt.setMinutes(remindAt.getMinutes() - 30);
            break;
        case 'before_1h':
            remindAt.setHours(remindAt.getHours() - 1);
            break;
        case 'before_2h':
            remindAt.setHours(remindAt.getHours() - 2);
            break;
        case 'before_3h':
            remindAt.setHours(remindAt.getHours() - 3);
            break;
        case 'before_4h':
            remindAt.setHours(remindAt.getHours() - 4);
            break;
        case 'before_5h':
            remindAt.setHours(remindAt.getHours() - 5);
            break;
        case 'before_6h':
            remindAt.setHours(remindAt.getHours() - 6);
            break;
        case 'before_7h':
            remindAt.setHours(remindAt.getHours() - 7);
            break;
        case 'before_8h':
            remindAt.setHours(remindAt.getHours() - 8);
            break;
        case 'before_9h':
            remindAt.setHours(remindAt.getHours() - 9);
            break;
        case 'before_10h':
            remindAt.setHours(remindAt.getHours() - 10);
            break;
        case 'before_11h':
            remindAt.setHours(remindAt.getHours() - 11);
            break;
        case 'before_12h':
            remindAt.setHours(remindAt.getHours() - 12);
            break;
        case 'before_0_5d':
            remindAt.setHours(remindAt.getHours() - 12);
            break;
        case 'before_18h':
            remindAt.setHours(remindAt.getHours() - 18);
            break;
        case 'before_1d':
            remindAt.setDate(remindAt.getDate() - 1);
            break;
        case 'before_2d':
            remindAt.setDate(remindAt.getDate() - 2);
            break;
        case 'before_3d':
            remindAt.setDate(remindAt.getDate() - 3);
            break;
        case 'before_4d':
            remindAt.setDate(remindAt.getDate() - 4);
            break;
        case 'before_1w':
            remindAt.setDate(remindAt.getDate() - 7);
            break;
        case 'before_2w':
            remindAt.setDate(remindAt.getDate() - 14);
            break;
        case 'none':
        default:
            break;
    }

    return remindAt;
}

/**
 * 提取并同步思维导图中的待办提醒到专门的提醒表
 */
async function syncReminders(mindmapId: string, nodes: any[]) {
    // 1. 提取所有有效的提醒
    const reminders: any[] = [];
    for (const node of nodes) {
        const todo = node.data?.decorations?.todo ?? node.data?.todo;
        if (todo?.reminder && !todo.checked) {
            const r = todo.reminder;
            if (!r?.email || !r?.title || !r?.startDate || !r?.startTime) {
                continue;
            }

            // 计算提醒时间 remindAt
            const startDate = new Date(r.startDate);
            if (Number.isNaN(startDate.getTime())) {
                continue;
            }

            const [hours, minutes] = r.startTime.split(':').map(Number);
            if (Number.isNaN(hours) || Number.isNaN(minutes)) {
                continue;
            }

            startDate.setHours(hours, minutes, 0, 0);

            const reminderCode = normalizeReminderCode(r.remind);
            const remindAt = computeRemindAt(startDate, reminderCode);

            reminders.push({
                mindmapId,
                nodeId: node.id,
                email: r.email,
                title: r.title,
                remindAt,
                notes: r.notes || '',
                status: 'pending',
            });
        }
    }

    // 2. 清除该导图旧的所有 pending 提醒（避免重复或过时）
    // 注意：已发送或失败的不删除，留作记录
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
        const values = reminders.map((r) => ({
            ...r,
            id: generateId(),
        }));
        await db.insert(todoReminders).values(values);
    }
}

// Zod Schemas
const createMapSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(500).optional(),
});

const updateMapSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(500).optional(),
    nodes: z.array(z.any()).optional(),
    edges: z.array(z.any()).optional(),
    viewport: z
        .object({
            x: z.number(),
            y: z.number(),
            zoom: z.number(),
        })
        .optional(),
});

export const mapsRoutes = new Hono<Env>();

// 所有路由都需要认证
mapsRoutes.use('*', authMiddleware);

// GET /api/maps - 获取当前用户所有导图
mapsRoutes.get('/', async (c) => {
    const user = c.get('user');

    const maps = await db
        .select({
            id: mindmaps.id,
            title: mindmaps.title,
            description: mindmaps.description,
            createdAt: mindmaps.createdAt,
            updatedAt: mindmaps.updatedAt,
        })
        .from(mindmaps)
        .where(eq(mindmaps.userId, user.id))
        .orderBy(desc(mindmaps.updatedAt));

    return c.json({ maps });
});

// GET /api/maps/:id - 获取单个导图（含完整节点数据）
mapsRoutes.get('/:id', async (c) => {
    const user = c.get('user');
    const mapId = c.req.param('id');

    const [map] = await db
        .select()
        .from(mindmaps)
        .where(and(eq(mindmaps.id, mapId), eq(mindmaps.userId, user.id)))
        .limit(1);

    if (!map) {
        return c.json({ error: 'Mind map not found' }, 404);
    }

    return c.json({ map });
});

// POST /api/maps - 创建新导图
mapsRoutes.post('/', zValidator('json', createMapSchema), async (c) => {
    const user = c.get('user');
    const { title, description } = c.req.valid('json');

    // 创建导图时生成默认根节点「主题」
    const defaultRootNode = {
        id: 'root',
        type: 'mindNode',
        position: { x: 0, y: 0 },
        data: { label: '主题', isRoot: true },
    };

    const [map] = await db
        .insert(mindmaps)
        .values({
            id: generateId(),
            title,
            description,
            userId: user.id,
            nodes: [defaultRootNode],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 },
        })
        .returning();

    return c.json({ map }, 201);
});

// PUT /api/maps/:id - 更新导图（节点/边/标题均可）
mapsRoutes.put('/:id', zValidator('json', updateMapSchema), async (c) => {
    const user = c.get('user');
    const mapId = c.req.param('id');
    const updateData = c.req.valid('json');

    // 检查所有权
    const [existing] = await db
        .select({ id: mindmaps.id })
        .from(mindmaps)
        .where(and(eq(mindmaps.id, mapId), eq(mindmaps.userId, user.id)))
        .limit(1);

    if (!existing) {
        return c.json({ error: 'Mind map not found' }, 404);
    }

    const [updated] = await db
        .update(mindmaps)
        .set({
            ...updateData,
            updatedAt: new Date(),
        })
        .where(eq(mindmaps.id, mapId))
        .returning();

    // 如果更新了节点，同步提醒
    if (updateData.nodes) {
        await syncReminders(mapId, updateData.nodes);
    }

    return c.json({ map: updated });
});

// DELETE /api/maps/:id - 删除导图
mapsRoutes.delete('/:id', async (c) => {
    const user = c.get('user');
    const mapId = c.req.param('id');

    const [deleted] = await db
        .delete(mindmaps)
        .where(and(eq(mindmaps.id, mapId), eq(mindmaps.userId, user.id)))
        .returning({ id: mindmaps.id });

    if (!deleted) {
        return c.json({ error: 'Mind map not found' }, 404);
    }

    return c.json({ success: true });
});
