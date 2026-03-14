import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db/client.js';

// 根据环境选择对应的 schema 和 provider
const isProduction = process.env.NODE_ENV === 'production';

const schema = isProduction
    ? await import('../db/schema.js')
    : await import('../db/schema.sqlite.js');

// 去尾斜杠：防止 better-auth origin 字符串匹配失败
const strip = (s: string) => s.replace(/\/+$/, '');
const frontendUrl = strip(process.env.FRONTEND_URL || 'http://localhost:3000');
const backendPort = process.env.BACKEND_PORT || '3001';
const frontendPort = process.env.FRONTEND_PORT || '3000';
const backendUrl = strip(process.env.BACKEND_URL || `http://localhost:${backendPort}`);
const configuredBetterAuthUrl = process.env.BETTER_AUTH_URL;

const resolvedBetterAuthUrl = strip((() => {
    if (isProduction) {
        return frontendUrl;
    }

    // 开发环境：优先使用显式 BETTER_AUTH_URL；
    // 未配置时默认走前端 origin（与 Google redirect_uri 常见配置一致）。
    return configuredBetterAuthUrl || frontendUrl;
})());

const trustedOrigins = Array.from(new Set([
    frontendUrl,
    resolvedBetterAuthUrl,
    backendUrl,
    `http://127.0.0.1:${frontendPort}`,
    `http://127.0.0.1:${backendPort}`,
]));

console.log('[auth] config:', {
    frontendUrl,
    backendUrl,
    resolvedBetterAuthUrl,
    trustedOrigins,
});

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: isProduction ? 'pg' : 'sqlite',
        schema: {
            user: schema.users,
            session: schema.sessions,
            account: schema.accounts,
            verification: schema.verifications,
        },
    }),

    // 邮箱 + 密码认证
    emailAndPassword: {
        enabled: true,
        autoSignIn: true,           // 注册后自动登录
        minPasswordLength: 6,
    },

    // Google OAuth 提供者
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
    },

    // 基础 URL
    // 生产环境优先固定为前端域名，确保 Web OAuth 的 state cookie 与 callback 域一致。
    baseURL: resolvedBetterAuthUrl,
    basePath: '/auth',

    // Session 配置
    session: {
        expiresIn: 60 * 60 * 24 * 30, // 30 天
        updateAge: 60 * 60 * 24,       // 每天更新
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60,
        },
    },

    // 安全配置
    secret: process.env.BETTER_AUTH_SECRET!,

    // 信任的域名（允许这些来源的请求携带 session cookie）
    trustedOrigins,
});

export type Auth = typeof auth;


