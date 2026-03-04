import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db/client.js';

// 根据环境选择对应的 schema 和 provider
const isProduction = process.env.NODE_ENV === 'production';

const schema = isProduction
    ? await import('../db/schema.js')
    : await import('../db/schema.sqlite.js');

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
    baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3001',
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
    trustedOrigins: [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        process.env.BETTER_AUTH_URL || 'http://localhost:3001',
    ],
});

export type Auth = typeof auth;
