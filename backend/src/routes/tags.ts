import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { tags, generateId } from '../db/tables.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

type Env = {
    Variables: {
        user: any;
        session: any;
    };
};

const createTagSchema = z.object({
    name: z.string().min(1).max(50),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const tagsRoutes = new Hono<Env>();

tagsRoutes.use('*', authMiddleware);

// GET /api/tags - 获取当前用户所有标签
tagsRoutes.get('/', async (c) => {
    const user = c.get('user');

    const userTags = await db
        .select()
        .from(tags)
        .where(eq(tags.userId, user.id));

    return c.json({ tags: userTags });
});

// POST /api/tags - 创建标签
tagsRoutes.post('/', zValidator('json', createTagSchema), async (c) => {
    const user = c.get('user');
    const { name, color } = c.req.valid('json');

    const [tag] = await db
        .insert(tags)
        .values({ id: generateId(), name, color, userId: user.id })
        .returning();

    return c.json({ tag }, 201);
});

// DELETE /api/tags/:id - 删除标签
tagsRoutes.delete('/:id', async (c) => {
    const user = c.get('user');
    const tagId = c.req.param('id');

    const [deleted] = await db
        .delete(tags)
        .where(and(eq(tags.id, tagId), eq(tags.userId, user.id)))
        .returning({ id: tags.id });

    if (!deleted) {
        return c.json({ error: 'Tag not found' }, 404);
    }

    return c.json({ success: true });
});
