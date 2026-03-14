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

const socialSignInSchema = z.object({
    provider: z.string().min(1),
    callbackURL: z.string().optional(),
    errorCallbackURL: z.string().optional(),
    newUserCallbackURL: z.string().optional(),
    disableRedirect: z.boolean().optional(),
    loginHint: z.string().optional(),
    requestSignUp: z.boolean().optional(),
    scopes: z.array(z.string()).optional(),
    additionalData: z.record(z.string(), z.unknown()).optional(),
});

function getSocialSignInHeaders(headers: Headers) {
    const forwarded = new Headers();
    const origin = headers.get('origin');
    const referer = headers.get('referer');
    const cookie = headers.get('cookie');
    const userAgent = headers.get('user-agent');
    const host = headers.get('host');
    const forwardedHost = headers.get('x-forwarded-host');
    const forwardedProto = headers.get('x-forwarded-proto');

    if (origin) forwarded.set('origin', origin);
    if (referer) forwarded.set('referer', referer);
    if (cookie) forwarded.set('cookie', cookie);
    if (userAgent) forwarded.set('user-agent', userAgent);
    if (host) forwarded.set('host', host);
    if (forwardedHost) forwarded.set('x-forwarded-host', forwardedHost);
    if (forwardedProto) forwarded.set('x-forwarded-proto', forwardedProto);

    return forwarded;
}

function resolveRequestOrigin(requestUrl: string, headers: Headers) {
    const forwardedHost = headers.get('x-forwarded-host');
    const forwardedProto = headers.get('x-forwarded-proto');

    if (forwardedHost && forwardedProto) {
        return `${forwardedProto}://${forwardedHost}`;
    }

    return new URL(requestUrl).origin;
}

async function runSocialSignInViaHandler(requestUrl: string, sourceHeaders: Headers, payload: z.infer<typeof socialSignInSchema>) {
    const origin = resolveRequestOrigin(requestUrl, sourceHeaders);
    const headers = getSocialSignInHeaders(sourceHeaders);
    headers.set('content-type', 'application/json');

    const syntheticRequest = new Request(`${origin}/auth/sign-in/social`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });

    return auth.handler(syntheticRequest);
}

async function runOAuthCallbackViaHandler(requestUrl: string, sourceHeaders: Headers, pathWithSearch: string) {
    const origin = resolveRequestOrigin(requestUrl, sourceHeaders);
    const headers = getSocialSignInHeaders(sourceHeaders);
    const syntheticRequest = new Request(`${origin}${pathWithSearch}`, {
        method: 'GET',
        headers,
    });
    return auth.handler(syntheticRequest);
}

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

authRoutes.get('/sign-in/social-direct', async (c) => {
    const start = Date.now();
    const provider = c.req.query('provider') ?? '';
    const callbackURL = c.req.query('callbackURL') ?? undefined;
    const errorCallbackURL = c.req.query('errorCallbackURL') ?? undefined;
    const newUserCallbackURL = c.req.query('newUserCallbackURL') ?? undefined;

    const parsed = socialSignInSchema.safeParse({
        provider,
        callbackURL,
        errorCallbackURL,
        newUserCallbackURL,
    });
    if (!parsed.success) {
        return c.json({ error: 'Invalid query', issues: parsed.error.flatten() }, 400);
    }

    try {
        const result = await Promise.race([
            runSocialSignInViaHandler(c.req.url, c.req.raw.headers, parsed.data),
            new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('SIGN_IN_SOCIAL_DIRECT_TIMEOUT_12S')), 12_000);
            }),
        ]);
        console.log(`[auth] GET /auth/sign-in/social-direct — done in ${Date.now() - start}ms`);
        return result;
    } catch (error) {
        console.error(`[auth] GET /auth/sign-in/social-direct — ERROR after ${Date.now() - start}ms:`, error);
        return c.json({ error: 'Social sign-in direct failed', message: String(error) }, 500);
    }
});

authRoutes.get('/callback/google-direct', async (c) => {
    const start = Date.now();
    try {
        const result = await Promise.race([
            runOAuthCallbackViaHandler(
                c.req.url,
                c.req.raw.headers,
                `/auth/callback/google${c.req.url.includes('?') ? c.req.url.slice(c.req.url.indexOf('?')) : ''}`,
            ),
            new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('GOOGLE_CALLBACK_DIRECT_TIMEOUT_12S')), 12_000);
            }),
        ]);
        console.log(`[auth] GET /auth/callback/google-direct — done in ${Date.now() - start}ms`);
        return result;
    } catch (error) {
        console.error(`[auth] GET /auth/callback/google-direct — ERROR after ${Date.now() - start}ms:`, error);
        return c.json({ error: 'Google callback direct failed', message: String(error) }, 500);
    }
});

authRoutes.post('/sign-in/social', async (c) => {
    const start = Date.now();
    const body = await c.req.json().catch(() => null);
    const parsed = socialSignInSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: 'Invalid payload', issues: parsed.error.flatten() }, 400);
    }

    try {
        const result = await Promise.race([
            runSocialSignInViaHandler(c.req.url, c.req.raw.headers, parsed.data),
            new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('SIGN_IN_SOCIAL_TIMEOUT_12S')), 12_000);
            }),
        ]);
        console.log(`[auth] POST /auth/sign-in/social — api.done in ${Date.now() - start}ms`);
        return result;
    } catch (error) {
        console.error(`[auth] POST /auth/sign-in/social — api.ERROR after ${Date.now() - start}ms:`, error);
        return c.json({ error: 'Social sign-in failed', message: String(error) }, 500);
    }
});

authRoutes.on(['GET', 'POST'], '/*', async (c) => {
    const start = Date.now();
    const method = c.req.method;
    const path = c.req.path;
    console.log(`[auth] ${method} ${path} — start`);
    try {
        const response = await auth.handler(c.req.raw);
        console.log(`[auth] ${method} ${path} — done in ${Date.now() - start}ms, status=${response.status}`);
        return response;
    } catch (error) {
        console.error(`[auth] ${method} ${path} — ERROR after ${Date.now() - start}ms:`, error);
        return c.json({ error: 'Auth handler error', message: String(error) }, 500);
    }
});
