import type { BotContext } from '@root/core';
import type { PlayerStatsRow } from '@root/database';

const XP_PER_LEVEL = 100;

export class RPGService {
    context!: BotContext;

    init(context: BotContext) {
        this.context = context;
    }

    async getStats(userId: string): Promise<PlayerStatsRow | null> {
        return this.context.repositories.stats.getByUserId(userId);
    }

    async getOrCreateStats(userId: string): Promise<PlayerStatsRow> {
        return this.context.repositories.stats.getOrCreate(userId);
    }

    async addXp(userId: string, amount: number): Promise<PlayerStatsRow | null> {
        const stats = await this.context.repositories.stats.getOrCreate(userId);
        const currentXp = stats.xp ?? 0;
        const level = stats.level ?? 1;
        let newXp = currentXp + amount;
        let newLevel = level;
        while (newLevel * XP_PER_LEVEL <= newXp) {
            newXp -= newLevel * XP_PER_LEVEL;
            newLevel += 1;
        }
        return this.context.repositories.stats.update(userId, { xp: newXp, level: newLevel });
    }

    async setHp(userId: string, value: number): Promise<PlayerStatsRow | null> {
        return this.context.repositories.stats.update(userId, {
            hp: Math.max(0, value),
        });
    }

    async setMp(userId: string, value: number): Promise<PlayerStatsRow | null> {
        return this.context.repositories.stats.update(userId, {
            mp: Math.max(0, value),
        });
    }

    async updateLastActive(userId: string): Promise<PlayerStatsRow | null> {
        return this.context.repositories.stats.update(userId, {});
    }
}
