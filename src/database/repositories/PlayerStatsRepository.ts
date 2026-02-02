import type { BotContext } from '@root/core';
import { playerStats } from '@root/database';
import { eq } from 'drizzle-orm';
import { logger } from '@root/utils';

export class PlayerStatsRepository {
    context!: BotContext;

    init(context: BotContext) {
        this.context = context;
    }

    private async normalizeUserId(userId: string): Promise<string> {
        if (!userId) return 'unknown';

        let cleaned = userId.replace(/:0$/, '');

        if (cleaned.includes('@s.whatsapp.net')) {
            return cleaned;
        }

        if (cleaned.includes('@lid')) {
            try {
                const phoneNumber =
                    await this.context.socket?.signalRepository.lidMapping?.getPNForLID?.(cleaned);
                return phoneNumber ? phoneNumber.replace(/:0$/, '') : cleaned;
            } catch (err) {
                logger.error({ userId: cleaned, err }, 'Failed to resolve LID');
                return cleaned;
            }
        }

        const phoneOnly = cleaned.replace(/[^\d]/g, '');
        return `${phoneOnly}@s.whatsapp.net`;
    }

    async find() {
        try {
            return await this.context.database.select().from(playerStats);
        } catch (err) {
            logger.error({ err }, 'Failed to fetch all player stats');
            return [];
        }
    }

    async findByUserId(userId: string) {
        if (!userId) return null;

        try {
            const normalizedUserId = await this.normalizeUserId(userId);

            const [stats] = await this.context.database
                .select()
                .from(playerStats)
                .where(eq(playerStats.userId, normalizedUserId))
                .limit(1);

            return stats || null;
        } catch (err) {
            logger.error({ err, userId }, 'Failed to find player stats');
            return null;
        }
    }

