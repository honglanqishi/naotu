// Self-contained schema for backend (mirrors database/src/schema.ts)
// Kept in sync manually — do not import from ../../../database to avoid Docker path issues
import {
    pgTable,
    text,
    jsonb,
    timestamp,
    uuid,
    boolean,
    index,
    primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const accounts = pgTable('accounts', {
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
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    /** OAuth refresh token 的过期时间 */
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    /** 账号作用域 */
    scope: text('scope'),
    expiresAt: timestamp('expires_at'),
    password: text('password'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const verifications = pgTable('verifications', {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const tags = pgTable(
    'tags',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: text('name').notNull(),
        color: text('color').default('#6366f1'),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [index('tags_user_id_idx').on(table.userId)]
);

export const mindmaps = pgTable(
    'mindmaps',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        title: text('title').notNull(),
        description: text('description'),
        nodes: jsonb('nodes').notNull().default('[]'),
        edges: jsonb('edges').notNull().default('[]'),
        viewport: jsonb('viewport').default('{"x":0,"y":0,"zoom":1}'),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => [
        index('mindmaps_user_id_idx').on(table.userId),
        index('mindmaps_updated_at_idx').on(table.updatedAt),
    ]
);

export const mindmapsTags = pgTable(
    'mindmaps_tags',
    {
        mindmapId: uuid('mindmap_id')
            .notNull()
            .references(() => mindmaps.id, { onDelete: 'cascade' }),
        tagId: uuid('tag_id')
            .notNull()
            .references(() => tags.id, { onDelete: 'cascade' }),
    },
    (table) => [primaryKey({ columns: [table.mindmapId, table.tagId] })]
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
    mindmaps: many(mindmaps),
    tags: many(tags),
    sessions: many(sessions),
    accounts: many(accounts),
}));

export const mindmapsRelations = relations(mindmaps, ({ one, many }) => ({
    user: one(users, { fields: [mindmaps.userId], references: [users.id] }),
    mindmapsTags: many(mindmapsTags),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
    user: one(users, { fields: [tags.userId], references: [users.id] }),
    mindmapsTags: many(mindmapsTags),
}));

export const mindmapsTagsRelations = relations(mindmapsTags, ({ one }) => ({
    mindmap: one(mindmaps, { fields: [mindmapsTags.mindmapId], references: [mindmaps.id] }),
    tag: one(tags, { fields: [mindmapsTags.tagId], references: [tags.id] }),
}));

// Types
export type User = typeof users.$inferSelect;
export type MindMap = typeof mindmaps.$inferSelect;
export type Tag = typeof tags.$inferSelect;
