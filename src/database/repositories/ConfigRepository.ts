import type { BotContext } from '@root/core';
import { groupConfig } from '@root/database';
import { eq } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';

type GroupConfigRow = InferSelectModel<typeof groupConfig>;

export class ConfigRepository {
    private context!: BotContext;

    init(context: BotContext) {
        this.context = context;
    }

    async getConfig(groupId: string): Promise<GroupConfigRow | undefined> {
        return await this.context.database
            .select()
            .from(groupConfig)
            .where(eq(groupConfig.id, groupId))
            .get();
    }

    async getField<K extends keyof GroupConfigRow>(
        groupId: string,
        field: K,
    ): Promise<GroupConfigRow[K] | undefined> {
        const config = await this.getConfig(groupId);
        return config?.[field];
    }

    async setField<K extends keyof Omit<GroupConfigRow, 'id'>>(
        groupId: string,
        field: K,
        value: Omit<GroupConfigRow, 'id'>[K],
    ): Promise<void> {
        await this.context.database
            .insert(groupConfig)
            .values({ id: groupId, [field]: value } as Pick<GroupConfigRow, 'id' | K>)
            .onConflictDoUpdate({
                target: groupConfig.id,
                set: { [field]: value } as Pick<GroupConfigRow, K>,
            });
    }

    async setConfig(groupId: string, values: Partial<Omit<GroupConfigRow, 'id'>>): Promise<void> {
        await this.context.database
            .insert(groupConfig)
            .values({ id: groupId, ...values })
            .onConflictDoUpdate({
                target: groupConfig.id,
                set: values,
            });
    }
}
