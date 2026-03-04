/**
 * 环境感知的 schema 表导出
 *
 * 路由层统一从此文件导入，而不是直接引用 schema.ts（PG）或 schema.sqlite.ts（SQLite），
 * 避免在 SQLite 模式下触发 gen_random_uuid() 等 PG 专有函数。
 *
 * UUID 生成：PG 版通过 .defaultRandom() 数据库侧生成；
 *            SQLite 版 id 字段无默认值，需调用 generateId() 在代码层生成。
 */

import { randomUUID } from 'crypto';

const isProduction = process.env.NODE_ENV === 'production';

// 动态加载对应 schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _mindmaps: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _tags: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _mindmapsTags: any;

if (isProduction) {
    const schema = await import('./schema.js');
    _mindmaps = schema.mindmaps;
    _tags = schema.tags;
    _mindmapsTags = schema.mindmapsTags;
} else {
    const schema = await import('./schema.sqlite.js');
    _mindmaps = schema.mindmaps;
    _tags = schema.tags;
    _mindmapsTags = schema.mindmapsTags;
}

export const mindmaps = _mindmaps;
export const tags = _tags;
export const mindmapsTags = _mindmapsTags;

/**
 * 生成 UUID
 * - SQLite 模式：代码层用 crypto.randomUUID()，必须在 INSERT 时显式传入 id
 * - PG 模式：可依赖 defaultRandom()，但传入也无害
 */
export const generateId = (): string => randomUUID();
