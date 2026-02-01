import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

const client = createClient({
    url: `file:data.db`,
});
export const database = drizzle(client);
export type DrizzleDatabase = typeof database;

export * from './schema';
