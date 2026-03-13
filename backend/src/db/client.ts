// 根据 NODE_ENV 自动切换数据库：
//   development → SQLite via libsql（本地文件，无需 Docker，无 native 编译）
//   production  → Neon HTTP driver（专为 Serverless 设计，无 TCP 挂起问题）

import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = any;

let db: Db;

if (process.env.NODE_ENV !== 'production') {
    // ── 本地开发：SQLite via @libsql/client ──────────────────────────
    const { createClient } = await import('@libsql/client');
    const sqliteSchema = await import('./schema.sqlite.js');

    // 支持通过环境变量覆盖路径；默认存放在项目根目录
    const sqlitePath = process.env.SQLITE_PATH || '../local.db';
    const libsqlClient = createClient({ url: `file:${sqlitePath}` });

    db = drizzleLibsql(libsqlClient, {
        schema: sqliteSchema,
        logger: true,
    });

    console.log(`[db] SQLite mode — ${sqlitePath}`);
} else {
    // ── 生产环境：Neon HTTP driver（Serverless 专用，无 TCP 连接挂起）──
    const { neon } = await import('@neondatabase/serverless');
    const pgSchema = await import('./schema.js');

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is required');
    }

    const sql = neon(connectionString);
    db = drizzleNeon(sql, {
        schema: pgSchema,
        logger: false,
    });

    // 打印连接信息（隐藏密码），帮助诊断 Vercel 环境问题
    try {
        const u = new URL(connectionString);
        console.log(`[db] Neon HTTP mode — host: ${u.host}, db: ${u.pathname.slice(1)}, user: ${u.username}`);
    } catch {
        console.log('[db] Neon HTTP mode — (could not parse DATABASE_URL)');
    }
}

export { db };
