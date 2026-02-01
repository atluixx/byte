// src/database/schema/users.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    isAdmin: integer('is_admin').default(0),
    isOwner: integer('is_owner').default(0),
    lastActive: integer('last_active').default(Math.floor(Date.now() / 1000)),
});
