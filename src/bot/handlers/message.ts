import TelegramBot from 'node-telegram-bot-api';
import { Message } from 'node-telegram-bot-api';
import { logger } from '../../utils/logger';
import { getState } from '../../services/state/stateService';
import { handleSteamUsernameRequest } from '../flows/steamUsername';
import { handleAmountSelection } from '../flows/amountSelection';

export async function handleMessage(
  bot: TelegramBot,
  msg: Message
): Promise<void> {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const text = msg.text;

    if (!userId || !text) {
      return;
    }

    // Get user state
    const state = await getState(userId);
    if (!state) {
      return;
    }

    // Handle message based on current state
    switch (state.current_state) {
      case 'STEAM_USERNAME':
        await handleSteamUsernameRequest(bot, chatId, userId, text);
        break;

      case 'AMOUNT_SELECTION':
        await handleAmountSelection(bot, chatId, userId, text);
        break;

      default:
        logger.warn('Message received in unknown state', {
          userId,
          state: state.current_state,
          text
        });
    }

    logger.info('Message handled', {
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