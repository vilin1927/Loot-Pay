import { logger } from '../utils/logger';
import { getBotInstance, killExistingBots, startBotPolling } from './botInstance';
import { handleStart } from './handlers/start';
import { handleHelp } from './handlers/helpHandler';
import { handleTerms } from './handlers/termsHandler';
import { handleSupport } from './handlers/supportHandler';
import { handleCallbackQuery } from './handlers/callbackQuery';
import { handleMessage } from './handlers/message';

/**
 * Start the Telegram bot
 */
export async function startBot() {
  try {
    // Clear any existing webhooks and wait for cleanup
    await killExistingBots();

    // Get bot instance
    const bot = await getBotInstance();

    // Register command handlers
    bot.onText(/\/start/, async (msg) => {
      if (!msg.chat || !msg.from) return;
      await handleStart(bot, msg.chat.id, msg.from.id, {
        username: msg.from.username,
        first_name: msg.from.first_name,
        last_name: msg.from.last_name
      });
    });

    bot.onText(/\/help/, async (msg) => {
      if (!msg.chat) return;
      await handleHelp(bot, msg.chat.id);
    });

    bot.onText(/\/terms/, async (msg) => {
      if (!msg.chat) return;
      await handleTerms(bot, msg.chat.id);
    });

    bot.onText(/\/support/, async (msg) => {
      if (!msg.chat) return;
      await handleSupport(bot, msg.chat.id);
    });

    // Register message and callback handlers
    bot.on('message', async (msg) => {
      await handleMessage(bot, msg);
    });

    bot.on('callback_query', async (query) => {
      await handleCallbackQuery(bot, query);
    });

    // Start polling
    await startBotPolling();

    logger.info('Bot initialized successfully');
  } catch (error) {
    logger.error('Failed to start bot', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error
    });
    throw error;
  }
} 