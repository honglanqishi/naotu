import { getRequestListener } from '@hono/node-server';
import app from '../src/index.js';

// 使用 Node.js 运行时（兼容 better-auth、postgres、nodemailer 等 Node.js 依赖）
// getRequestListener 将 Hono 的 Fetch API handler 适配为 Node.js (req, res) 格式
// 这是 Vercel Node.js serverless function 所期望的格式
export const config = { runtime: 'nodejs' };

export default getRequestListener(app.fetch);
