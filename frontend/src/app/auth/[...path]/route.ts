import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = (
    process.env.BACKEND_INTERNAL_URL || 'http://localhost:3001'
).replace(/\/+$/, '');

// 不转发的请求头（由 Next.js/Vercel 自动管理）
const HOP_BY_HOP = new Set([
    'connection',
    'keep-alive',
    'transfer-encoding',
    'te',
    'trailer',
    'upgrade',
    'host',
    'content-length', // fetch 会自动设置
]);

async function proxy(req: NextRequest) {
    const path = req.nextUrl.pathname; // e.g. /auth/sign-in/social
    const search = req.nextUrl.search; // e.g. ?foo=bar
    const target = `${BACKEND_URL}${path}${search}`;

    // 构建转发头
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
            redirect: 'manual', // 不自动跟随重定向，原样返回给浏览器
        });

        // 构建响应
        const respHeaders = new Headers();
        resp.headers.forEach((value, key) => {
            // 转发所有响应头（包括 Set-Cookie）
            if (!HOP_BY_HOP.has(key.toLowerCase())) {
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

// Vercel 函数配置
export const runtime = 'nodejs';
export const maxDuration = 30;
