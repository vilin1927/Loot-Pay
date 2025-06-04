import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger';

let botInstance: TelegramBot | null = null;

/**
 * Get singleton bot instance
 */
export const getBotInstance = async (): Promise<TelegramBot> => {
  if (!botInstance) {
    logger.info('Creating new bot instance');

    const isWebhookMode = process.env.BOT_MODE === 'webhook' || process.env.NODE_ENV === 'production';
    
    if (isWebhookMode) {
      // Webhook mode for production
      botInstance = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, {
        polling: false
      });
      logger.info('Bot initialized in webhook mode');
    } else {
      // Polling mode for development
      botInstance = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, {
        polling: {
          interval: 1000,
          autoStart: false
        }
      });
      logger.info('Bot initialized in polling mode');
    }
  }
  return botInstance;
};

/**
 * Setup webhook for production
 */
export const setupWebhook = async () => {
  const bot = await getBotInstance();
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!webhookUrl) {
    throw new Error('TELEGRAM_WEBHOOK_URL is required for webhook mode');
  }

  try {
    logger.info('Setting up webhook', { url: webhookUrl });
    
    await bot.setWebHook(webhookUrl, {
      secret_token: webhookSecret,
      allowed_updates: ['message', 'callback_query']
    });

    logger.info('Webhook setup successful', { url: webhookUrl });
  } catch (error) {
    logger.error('Failed to setup webhook', { error });
    throw error;
  }
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
 * Start bot polling if not already polling (development mode only)
 */
export const startBotPolling = async () => {
  const isWebhookMode = process.env.BOT_MODE === 'webhook' || process.env.NODE_ENV === 'production';
  
  if (isWebhookMode) {
    logger.info('Production mode detected - setting up webhook instead of polling');
    await setupWebhook();
    return;
  }

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