import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = (
    process.env.BACKEND_INTERNAL_URL || 'http://localhost:3001'
).replace(/\/+$/, '');

const HOP_BY_HOP = new Set([
    'connection',
    'keep-alive',
    'transfer-encoding',
    'te',
    'trailer',
    'upgrade',
    'host',
    'content-length',
]);

async function proxy(req: NextRequest) {
    const path = req.nextUrl.pathname;
    const search = req.nextUrl.search;
    const target = `${BACKEND_URL}${path}${search}`;

    const headers = new Headers();
    req.headers.forEach((value, key) => {
        if (!HOP_BY_HOP.has(key.toLowerCase())) {
            headers.set(key, value);
        }
    });

    const body = req.method !== 'GET' && req.method !== 'HEAD'
        ? await req.arrayBuffer()
        : undefined;

    try {
        const resp = await fetch(target, {
            method: req.method,
            headers,
            body,
            redirect: 'manual',
        });

        const respHeaders = new Headers();
        resp.headers.forEach((value, key) => {
            if (!HOP_BY_HOP.has(key.toLowerCase())) {
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
            { error: 'Backend proxy error', message: String(error) },
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
