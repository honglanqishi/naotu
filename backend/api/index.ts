import { handle } from 'hono/vercel';
import app from '../src/index.js';

// 使用 Node.js 运行时（兼容 better-auth、postgres、nodemailer 等 Node.js 依赖）
export const config = { runtime: 'nodejs' };

export default handle(app);
