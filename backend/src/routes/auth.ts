import { Hono } from 'hono';
import { auth } from '../lib/auth.js';

// better-auth 自动处理所有 /auth/* 路由
// 包括: /auth/sign-in/social, /auth/callback/google, /auth/sign-out, /auth/get-session
export const authRoutes = new Hono();

authRoutes.on(['GET', 'POST'], '/*', (c) => {
    return auth.handler(c.req.raw);
});
