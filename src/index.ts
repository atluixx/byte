import fs from 'node:fs';
import path from 'node:path';
import { pino } from 'pino';
import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import { AUTH_DIR, CACHE_FILE, NAMES_FILE, STORES_DIR } from '@root/constants';
import type { BotContext } from '@root/core';
import { database } from '@root/database';
import { EconomyService, MessageService, RPGService, UserService } from '@root/services';
import { CacheStore, NameStore } from '@root/stores';
import { gracefulShutdown, handleConnection, logger } from '@root/utils';

if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
if (!fs.existsSync(STORES_DIR)) fs.mkdirSync(STORES_DIR, { recursive: true });

const nameStore = new NameStore();
const cacheStore = new CacheStore();

if (fs.existsSync(NAMES_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(NAMES_FILE, 'utf-8'));
        nameStore.fromJSON(data);
        logger.info(`Loaded ${nameStore.size} names from storage`);
    } catch (err) {
        logger.error(err, 'Failed to load names');
    }
}

if (fs.existsSync(CACHE_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        Object.entries(data).forEach(([key, value]) => cacheStore.set(key, value));
        logger.info(`Loaded ${cacheStore.size} cache entries from storage`);
    } catch (err) {
        logger.error(err, 'Failed to load cache');
    }
}

function saveStores() {
    try {
        fs.writeFileSync(NAMES_FILE, JSON.stringify(nameStore.toJSON(), null, 2));
        const cacheData: Record<string, any> = {};
        for (const [key, value] of cacheStore.entries()) {
            cacheData[key] = value;
        }
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
        logger.info('Stores saved to disk');
    } catch (err) {
        logger.error(err, 'Failed to save stores');
    }
}

setInterval(saveStores, 60_000);

export const bot: BotContext = {
    database,
    prefix: '!',
    services: {
        economy: new EconomyService(),
        rpg: new RPGService(),
        users: new UserService(),
        messages: new MessageService(),
    },
    socket: null,
    stores: {
        cache: cacheStore,
        names: nameStore,
    },
};

if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

let socket: ReturnType<typeof makeWASocket>;
let { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

export function createSocket() {
    socket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
    });

    bot.socket = socket;

    socket.ev.on('creds.update', saveCreds);
    socket.ev.on('connection.update', handleConnection);
    socket.ev.on('messages.upsert', (ctx) => {
        bot.services.messages
            .enqueue(ctx)
            .catch((err: Error) => logger.error(err, 'Failed to process message'));
    });

    for (const [name, service] of Object.entries(bot.services)) {
        service?.init?.(bot);
        logger.info(`${name} service started`);
    }
}

process.on('SIGINT', async () => {
    saveStores();
    await gracefulShutdown(bot);
});

process.on('SIGTERM', async () => {
    saveStores();
    await gracefulShutdown(bot);
});

process.on('uncaughtException', async (err) => {
    logger.error(err, 'Uncaught exception');
    saveStores();
    await gracefulShutdown(bot);
});

process.on('unhandledRejection', async (err) => {
    logger.error(err, 'Unhandled rejection');
});

global.console.log = (...args) => logger.info(args);
global.console.warn = (...args) => logger.warn(args);
global.console.error = (...args) => logger.error(args);

createSocket();
