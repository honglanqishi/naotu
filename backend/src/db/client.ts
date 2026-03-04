// 根据 NODE_ENV 自动切换数据库：
//   development → SQLite via libsql（本地文件，无需 Docker，无 native 编译）
//   production  → PostgreSQL（Docker Compose 或 VPS）

import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';

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
    // ── 生产环境：PostgreSQL ──────────────────────────────────────────
    const postgres = (await import('postgres')).default;
    const pgSchema = await import('./schema.js');

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is required');
    }

    const client = postgres(connectionString, {
        max: 10,
        idle_timeout: 30,
        connect_timeout: 10,
    });

    db = drizzlePg(client, {
        schema: pgSchema,
        logger: false,
    });

    console.log('[db] PostgreSQL mode');
}

export { db };
