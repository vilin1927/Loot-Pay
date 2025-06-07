import TelegramBot from 'node-telegram-bot-api';
import { Message } from 'node-telegram-bot-api';
import { logger } from '../../utils/logger';
import { getState } from '../../services/state/stateService';
import { handleSteamUsernameRequest } from '../flows/steamUsername';
import { handleAmountSelection } from '../flows/amountSelection';
import { findOrCreateUser } from '../../services/user/userService';
import { handleAmountSelected } from './callbackQuery';
import { getSystemSetting } from '../../services/settings/settingsService';

export async function handleMessage(
  bot: TelegramBot,
  msg: Message
): Promise<void> {
  try {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;
    const text = msg.text;

    if (!telegramId || !text) {
      return;
    }

    // Skip messages that are bot commands (already handled by command handlers)
    if (text.startsWith('/')) {
      logger.debug('Skipping command message in general handler', { telegramId, text });
      return;
    }

    // Get or create user to get database user.id
    const user = await findOrCreateUser({
      id: telegramId,
      username: msg.from?.username,
      first_name: msg.from?.first_name,
      last_name: msg.from?.last_name
    });

    const userId = user.id; // Use database user.id, not telegram_id

    // Get user state
    const state = await getState(userId);
    if (!state) {
      logger.debug('No state found for user message', { telegramId, userId, text });
      return;
    }

    // Handle message based on current state
    switch (state.current_state) {
      case 'QUESTIONNAIRE_COMPLETE':
        await handleSteamUsernameRequest(bot, chatId, userId, text);
        break;

      case 'STEAM_USERNAME':
        await handleSteamUsernameRequest(bot, chatId, userId, text);
        break;

      case 'AMOUNT_SELECTION':
        await handleAmountSelection(bot, chatId, userId, text);
        break;

      case 'AWAITING_CUSTOM_AMOUNT':
        const amount = parseFloat(text);
        const minAmount = Number(await getSystemSetting('min_amount_usd')) || 1;
        const maxAmount = Number(await getSystemSetting('max_amount_usd')) || 25;
        
        if (isNaN(amount) || amount < minAmount || amount > maxAmount) {
          await bot.sendMessage(chatId, `❌ Неверная сумма. Введите число от ${minAmount} до ${maxAmount}:`);
          return;
        }
        await handleAmountSelected(bot, chatId, userId, amount);
        break;

      default:
        logger.warn('Message received in unknown state', {
          telegramId,
          userId,
          state: state.current_state,
          text
        });
    }

    logger.info('Message handled', {
      telegramId,
      userId,
      chatId,
      state: state.current_state
    });

  } catch (error) {
    logger.error('Error handling message', {
      error,
      msg
    });
    throw error;
  }
} 