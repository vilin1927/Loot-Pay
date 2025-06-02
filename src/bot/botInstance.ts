import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Get detailed process information
 */
async function getProcessInfo() {
  try {
    // Get process tree
    const { stdout: psTree } = await execAsync('ps -ef | grep node');
    
    // Get memory info
    const { stdout: memInfo } = await execAsync('ps -o pid,ppid,cmd,%mem,%cpu --sort=-%mem | grep node');
    
    return {
      processTree: psTree,
      memoryInfo: memInfo,
      processInfo: {
        pid: process.pid,
        ppid: process.ppid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        env: process.env.NODE_ENV,
        platform: process.platform,
        arch: process.arch,
        versions: process.versions
      }
    };
  } catch (error) {
    logger.error('Failed to get process info', { error });
    return null;
  }
}

let botInstance: TelegramBot | null = null;

/**
 * Get singleton bot instance
 */
export const getBotInstance = async (): Promise<TelegramBot> => {
  if (!botInstance) {
    // Get detailed process information
    const processInfo = await getProcessInfo();
    
    // Log detailed information before creating new instance
    logger.info('Creating new bot instance', {
      processInfo,
      timestamp: new Date().toISOString()
    });

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
    // Get detailed process information
    const processInfo = await getProcessInfo();
    
    // Log before attempting to clear webhook
    logger.info('Attempting to clear webhook', {
      processInfo,
      timestamp: new Date().toISOString()
    });

    // Delete webhook first (in case it was set)
    await bot.deleteWebHook();
    logger.info('Cleared any existing webhook');
    
    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    const processInfo = await getProcessInfo();
    logger.warn('Failed to clear webhook', { 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      processInfo,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Start bot polling if not already polling
 */
export const startBotPolling = async () => {
  const bot = await getBotInstance();
  
  if (!bot.isPolling()) {
    // Get detailed process information
    const processInfo = await getProcessInfo();
    
    // Log before starting polling
    logger.info('Starting bot polling', {
      processInfo,
      timestamp: new Date().toISOString()
    });

    await bot.startPolling();
    logger.info('Bot polling started');
  } else {
    const processInfo = await getProcessInfo();
    logger.warn('Bot is already polling', {
      processInfo,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Stop bot polling gracefully
 */
export const stopBotPolling = async () => {
  const bot = await getBotInstance();
  if (bot.isPolling()) {
    // Get detailed process information
    const processInfo = await getProcessInfo();
    
    // Log before stopping polling
    logger.info('Stopping bot polling', {
      processInfo,
      timestamp: new Date().toISOString()
    });

    await bot.stopPolling();
    logger.info('Bot polling stopped');
  }
}; 