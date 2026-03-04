import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: './src/schema.sqlite.ts',
    out: './migrations-sqlite',
    dialect: 'turso',
    dbCredentials: {
        // 本地 SQLite 文件，路径相对于 database/ 目录执行时
        url: `file:${process.env.SQLITE_PATH ?? '../local.db'}`,
    },
    verbose: true,
    strict: true,
});
