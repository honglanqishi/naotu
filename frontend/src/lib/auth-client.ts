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
    fetchOptions: {
        // 当 better-auth fetch 遇到错误时，统一处理 401
        onError: (context) => {
            if (context.response?.status === 401) {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                }
            } else if (context.response?.status === 500 || context.response?.status === 502 || context.response?.status === 504) {
                // 后端服务不可用或是 Next.js proxy 报错 (ECONNREFUSED)
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('auth:network_error'));
                }
            }
        },
    },
});

export const {
    signIn,
    signUp,
    signOut,
    useSession,
    getSession,
} = authClient;
