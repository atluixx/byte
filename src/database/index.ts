import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';

const client = createClient({
    url: `file:data.db`,
});
export const database = drizzle(client);
export type DrizzleDatabase = typeof database;

migrate(database, { migrationsFolder: './drizzle' });

export * from './schema';
export * from './repositories';
