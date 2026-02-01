import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const groupConfig = sqliteTable('group_config', {
    id: text('group_id').primaryKey(),
    prefix: text('prefix').default('!'),
    autosticker: integer('autosticker').default(0),
});
