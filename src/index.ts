import fs from 'node:fs';
import { pino } from 'pino';
import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import { AUTH_DIR, NAMES_FILE, STORES_DIR } from '@root/constants';
import type { BotContext } from '@root/core';
import { ConfigRepository, database, UserRepository, PlayerStatsRepository } from '@root/database';
import { EconomyService, MessageService, RPGService, UserService } from '@root/services';
import { NameStore } from '@root/stores';
import { gracefulShutdown, handleConnection, logger } from '@root/utils';
import { CommandService } from '@root/services';

[AUTH_DIR, STORES_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

const nameStore = new NameStore();

function loadStores() {
    if (!fs.existsSync(NAMES_FILE)) return;

    try {
        const data = JSON.parse(fs.readFileSync(NAMES_FILE, 'utf-8'));
        nameStore.fromJSON(data);
        logger.info(`Loaded ${nameStore.size} names from storage`);
    } catch (err) {
        logger.error(err, 'Failed to load names');
    }
}

function saveStores() {
    try {
        fs.writeFileSync(NAMES_FILE, JSON.stringify(nameStore.toJSON(), null, 2));
        logger.info('Name store saved to disk');
    } catch (err) {
        logger.error(err, 'Failed to save stores');
    }
}

export const bot: BotContext = {
    database,
    prefix: '!',
    services: {
        economy: new EconomyService(),
        rpg: new RPGService(),
        users: new UserService(),
        messages: new MessageService(),
        commands: new CommandService(),
    },
    repositories: {
        playerStats: new PlayerStatsRepository(),
        config: new ConfigRepository(),
        users: new UserRepository(),
    },
    socket: null,
    stores: {
        names: nameStore,
    },
};

function initializeServices() {
    for (const [name, service] of Object.entries(bot.services)) {
        if (service && typeof service.init === 'function') {
            service.init(bot);
            logger.info(`${name} service initialized`);
        }
    }

    for (const [name, repository] of Object.entries(bot.repositories)) {
        if (repository && typeof repository.init === 'function') {
            repository.init(bot);
            logger.info(`${name} repository initialized`);
        }
    }
}

export async function createSocket() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    const socket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
    });

    bot.socket = socket;

    socket.ev.on('creds.update', saveCreds);
    socket.ev.on('connection.update', handleConnection);
    socket.ev.on('messages.upsert', (ctx) => {
        bot.services.messages
            .enqueue(ctx)
            .catch((err: Error) => logger.error({ err }, 'Failed to process message'));
    });

    initializeServices();

    return socket;
}

async function handleShutdown(signal: string) {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    saveStores();
    await gracefulShutdown(bot);
    process.exit(0);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
    logger.fatal(err, 'Uncaught exception - process will exit');
    saveStores();
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    logger.error(err, 'Unhandled rejection');
});

setInterval(saveStores, 60_000);

async function bootstrap() {
    try {
        loadStores();
        await createSocket();
        logger.info('Bot started successfully');
    } catch (err) {
        logger.fatal(err, 'Failed to start bot');
        process.exit(1);
    }
}

bootstrap();
