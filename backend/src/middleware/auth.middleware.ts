import { Context, Next } from 'hono';
import { auth } from '../lib/auth.js';
import type { AppEnv } from '../types/hono.js';
import { withTimeout, isRequestTimeoutError } from '../lib/with-timeout.js';

const AUTH_SESSION_TIMEOUT_MS = 8_000;

// better-auth session 验证中间件
export async function authMiddleware(c: Context<AppEnv>, next: Next) {
    let session: Awaited<ReturnType<typeof auth.api.getSession>>;
    try {
        session = await withTimeout(
            auth.api.getSession({
                headers: c.req.raw.headers,
            }),
            AUTH_SESSION_TIMEOUT_MS,
            'AUTH_GET_SESSION_TIMEOUT_8S',
        );
    } catch (error) {
        if (isRequestTimeoutError(error)) {
            return c.json({
                error: 'Auth session timeout',
                code: error.code,
                timeoutMs: error.timeoutMs,
            }, 504);
        }

        throw error;
    }

    if (!session) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    // 将用户信息挂载到 context
    c.set('user', session.user);
    c.set('session', session.session);

    await next();
}

