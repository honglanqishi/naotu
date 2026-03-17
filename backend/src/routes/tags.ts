import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { tags, generateId } from '../db/tables.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import type { AppEnv } from '../types/hono.js';
import { withTimeout } from '../lib/with-timeout.js';

const TAGS_READ_TIMEOUT_MS = 12_000;
const TAGS_WRITE_TIMEOUT_MS = 20_000;

const createTagSchema = z.object({
    name: z.string().min(1).max(50),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const tagsRoutes = new Hono<AppEnv>();

tagsRoutes.use('*', authMiddleware);

// GET /api/tags - 获取当前用户所有标签
tagsRoutes.get('/', async (c) => {
    const user = c.get('user');

    const userTags = await withTimeout(
        db
            .select()
            .from(tags)
            .where(eq(tags.userId, user.id)),
        TAGS_READ_TIMEOUT_MS,
        'TAGS_LIST_TIMEOUT_12S',
    );

    return c.json({ tags: userTags });
});

// POST /api/tags - 创建标签
tagsRoutes.post('/', zValidator('json', createTagSchema), async (c) => {
    const user = c.get('user');
    const { name, color } = c.req.valid('json');

    const [tag] = await withTimeout(
        db
            .insert(tags)
            .values({ id: generateId(), name, color, userId: user.id })
            .returning(),
        TAGS_WRITE_TIMEOUT_MS,
        'TAGS_CREATE_TIMEOUT_20S',
    );

    return c.json({ tag }, 201);
});

// DELETE /api/tags/:id - 删除标签
tagsRoutes.delete('/:id', async (c) => {
    const user = c.get('user');
    const tagId = c.req.param('id');

    const [deleted] = await withTimeout(
        db
            .delete(tags)
            .where(and(eq(tags.id, tagId), eq(tags.userId, user.id)))
            .returning({ id: tags.id }),
        TAGS_WRITE_TIMEOUT_MS,
        'TAGS_DELETE_TIMEOUT_20S',
    );

    if (!deleted) {
        return c.json({ error: 'Tag not found' }, 404);
    }

    return c.json({ success: true });
});
