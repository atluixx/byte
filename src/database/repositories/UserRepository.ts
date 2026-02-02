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

            return phoneNumber ? phoneNumber.replace(/:0$/, '') : lid.replace(/:0$/, '');
        } catch (err) {
            logger.error({ lid, err }, 'Failed to resolve LID');
            return lid.replace(/:0$/, '');
        }
    }

    private async normalizeIdentifier(identifier: string): Promise<string> {
        if (!identifier) return 'unknown';

        let cleaned = identifier.replace(/:0$/, '');

        if (cleaned.includes('@s.whatsapp.net')) {
            return cleaned;
        }

        if (cleaned.includes('@lid')) {
            return await this.resolveLIDToJID(cleaned);
        }

        const phoneOnly = cleaned.replace(/[^\d]/g, '');
        return `${phoneOnly}@s.whatsapp.net`;
    }

    async find() {
        try {
            return await this.context.database.select().from(users);
        } catch (err) {
            logger.error({ err }, 'Failed to fetch all users');
            return [];
        }
    }

    async findByName(name: string) {
        if (!name) return null;

        const jid = this.context.stores?.names?.get(name);
        if (!jid) return null;

        return this.findByJID(jid);
    }

    async findByPhone(phone: string) {
        if (!phone) return null;

        const jid = await this.normalizeIdentifier(phone);
        return this.findByJID(jid);
    }

    async findByLID(lid: string) {
        if (!lid) return null;

        const jid = await this.resolveLIDToJID(lid);
        return this.findByJID(jid);
    }

    async findByJID(jid: string) {
        if (!jid) return null;

        try {
            const normalizedJID = await this.normalizeIdentifier(jid);

            const [user] = await this.context.database
                .select()
                .from(users)
                .where(eq(users.id, normalizedJID))
                .limit(1);

            return user || null;
        } catch (err) {
            logger.error({ err, jid }, 'Failed to find user by JID');
            return null;
        }
    }

    async findOrCreate(identifier: string, defaults?: Partial<typeof users.$inferInsert>) {
        if (!identifier) {
            throw new Error('Identifier is required');
        }

        try {
            const jid = await this.normalizeIdentifier(identifier);
            let user = await this.findByJID(jid);

            if (!user) {
                const name = this.context.stores?.names?.get(jid);
                const [created] = await this.context.database
                    .insert(users)
                    .values({
                        id: jid,
                        name: name || defaults?.name || 'Unknown',
                        isAdmin: defaults?.isAdmin ?? 0,
                        isOwner: defaults?.isOwner ?? 0,
                        lastActive: defaults?.lastActive ?? Math.floor(Date.now() / 1000),
                        ...defaults,
                    })
                    .returning();

                user = created!;
                logger.info({ jid, name: user.name }, 'Created new user');
            }

            return user;
        } catch (err) {
            logger.error({ err, identifier }, 'Failed to find or create user');
            throw err;
        }
    }

    async upsert(data: typeof users.$inferInsert) {
        if (!data.id) {
            throw new Error('User ID is required for upsert');
        }

        try {
            const normalizedJID = await this.normalizeIdentifier(data.id);

            const userData = {
                ...data,
                id: normalizedJID,
                lastActive: data.lastActive ?? Math.floor(Date.now() / 1000),
            };

            const [upserted] = await this.context.database
                .insert(users)
                .values(userData)
                .onConflictDoUpdate({
                    target: users.id,
                    set: {
                        name: userData.name,
                        isAdmin: userData.isAdmin ?? 0,
                        isOwner: userData.isOwner ?? 0,
                        lastActive: userData.lastActive,
                    },
                })
                .returning();

            return upserted;
        } catch (err) {
            logger.error({ err, userId: data.id }, 'Failed to upsert user');
            throw err;
        }
    }

    async update(jid: string, data: Partial<typeof users.$inferInsert>) {
        if (!jid) {
            throw new Error('JID is required for update');
        }

        try {
            const normalizedJID = await this.normalizeIdentifier(jid);

            const updateData = {
                ...data,
                lastActive: data.lastActive ?? Math.floor(Date.now() / 1000),
            };

            const [updated] = await this.context.database
                .update(users)
                .set(updateData)
                .where(eq(users.id, normalizedJID))
                .returning();

            if (updated) {
                logger.info({ jid: normalizedJID }, 'Updated user');
            }

            return updated || null;
        } catch (err) {
            logger.error({ err, jid }, 'Failed to update user');
            throw err;
        }
    }

    async delete(jid: string) {
        if (!jid) {
            throw new Error('JID is required for delete');
        }

        try {
            const normalizedJID = await this.normalizeIdentifier(jid);

            const [deleted] = await this.context.database
                .delete(users)
                .where(eq(users.id, normalizedJID))
                .returning();

            if (deleted) {
                logger.info({ jid: normalizedJID }, 'Deleted user');
            }

            return deleted || null;
        } catch (err) {
            logger.error({ err, jid }, 'Failed to delete user');
            throw err;
        }
    }

    async exists(identifier: string): Promise<boolean> {
        if (!identifier) return false;

        try {
            const user = await this.findByJID(identifier);
            return user !== null;
        } catch (err) {
            logger.error({ err, identifier }, 'Failed to check if user exists');
            return false;
        }
    }

    async updateLastActive(jid: string): Promise<void> {
        try {
            await this.update(jid, {
                lastActive: Math.floor(Date.now() / 1000),
            });
        } catch (err) {
            logger.error({ err, jid }, 'Failed to update last active');
        }
    }
}
