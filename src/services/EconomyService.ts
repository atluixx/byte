import type { BotContext } from '@root/core';
import type { PlayerStatsRow } from '@root/database';

export class EconomyService {
    context!: BotContext;

    init(context: BotContext) {
        this.context = context;
    }

    async getBalance(userId: string): Promise<number> {
        const stats = await this.context.repositories.stats.getByUserId(userId);
        return stats?.coins ?? 0;
    }

    async addCoins(userId: string, amount: number): Promise<PlayerStatsRow | null> {
        return this.context.repositories.stats.addCoins(userId, amount);
    }

    async setCoins(userId: string, amount: number): Promise<PlayerStatsRow | null> {
        return this.context.repositories.stats.setCoins(userId, amount);
    }

    async hasEnough(userId: string, amount: number): Promise<boolean> {
        const balance = await this.getBalance(userId);
        return balance >= amount;
    }

    async deduct(userId: string, amount: number): Promise<boolean> {
        if (!(await this.hasEnough(userId, amount))) return false;
        const stats = await this.context.repositories.stats.getOrCreate(userId);
        await this.context.repositories.stats.setCoins(
            userId,
            Math.max(0, (stats.coins ?? 0) - amount),
        );
        return true;
    }

    async transfer(
        fromUserId: string,
        toUserId: string,
        amount: number,
    ): Promise<{ ok: boolean; reason?: string }> {
        if (amount <= 0) return { ok: false, reason: 'Amount must be positive.' };
        if (!(await this.hasEnough(fromUserId, amount)))
            return { ok: false, reason: 'Insufficient balance.' };
        const deducted = await this.deduct(fromUserId, amount);
        if (!deducted) return { ok: false, reason: 'Deduction failed.' };
        await this.addCoins(toUserId, amount);
        return { ok: true };
    }
}
