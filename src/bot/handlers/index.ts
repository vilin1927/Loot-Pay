import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../utils/logger';
import { handleStart } from './start';
import { handleHelp } from './helpHandler';
import { handleTerms } from './termsHandler';
import { handleSupport } from './supportHandler';
import { handleCallbackQuery } from './callbackQuery';
import { handleMessage } from './message';
import { handleWebhook } from './webhookHandler';

export {
  handleStart,
  handleHelp,
  handleTerms,
  handleSupport,
  handleCallbackQuery,
  handleMessage,
  handleWebhook
};

// Register command handlers
export function registerCommandHandlers() {
  // Start command
  bot.onText(/\/start/, handleStartCommand);
  
  // Help command
  bot.onText(/\/help/, handleHelpCommand);

  // Terms command
  bot.onText(/\/terms/, handleTermsCommand);

  // Support command
  bot.onText(/\/support/, handleSupportCommand);
} 