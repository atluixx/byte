import type { BotContext } from '@root/core';
import { playerStats } from '@root/database';
import { eq } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';

export type PlayerStatsRow = InferSelectModel<typeof playerStats>;

export class StatsRepository {
    context!: BotContext;

    init(context: BotContext) {
        this.context = context;
    }

    async getByUserId(userId: string): Promise<PlayerStatsRow | null> {
        const [row] = await this.context.database
            .select()
            .from(playerStats)
            .where(eq(playerStats.userId, userId))
            .limit(1);
        return row ?? null;
    }

    async getOrCreate(userId: string): Promise<PlayerStatsRow> {
        const existing = await this.getByUserId(userId);
        if (existing) return existing;
        await this.context.repositories.users.findOrCreate(userId);
        const [created] = await this.context.database
            .insert(playerStats)
            .values({ userId })
            .returning();
        if (!created) throw new Error('Failed to create player stats');
        return created;
    }

    async update(
        userId: string,
        data: Partial<Omit<PlayerStatsRow, 'userId'>>,
    ): Promise<PlayerStatsRow | null> {
        const [updated] = await this.context.database
            .update(playerStats)
            .set({ ...data, lastActive: Math.floor(Date.now() / 1000) })
            .where(eq(playerStats.userId, userId))
            .returning();
        return updated ?? null;
    }

    async addCoins(userId: string, amount: number): Promise<PlayerStatsRow | null> {
        const stats = await this.getOrCreate(userId);
        return this.update(userId, { coins: (stats.coins ?? 0) + amount });
    }

    async setCoins(userId: string, amount: number): Promise<PlayerStatsRow | null> {
        return this.update(userId, { coins: Math.max(0, amount) });
    }
}
