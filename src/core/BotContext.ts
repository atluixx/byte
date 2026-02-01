import type { ConfigRepository, DrizzleDatabase, UserRepository } from '@root/database';
import type { EconomyService, UserService, RPGService, MessageService } from '@root/services';
import type { CommandService } from '@root/services/CommandService';
import type { NameStore } from '@root/stores';
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
        commands: CommandService;
    };
    stores: {
        names: NameStore;
    };
    repositories: {
        users: UserRepository;
        config: ConfigRepository;
    };
};
