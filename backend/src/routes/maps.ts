import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { mindmaps, generateId } from '../db/tables.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import type { AppEnv } from '../types/hono.js';
import { syncReminders } from '../services/reminders.service.js';

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

export const mapsRoutes = new Hono<AppEnv>();

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
