import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = (
    process.env.BACKEND_INTERNAL_URL || 'http://localhost:3001'
).replace(/\/+$/, '');

const FORWARDED_HEADERS = [
    'accept',
    'accept-language',
    'content-type',
    'cookie',
    'origin',
    'referer',
    'user-agent',
] as const;

function buildForwardHeaders(req: NextRequest) {
    const headers = new Headers();
    for (const name of FORWARDED_HEADERS) {
        const value = req.headers.get(name);
        if (value) {
            headers.set(name, value);
        }
    }
    headers.set('x-forwarded-host', req.headers.get('host') || req.nextUrl.host);
    headers.set('x-forwarded-proto', req.nextUrl.protocol.replace(':', ''));
    return headers;
}

async function proxy(req: NextRequest) {
    const path = req.nextUrl.pathname; // e.g. /auth/sign-in/social
    const search = req.nextUrl.search; // e.g. ?foo=bar
    const target = `${BACKEND_URL}${path}${search}`;

    const headers = buildForwardHeaders(req);

    const body = req.method !== 'GET' && req.method !== 'HEAD'
        ? await req.arrayBuffer()
        : undefined;

    try {
        const resp = await fetch(target, {
            method: req.method,
            headers,
            body,
            redirect: 'manual', // 不自动跟随重定向，原样返回给浏览器
            signal: AbortSignal.timeout(10_000),
        });

        // 构建响应
        const respHeaders = new Headers();
        resp.headers.forEach((value, key) => {
            if (key.toLowerCase() !== 'content-length') {
                respHeaders.append(key, value);
            }
        });

        const respBody = resp.body;
        return new NextResponse(respBody, {
            status: resp.status,
            statusText: resp.statusText,
            headers: respHeaders,
        });
    } catch (error) {
        console.error(`[auth-proxy] ${req.method} ${target} — ERROR:`, error);
        return NextResponse.json(
            {
                error: 'Backend proxy error',
                target,
                message: String(error),
            },
            { status: 502 }
        );
    }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;

// Vercel 函数配置
export const runtime = 'nodejs';
export const maxDuration = 30;
