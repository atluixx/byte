import type { BotContext } from '@root/core/BotContext';
import { logger } from '@root/utils';

export async function gracefulShutdown(bot: BotContext) {
    logger.info('Shutting down...');

    bot.database.$client.close?.();
    bot.socket.end?.(new Error('Graceful Shutdown'));

    setTimeout(() => process.exit(0), 2000);
}
