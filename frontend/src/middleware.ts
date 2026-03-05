import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next.js Middleware — 边缘层路由保护
 *
 * 通过检查 better-auth session cookie 是否存在来决定是否放行。
 * 这是一个轻量级检查（不验证 token 有效性），真正的 session 验证
 * 由 better-auth 后端完成。如果 token 过期/无效，客户端 AuthGuard
 * 会捕获 401 并跳转登录页。
 */
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // better-auth 默认 cookie 名
    const sessionToken =
        request.cookies.get('better-auth.session_token') ||
        request.cookies.get('__Secure-better-auth.session_token');

    const isLoginPage = pathname.startsWith('/login');

    // 已登录用户访问 /login → 跳转 /dashboard
    if (isLoginPage && sessionToken) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // 未登录用户访问 /login → 放行（避免循环重定向）
    if (isLoginPage) {
        return NextResponse.next();
    }

    // 未登录用户访问受保护路由 → 跳转 /login
    if (!sessionToken) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

/**
 * matcher：只拦截需要保护的路由
 * 排除：静态资源、API 路由、auth 路由、登录页
 */
export const config = {
    matcher: [
        /*
         * 匹配所有路径，排除：
         * - _next/static（静态资源）
         * - _next/image（图片优化）
         * - favicon.ico, icon, apple-icon
         * - api 路由
         * - auth 路由
         * - images, icons（public 静态资源目录）
         */
        '/((?!_next/static|_next/image|favicon\\.ico|icon|apple-icon|api|auth|images|icons).*)',
    ],
};
