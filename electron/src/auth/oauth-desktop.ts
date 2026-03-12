import { BrowserWindow, shell } from 'electron';
import * as http from 'node:http';
import { randomUUID } from 'node:crypto';

export interface OAuthConfig {
    backendUrl: string;
    frontendUrl: string;
}

export interface OAuthResult {
    success: boolean;
    sessionToken?: string;
    error?: string;
}

export function startDesktopOAuth(config: OAuthConfig): Promise<OAuthResult> {
    return new Promise((resolve) => {
        const nonce = randomUUID();
        let resolved = false;

        const resolveOnce = (result: OAuthResult) => {
            if (!resolved) {
                resolved = true;
                resolve(result);
            }
        };

        const loopbackServer = http.createServer(async (req, res) => {
            try {
                const requestUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
                const grant = requestUrl.searchParams.get('grant');
                const returnedNonce = requestUrl.searchParams.get('nonce');

                if (!grant || !returnedNonce) {
                    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end('<h2>❌ 登录失败：缺少授权参数</h2>');
                    resolveOnce({ success: false, error: 'Missing grant or nonce' });
                    return;
                }

                const consumeResponse = await fetch(`${config.backendUrl}/auth/desktop/consume`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nonce: returnedNonce, grant }),
                });

                if (!consumeResponse.ok) {
                    const text = await consumeResponse.text();
                    throw new Error(`Consume failed: ${consumeResponse.status} ${text}`);
                }

                const payload = await consumeResponse.json() as { sessionToken?: string };
                if (!payload.sessionToken) {
                    throw new Error('Missing sessionToken from backend');
                }

                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`
                    <html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:system-ui;background:#111;color:#fff">
                      <div style="text-align:center">
                        <h1>✅ 登录成功</h1>
                        <p>请返回 Naotu 桌面应用。</p>
                      </div>
                    </body></html>
                `);

                resolveOnce({ success: true, sessionToken: payload.sessionToken });
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`<h2>❌ 登录失败：${(error as Error).message}</h2>`);
                resolveOnce({ success: false, error: (error as Error).message });
            } finally {
                loopbackServer.close();
            }
        });

        loopbackServer.listen(0, '127.0.0.1', () => {
            void (async () => {
                try {
                    const port = (loopbackServer.address() as { port: number }).port;
                    const desktopRedirect = `http://127.0.0.1:${port}/callback`;

                    const startUrl = `${config.backendUrl}/auth/desktop/start?nonce=${encodeURIComponent(nonce)}&desktopRedirect=${encodeURIComponent(desktopRedirect)}`;
                    await shell.openExternal(startUrl);
                    console.log('[OAuth] Opened system browser for Google login (desktop/start)');
                } catch (error) {
                    loopbackServer.close();
                    resolveOnce({
                        success: false,
                        error: `初始化 Google 登录失败：${(error as Error).message}`,
                    });
                }
            })();
        });

        setTimeout(() => {
            loopbackServer.close();
            resolveOnce({ success: false, error: '登录超时（120 秒未完成）' });
        }, 120_000);
    });
}

export async function injectSessionCookie(
    win: BrowserWindow,
    backendUrl: string,
    sessionToken: string,
): Promise<void> {
    const parsedUrl = new URL(backendUrl);
    await win.webContents.session.cookies.set({
        url: backendUrl,
        name: 'better-auth.session_token',
        value: sessionToken,
        path: '/',
        httpOnly: true,
        secure: parsedUrl.protocol === 'https:',
        sameSite: 'lax',
    });
    console.log('[OAuth] Session cookie injected into BrowserWindow');
}
