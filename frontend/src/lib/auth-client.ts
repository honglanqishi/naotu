import { createAuthClient } from 'better-auth/react';

/**
 * better-auth 客户端
 *
 * baseURL 规则：
 * - 生产：NEXT_PUBLIC_API_URL = https://your-domain.com（经 Nginx 路由）
 * - 本地：NEXT_PUBLIC_API_URL 留空 → 使用相对空字符串让请求走同源（Next.js rewrites 代理到后端）
 *
 * 不能直接写 http://localhost:3001，否则跨域导致 State cookie 失效 → invalid_code
 */
export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_API_URL || '',
    basePath: '/auth',
});

export const {
    signIn,
    signUp,
    signOut,
    useSession,
    getSession,
} = authClient;