    async findOrCreate(userId: string, defaults?: Partial<typeof playerStats.$inferInsert>) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        try {
            const normalizedUserId = await this.normalizeUserId(userId);
            let stats = await this.findByUserId(normalizedUserId);

            if (!stats) {
                const [created] = await this.context.database
                    .insert(playerStats)
                    .values({
                        userId: normalizedUserId,
                        level: defaults?.level ?? 1,
                        xp: defaults?.xp ?? 0,
                        hp: defaults?.hp ?? 100,
                        mp: defaults?.mp ?? 50,
                        coins: defaults?.coins ?? 0,
                        bank: defaults?.bank ?? 0,
                        bankInterest: defaults?.bankInterest ?? 15,
                        class: defaults?.class ?? 'warrior',
                        strength: defaults?.strength ?? 10,
                        defense: defaults?.defense ?? 10,
                        agility: defaults?.agility ?? 10,
                        magic: defaults?.magic ?? 10,
                        battlesWon: defaults?.battlesWon ?? 0,
                        battlesLost: defaults?.battlesLost ?? 0,
                        questsCompleted: defaults?.questsCompleted ?? 0,
                        itemsCollected: defaults?.itemsCollected ?? 0,
                        lastActive: defaults?.lastActive ?? Math.floor(Date.now() / 1000),
                        ...defaults,
                    })
                    .returning();

                stats = created!;
                logger.info({ userId: normalizedUserId }, 'Created new player stats');
            }

            return stats;
        } catch (err) {
            logger.error({ err, userId }, 'Failed to find or create player stats');
            throw err;
        }
    }

    async upsert(data: typeof playerStats.$inferInsert) {
        if (!data.userId) {
            throw new Error('User ID is required for upsert');
        }

        try {
            const normalizedUserId = await this.normalizeUserId(data.userId);

            const statsData = {
                userId: normalizedUserId,
                level: data.level ?? 1,
                xp: data.xp ?? 0,
                hp: data.hp ?? 100,
                mp: data.mp ?? 50,
                coins: data.coins ?? 0,
                bank: data.bank ?? 0,
                bankInterest: data.bankInterest ?? 15,
                class: data.class ?? 'warrior',
                strength: data.strength ?? 10,
                defense: data.defense ?? 10,
                agility: data.agility ?? 10,
                magic: data.magic ?? 10,
                battlesWon: data.battlesWon ?? 0,
                battlesLost: data.battlesLost ?? 0,
                questsCompleted: data.questsCompleted ?? 0,
                itemsCollected: data.itemsCollected ?? 0,
                lastActive: data.lastActive ?? Math.floor(Date.now() / 1000),
            };

            const [upserted] = await this.context.database
                .insert(playerStats)
                .values(statsData)
                .onConflictDoUpdate({
                    target: playerStats.userId,
                    set: {
                        level: statsData.level,
                        xp: statsData.xp,
                        hp: statsData.hp,
                        mp: statsData.mp,
                        coins: statsData.coins,
                        bank: statsData.bank,
                        bankInterest: statsData.bankInterest,
                        class: statsData.class,
                        strength: statsData.strength,
                        defense: statsData.defense,
                        agility: statsData.agility,
                        magic: statsData.magic,
                        battlesWon: statsData.battlesWon,
                        battlesLost: statsData.battlesLost,
                        questsCompleted: statsData.questsCompleted,
                        itemsCollected: statsData.itemsCollected,
                        lastActive: statsData.lastActive,
                    },
                })
                .returning();

            return upserted;
        } catch (err) {
            logger.error({ err, userId: data.userId }, 'Failed to upsert player stats');
            throw err;
        }
    }

    async update(userId: string, data: Partial<typeof playerStats.$inferInsert>) {
        if (!userId) {
            throw new Error('User ID is required for update');
        }

        try {
            const normalizedUserId = await this.normalizeUserId(userId);

            const updateData = {
                ...data,
                lastActive: data.lastActive ?? Math.floor(Date.now() / 1000),
            };

            const [updated] = await this.context.database
                .update(playerStats)
                .set(updateData)
                .where(eq(playerStats.userId, normalizedUserId))
                .returning();

            if (updated) {
                logger.info({ userId: normalizedUserId }, 'Updated player stats');
            }

            return updated || null;
        } catch (err) {
            logger.error({ err, userId }, 'Failed to update player stats');
            throw err;
        }
    }

    async delete(userId: string) {
        if (!userId) {
            throw new Error('User ID is required for delete');
        }

        try {
            const normalizedUserId = await this.normalizeUserId(userId);

            const [deleted] = await this.context.database
                .delete(playerStats)
                .where(eq(playerStats.userId, normalizedUserId))
                .returning();

            if (deleted) {
                logger.info({ userId: normalizedUserId }, 'Deleted player stats');
            }

            return deleted || null;
        } catch (err) {
            logger.error({ err, userId }, 'Failed to delete player stats');
            throw err;
        }
    }

    async exists(userId: string): Promise<boolean> {
        if (!userId) return false;

        try {
            const stats = await this.findByUserId(userId);
            return stats !== null;
        } catch (err) {
            logger.error({ err, userId }, 'Failed to check if player stats exist');
            return false;
        }
    }

    async addGold(userId: string, amount: number) {
        if (!userId || amount === 0) return null;

        try {
            const stats = await this.findByUserId(userId);
            if (!stats) {
                logger.warn({ userId }, 'Cannot add coins: player stats not found');
                return null;
            }

            const newGold = Math.max(0, (stats.coins ?? 0) + amount);
            return await this.update(userId, { coins: newGold });
        } catch (err) {
            logger.error({ err, userId, amount }, 'Failed to add coins');
            throw err;
        }
    }

    async addXp(userId: string, amount: number) {
        if (!userId || amount === 0) return null;

        try {
            const stats = await this.findByUserId(userId);
            if (!stats) {
                logger.warn({ userId }, 'Cannot add XP: player stats not found');
                return null;
            }

            const newXp = Math.max(0, (stats.xp ?? 0) + amount);
            return await this.update(userId, { xp: newXp });
        } catch (err) {
            logger.error({ err, userId, amount }, 'Failed to add XP');
            throw err;
        }
    }

    async transferGold(fromUserId: string, toUserId: string, amount: number) {
        if (!fromUserId || !toUserId || amount <= 0) {
            throw new Error('Invalid transfer parameters');
        }

        try {
            const fromStats = await this.findByUserId(fromUserId);
            const toStats = await this.findByUserId(toUserId);

            if (!fromStats || !toStats) {
                throw new Error('One or both players not found');
            }

            if ((fromStats.coins ?? 0) < amount) {
                throw new Error('Insufficient coins');
            }

            await this.addGold(fromUserId, -amount);
            await this.addGold(toUserId, amount);

            logger.info({ fromUserId, toUserId, amount }, 'Gold transferred');
            return true;
        } catch (err) {
            logger.error({ err, fromUserId, toUserId, amount }, 'Failed to transfer coins');
            throw err;
        }
    }

    async deposit(userId: string, amount: number) {
        if (!userId || amount <= 0) return null;

        try {
            const stats = await this.findByUserId(userId);
            if (!stats) return null;

            if ((stats.coins ?? 0) < amount) {
                throw new Error('Insufficient coins to deposit');
            }

            const newGold = (stats.coins ?? 0) - amount;
            const newBank = (stats.bank ?? 0) + amount;

            return await this.update(userId, { coins: newGold, bank: newBank });
        } catch (err) {
            logger.error({ err, userId, amount }, 'Failed to deposit coins');
            throw err;
        }
    }

    async withdraw(userId: string, amount: number) {
        if (!userId || amount <= 0) return null;

        try {
            const stats = await this.findByUserId(userId);
            if (!stats) return null;

            if ((stats.bank ?? 0) < amount) {
                throw new Error('Insufficient bank balance');
            }

            const newBank = (stats.bank ?? 0) - amount;
            const newGold = (stats.coins ?? 0) + amount;

            return await this.update(userId, { coins: newGold, bank: newBank });
        } catch (err) {
            logger.error({ err, userId, amount }, 'Failed to withdraw coins');
            throw err;
        }
    }

    async updateLastActive(userId: string): Promise<void> {
        try {
            await this.update(userId, {
                lastActive: Math.floor(Date.now() / 1000),
            });
        } catch (err) {
            logger.error({ err, userId }, 'Failed to update last active');
        }
    }
}
