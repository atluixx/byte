import type { DrizzleDatabase } from '@root/database';
import type { EconomyService, UserService, RPGService, MessageService } from '@root/services';
import type { CacheStore, NameStore } from '@root/stores';
import type { WASocket } from '@whiskeysockets/baileys';

export type BotContext = {
    socket: WASocket | null;
    database: DrizzleDatabase;
    prefix: string;
    services: {
        users: UserService;
        rpg: RPGService;
        economy: EconomyService;
        messages: MessageService;
    };
    stores: {
        names: NameStore;
        cache: CacheStore;
    };
};
