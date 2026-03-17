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

function getProxyTimeoutMs(path: string, method: string) {
    // 写操作在 Serverless 冷启动或数据库抖动时更容易超时，给更高预算。
    if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
        return 28_000;
    }

    // GET/HEAD 默认较短，异常尽快失败。
    return 20_000;
}

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
    const path = req.nextUrl.pathname;
    const search = req.nextUrl.search;
    const target = `${BACKEND_URL}${path}${search}`;
    const timeoutMs = getProxyTimeoutMs(path, req.method);

    const headers = buildForwardHeaders(req);

    const body = req.method !== 'GET' && req.method !== 'HEAD'
        ? await req.arrayBuffer()
        : undefined;

    try {
        const resp = await fetch(target, {
            method: req.method,
            headers,
            body,
            redirect: 'manual',
            signal: AbortSignal.timeout(timeoutMs),
        });

        const respHeaders = new Headers();
        resp.headers.forEach((value, key) => {
            if (key.toLowerCase() !== 'content-length') {
                respHeaders.append(key, value);
            }
        });

        return new NextResponse(resp.body, {
            status: resp.status,
            statusText: resp.statusText,
            headers: respHeaders,
        });
    } catch (error) {
        console.error(`[api-proxy] ${req.method} ${target} — ERROR:`, error);
        const isTimeout = String(error).toLowerCase().includes('timeout');
        return NextResponse.json(
            {
                error: isTimeout ? 'Backend proxy timeout' : 'Backend proxy error',
                target,
                message: String(error),
                timeoutMs,
            },
            { status: isTimeout ? 504 : 502 }
        );
    }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;

export const runtime = 'nodejs';
export const maxDuration = 30;
