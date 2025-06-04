import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger';

let botInstance: TelegramBot | null = null;

/**
 * Get singleton bot instance
 */
export const getBotInstance = async (): Promise<TelegramBot> => {
  if (!botInstance) {
    logger.info('Creating new bot instance');

    botInstance = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, {
      polling: {
        interval: 1000,
        autoStart: false
      }
    });
  }
  return botInstance;
};

/**
 * Clear any existing webhook and wait for cleanup
 */
export const killExistingBots = async () => {
  const bot = await getBotInstance();
  try {
    logger.info('Clearing any existing webhook');
    await bot.deleteWebHook();
    logger.info('Cleared webhook successfully');
    
    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    logger.warn('Failed to clear webhook', { error: error instanceof Error ? error.message : error });
  }
};

/**
 * Start bot polling if not already polling
 */
export const startBotPolling = async () => {
  const bot = await getBotInstance();
  
  if (!bot.isPolling()) {
    logger.info('Starting bot polling');
    await bot.startPolling();
    logger.info('Bot polling started successfully');
  } else {
    logger.warn('Bot is already polling');
  }
};

/**
 * Stop bot polling gracefully
 */
export const stopBotPolling = async () => {
  const bot = await getBotInstance();
  if (bot.isPolling()) {
    logger.info('Stopping bot polling');
    await bot.stopPolling();
    logger.info('Bot polling stopped');
  }
}; 