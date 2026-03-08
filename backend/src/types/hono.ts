/**
 * Hono 路由公共类型定义
 * 统一从此文件 import，避免各路由重复定义。
 */

/** better-auth session.user 的最小结构，满足所有路由用到的字段 */
export interface AuthUser {
    id: string;
    name: string;
    email: string;
    image?: string | null;
}

/** better-auth session.session */
export interface AuthSession {
    id: string;
    userId: string;
    expiresAt: Date;
}

export type AppEnv = {
    Variables: {
        user: AuthUser;
        session: AuthSession;
    };
};

