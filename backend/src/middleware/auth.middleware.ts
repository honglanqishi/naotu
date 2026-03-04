import { Context, Next } from 'hono';
import { auth } from '../lib/auth.js';

// better-auth session 验证中间件
export async function authMiddleware(c: Context, next: Next) {
    const session = await auth.api.getSession({
        headers: c.req.raw.headers,
    });

    if (!session) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    // 将用户信息挂载到 context
    c.set('user', session.user);
    c.set('session', session.session);

    await next();
}

