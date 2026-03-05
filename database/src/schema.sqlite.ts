// SQLite schema — 本地开发使用，镜像 schema.ts（PostgreSQL 版）
// 字段映射：
//   pgTable      → sqliteTable
//   jsonb        → text({ mode: 'json' })
//   uuid().defaultRandom() → text()，UUID 在代码层生成
//   boolean()    → integer({ mode: 'boolean' })
//   timestamp()  → integer({ mode: 'timestamp' })
import {
    sqliteTable,
    text,
    integer,
    index,
    primaryKey,
} from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// =============================================
// Users 表 (better-auth 管理)
// =============================================
export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
    image: text('image'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const sessions = sqliteTable('sessions', {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const accounts = sqliteTable('accounts', {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    /** better-auth v1.2+ 新增：OAuth access token 的过期时间 */
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
    /** OAuth refresh token 的过期时间 */
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
    /** 账号作用域 */
    scope: text('scope'),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const verifications = sqliteTable('verifications', {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// =============================================
// Tags 标签表
// =============================================
export const tags = sqliteTable(
    'tags',
    {
        // SQLite 无原生 uuid 类型，用 text 存储，代码层生成 UUID
        id: text('id').primaryKey(),
        name: text('name').notNull(),
        color: text('color').default('#6366f1'),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    },
    (table) => [index('tags_user_id_idx').on(table.userId)]
);

// =============================================
// MindMaps 思维导图表
// =============================================
export const mindmaps = sqliteTable(
    'mindmaps',
    {
        id: text('id').primaryKey(),
        title: text('title').notNull(),
        description: text('description'),
        // text + mode:'json' 等同于 jsonb，Drizzle 自动序列化/反序列化
        nodes: text('nodes', { mode: 'json' }).notNull().default('[]'),
        edges: text('edges', { mode: 'json' }).notNull().default('[]'),
        viewport: text('viewport', { mode: 'json' }).default('{"x":0,"y":0,"zoom":1}'),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
        updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    },
    (table) => [
        index('mindmaps_user_id_idx').on(table.userId),
        index('mindmaps_updated_at_idx').on(table.updatedAt),
    ]
);

// =============================================
// MindMap ↔ Tags 多对多关联表
// =============================================
export const mindmapsTags = sqliteTable(
    'mindmaps_tags',
    {
        mindmapId: text('mindmap_id')
            .notNull()
            .references(() => mindmaps.id, { onDelete: 'cascade' }),
        tagId: text('tag_id')
            .notNull()
            .references(() => tags.id, { onDelete: 'cascade' }),
    },
    (table) => [primaryKey({ columns: [table.mindmapId, table.tagId] })]
);

// =============================================
// TodoReminders 待办提醒表
// =============================================
export const todoReminders = sqliteTable(
    'todo_reminders',
    {
        id: text('id').primaryKey(),
        mindmapId: text('mindmap_id')
            .notNull()
            .references(() => mindmaps.id, { onDelete: 'cascade' }),
        nodeId: text('node_id').notNull(),
        email: text('email').notNull(),
        title: text('title').notNull(),
        remindAt: integer('remind_at', { mode: 'timestamp' }).notNull(),
        status: text('status', { enum: ['pending', 'processing', 'sent', 'failed'] })
            .notNull()
            .default('pending'),
        notes: text('notes'),
        createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
        updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    },
    (table) => [
        index('todo_reminders_remind_at_idx').on(table.remindAt),
        index('todo_reminders_status_idx').on(table.status),
    ]
);

// =============================================
// Relations（用于 Drizzle 关联查询）
// =============================================
export const usersRelations = relations(users, ({ many }) => ({
    mindmaps: many(mindmaps),
    tags: many(tags),
    sessions: many(sessions),
    accounts: many(accounts),
}));

export const mindmapsRelations = relations(mindmaps, ({ one, many }) => ({
    user: one(users, { fields: [mindmaps.userId], references: [users.id] }),
    mindmapsTags: many(mindmapsTags),
    todoReminders: many(todoReminders),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
    user: one(users, { fields: [tags.userId], references: [users.id] }),
    mindmapsTags: many(mindmapsTags),
}));

export const mindmapsTagsRelations = relations(mindmapsTags, ({ one }) => ({
    mindmap: one(mindmaps, { fields: [mindmapsTags.mindmapId], references: [mindmaps.id] }),
    tag: one(tags, { fields: [mindmapsTags.tagId], references: [tags.id] }),
}));

export const todoRemindersRelations = relations(todoReminders, ({ one }) => ({
    mindmap: one(mindmaps, { fields: [todoReminders.mindmapId], references: [mindmaps.id] }),
}));

// Types
export type User = typeof users.$inferSelect;
export type MindMap = typeof mindmaps.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type TodoReminder = typeof todoReminders.$inferSelect;
export type NewTodoReminder = typeof todoReminders.$inferInsert;
