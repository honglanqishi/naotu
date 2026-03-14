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
    const path = req.nextUrl.pathname;
    const search = req.nextUrl.search;
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
            redirect: 'manual',
            signal: AbortSignal.timeout(10_000),
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

export const runtime = 'nodejs';
export const maxDuration = 30;
