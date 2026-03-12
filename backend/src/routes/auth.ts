import { Hono } from 'hono';
import { auth } from '../lib/auth.js';
import { z } from 'zod';
import {
    createDesktopNonce,
    consumeDesktopGrant,
    hasValidDesktopNonce,
    issueDesktopGrant,
} from '../services/desktop-auth.service.js';

// better-auth 自动处理所有 /auth/* 路由
// 包括: /auth/sign-in/social, /auth/callback/google, /auth/sign-out, /auth/get-session
export const authRoutes = new Hono();

function extractSessionTokenFromCookie(cookieHeader: string): string | null {
    const parts = cookieHeader.split(';').map((part) => part.trim());

    for (const part of parts) {
        if (part.startsWith('better-auth.session_token=')) {
            return decodeURIComponent(part.slice('better-auth.session_token='.length));
        }
        if (part.startsWith('__Secure-better-auth.session_token=')) {
            return decodeURIComponent(part.slice('__Secure-better-auth.session_token='.length));
        }
    }

    return null;
}

const desktopInitSchema = z.object({
    nonce: z.string().min(16).max(128),
});

const desktopConsumeSchema = z.object({
    nonce: z.string().min(16).max(128),
    grant: z.string().min(16).max(128),
});

authRoutes.post('/desktop/init', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = desktopInitSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: 'Invalid payload' }, 400);
    }

    createDesktopNonce(parsed.data.nonce);
    return c.json({ success: true });
});

authRoutes.get('/desktop/start', async (c) => {
    const nonce = c.req.query('nonce') ?? '';
    const desktopRedirect = c.req.query('desktopRedirect') ?? '';

    if (!nonce || !desktopRedirect) {
        return c.text('Missing nonce or desktopRedirect', 400);
    }

    let parsedRedirect: URL;
    try {
        parsedRedirect = new URL(desktopRedirect);
    } catch {
        return c.text('Invalid desktopRedirect', 400);
    }

    if (parsedRedirect.protocol !== 'http:' || parsedRedirect.hostname !== '127.0.0.1') {
        return c.text('desktopRedirect must be loopback http://127.0.0.1', 400);
    }

    // 由浏览器链路创建 nonce，保证后续 grant 与同一轮登录绑定
    createDesktopNonce(nonce);

    const bridgeCallback = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/desktop-auth-bridge?desktopRedirect=${encodeURIComponent(desktopRedirect)}&nonce=${encodeURIComponent(nonce)}`;

        const html = `<!doctype html>
<html>
    <head><meta charset="utf-8" /><title>Naotu Desktop Auth</title></head>
    <body>
        <p>正在跳转到 Google 登录...</p>
        <script>
            (async () => {
                try {
                    const resp = await fetch('/auth/sign-in/social', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            provider: 'google',
                            callbackURL: ${JSON.stringify(bridgeCallback)},
                        }),
                    });

                    if (!resp.ok) {
                        const text = await resp.text();
                        throw new Error('sign-in/social failed: ' + resp.status + ' ' + text);
                    }

                    const data = await resp.json();
                    if (!data.url) {
                        throw new Error('Missing redirect url from sign-in/social');
                    }

                    window.location.href = data.url;
                } catch (err) {
                    document.body.innerHTML = '<h2>❌ 登录初始化失败</h2><pre>' + String(err) + '</pre>';
                }
            })();
        </script>
    </body>
</html>`;

    return c.html(html);
});

authRoutes.get('/desktop/grant', async (c) => {
    const nonce = c.req.query('nonce') ?? '';
    if (!nonce || !hasValidDesktopNonce(nonce)) {
        return c.json({ error: 'Invalid or expired nonce' }, 400);
    }

    const session = await auth.api.getSession({
        headers: c.req.raw.headers,
    });

    if (!session || !session.user?.id) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const cookieHeader = c.req.header('cookie') ?? '';
    const sessionTokenFromCookie = extractSessionTokenFromCookie(cookieHeader);
    if (!sessionTokenFromCookie) {
        return c.json({ error: 'Session cookie token not found' }, 400);
    }

    const grant = issueDesktopGrant({
        nonce,
        userId: session.user.id,
        sessionToken: sessionTokenFromCookie,
    });

    return c.json({ grant });
});

authRoutes.post('/desktop/consume', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = desktopConsumeSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: 'Invalid payload' }, 400);
    }

    try {
        const result = consumeDesktopGrant(parsed.data);
        return c.json({ sessionToken: result.sessionToken });
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});

authRoutes.on(['GET', 'POST'], '/*', (c) => {
    return auth.handler(c.req.raw);
});
