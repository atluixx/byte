import type { BotContext } from '@root/core';
import { users } from '@root/database';
import { eq } from 'drizzle-orm';
import { logger } from '@root/utils';

export class UserRepository {
    context!: BotContext;

    init(context: BotContext) {
        this.context = context;
    }

    private async resolveLIDToJID(lid: string): Promise<string> {
        try {
            const phoneNumber =
                await this.context.socket?.signalRepository.lidMapping?.getPNForLID?.(lid);
            return phoneNumber || lid;
        } catch (err) {
            logger.error({ lid, err }, 'Failed to resolve LID');
            return lid;
        }
    }

    private async normalizeIdentifier(identifier: string): Promise<string> {
        if (!identifier) return 'unknown';

        if (identifier.includes('@s.whatsapp.net')) {
            return identifier;
        }

        if (identifier.includes('@lid')) {
            return await this.resolveLIDToJID(identifier);
        }

        const cleaned = identifier.replace(/[^\d]/g, '');
        return `${cleaned}@s.whatsapp.net`;
    }

    find() {
        return this.context.database.select().from(users);
    }

    async findByName(name: string) {
        const jid = this.context.stores.names.get(name);
        if (!jid) return null;

        return this.findByJID(jid);
    }

    async findByPhone(phone: string) {
        const jid = await this.normalizeIdentifier(phone);
        return this.findByJID(jid);
    }

    async findByLID(lid: string) {
        const jid = await this.resolveLIDToJID(lid);
        return this.findByJID(jid);
    }

    async findByJID(jid: string) {
        const normalizedJID = await this.normalizeIdentifier(jid);

        const [user] = await this.context.database
            .select()
            .from(users)
            .where(eq(users.id, normalizedJID))
            .limit(1);

        return user || null;
    }

    async findOrCreate(identifier: string, defaults?: Partial<typeof users.$inferInsert>) {
        const jid = await this.normalizeIdentifier(identifier);

        let user = (await this.findByJID(jid)) || undefined;

        if (!user) {
            const name = this.context.stores.names.get(jid);

            const [created] = await this.context.database
                .insert(users)
                .values({
                    id: jid,
                    name: name || defaults?.name || 'Unknown',
                    ...defaults,
                })
                .returning();

            user = created;
        }

        return user;
    }

    async update(jid: string, data: Partial<typeof users.$inferInsert>) {
        const normalizedJID = await this.normalizeIdentifier(jid);

        const [updated] = await this.context.database
            .update(users)
            .set(data)
            .where(eq(users.id, normalizedJID))
            .returning();

        return updated || null;
    }

    async delete(jid: string) {
        const normalizedJID = await this.normalizeIdentifier(jid);

        const [deleted] = await this.context.database
            .delete(users)
            .where(eq(users.id, normalizedJID))
            .returning();

        return deleted || null;
    }

    async exists(identifier: string): Promise<boolean> {
        const user = await this.findByJID(identifier);
        return user !== null;
    }
}
