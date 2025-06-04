import { Message } from 'node-telegram-bot-api';
import { getBotInstance } from '../botInstance';
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
export async function registerCommandHandlers() {
  const bot = await getBotInstance();
  
  // Start command
  bot.onText(/\/start/, async (msg: Message) => {
    if (msg.chat && msg.from) {
      await handleStart(msg);
    }
  });
  
  // Help command
  bot.onText(/\/help/, async (msg: Message) => {
    if (msg.chat) {
      await handleHelp(bot, msg.chat.id);
    }
  });

  // Terms command
  bot.onText(/\/terms/, async (msg: Message) => {
    if (msg.chat) {
      await handleTerms(bot, msg.chat.id);
    }
  });

  // Support command
  bot.onText(/\/support/, async (msg: Message) => {
    if (msg.chat) {
      await handleSupport(bot, msg.chat.id);
    }
  });
} 