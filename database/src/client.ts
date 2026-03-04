import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

// 连接字符串从环境变量读取
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
}

// 创建 postgres 连接
const client = postgres(connectionString, {
    // 生产环境连接池配置
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
});

// 导出 drizzle 实例
export const db = drizzle(client, {
    schema,
    logger: process.env.NODE_ENV === 'development',
});

export type Database = typeof db;
