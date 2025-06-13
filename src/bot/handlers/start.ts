import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../utils/logger';
import { getState, clearState } from '../../services/state/stateService';
import { handleError } from '../../utils/errorHandler';
import { handleSteamUsernameRequest } from '../flows/steamUsername';
import { handleAmountSelection } from '../flows/amountSelection';
import { handlePaymentConfirmation } from '../flows/paymentConfirmation';
import { findOrCreateUser } from '../../services/user/userService';
import { sendQuestion } from '../flows/questionnaire/questionnaireHandler';
import { Message } from 'node-telegram-bot-api';
import { getBotInstance } from '../botInstance';
import { getUserById } from '../../services/user/userService';
import { analyticsService } from '../../services/analytics/analyticsService';

// Messages
const MAIN_MENU_MESSAGE = `
🎮 Главное меню

Выберите действие:`;

// Main menu buttons
const MAIN_MENU_BUTTONS = [
  [{ text: '💰 Пополнить Steam', callback_data: 'start_payment' }],
  [{ text: '📊 История пополнений', callback_data: 'show_history' }],
  [{ text: '❓ Поддержка', callback_data: 'show_support' }],
  [{ text: '📄 О нас / Оферта / FAQ', callback_data: 'show_info' }]
];

/**
 * Handle /start command
 */
export async function handleStartCommand(msg: Message) {
  try {
    const telegramId = msg.from?.id;
    if (!telegramId) {
      logger.warn('Received /start without user ID');
      return;
    }

    // Register or get user
    const user = await findOrCreateUser({
      id: telegramId,
      username: msg.from?.username,
      first_name: msg.from?.first_name,
      last_name: msg.from?.last_name
    });

    // Track bot start event
    await analyticsService.trackBotStart(user.id, 'telegram');

    // Get bot instance
    const bot = await getBotInstance();

    // Welcome message with inline keyboard
    const welcomeMessage = `Привет, это 🎮 LootPay!

Пополняй Steam за 15 минут
с удобной оплатой, честным курсом и без риска быть обманутым ⏱️

• Комиссия 10% — без скрытых наценок 
• Гарантия возврата при сбоях 
• Поддержка 24/7

Как это работает?
⚡️Введи Steam ID 
⚡️Выбери сумму и оплати через СБП 
⚡️Получи уведомление о зачислении 🎉 
⚡️Новички получают бонус +10% к пополнению при пополнении от 5 USD! 🎁

⬇️ Нажми ниже и пополняй с 🎮 LootPay!`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '💰 Пополнить Steam', callback_data: 'fund_steam' },
          { text: '📊 История пополнений', callback_data: 'my_transactions' }
        ],
        [
          { text: '❓ Поддержка', callback_data: 'support' },
          { text: '📄 О нас / Оферта/ FAQ', callback_data: 'show_info' }
        ]
      ]
    };

    await bot.sendMessage(msg.chat.id, welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    logger.info('Start command handled', {
      telegramId,
      userId: user.id,
      username: user.username
    });

  } catch (error) {
    logger.error('Error handling start command', {
      error,
      telegramId: msg.from?.id
    });
    
    // Get bot instance for error message
    const bot = await getBotInstance();
    
    // Send error message to user
    await bot.sendMessage(
      msg.chat.id,
      '😔 Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
    );
  }
}

// Export alias for compatibility with other files
export const handleStart = handleStartCommand;

// Handle start payment button click
export async function handleStartPayment(
  bot: TelegramBot,
  chatId: number,
  userId: number
): Promise<void> {
  try {
    // Check if user completed questionnaire
    const user = await getUserById(userId);
    
    if (user && user.questionnaire_completed) {
      // Returning user - skip to Steam username
      logger.info('Returning user detected, skipping questionnaire', { userId });
      await handleSteamUsernameRequest(bot, chatId, userId);
    } else {
      // New user - start questionnaire
      logger.info('New user detected, starting questionnaire', { userId });
      await sendQuestion(bot, chatId, userId, 1);
    }
  } catch (error) {
    logger.error('Error starting payment flow', { error, userId });
    await handleError(chatId, error as Error);
  }
}

/**
 * Handle continue flow callback
 */
export async function handleContinueFlow(
  bot: TelegramBot,
  chatId: number,
  userId: number
) {
  try {
    // Get state
    const state = await getState(userId);
    if (!state) {
      throw new Error('No state to continue');
    }

    // Restore previous step
    switch (state.current_state) {
      case 'STEAM_USERNAME':
        await handleSteamUsernameRequest(bot, chatId, userId);
        break;

      case 'AMOUNT_SELECTION':
        await handleAmountSelection(bot, chatId, userId);
        break;

      case 'AMOUNT_SELECTED':
        await handlePaymentConfirmation(bot, chatId, userId);
        break;

      default:
        // Clear invalid state
        await clearState(userId);
        await handleStartCommand({ chat: { id: chatId }, from: { id: userId } } as Message);
    }

    logger.info('Flow continued', {
      userId,
      state: state.current_state
    });

  } catch (error) {
    logger.error('Error continuing flow', {
      error,
      userId
    });

    // Clear state and show main menu
    await clearState(userId);
    await handleStartCommand({ chat: { id: chatId }, from: { id: userId } } as Message);
  }
}

/**
 * Handle restart flow callback
 */
export async function handleRestartFlow(
  bot: TelegramBot,
  chatId: number,
  userId: number
) {
  try {
    // Clear state
    await clearState(userId);

    // Show main menu
    await bot.sendMessage(
      chatId,
      MAIN_MENU_MESSAGE,
      {
        reply_markup: {
          inline_keyboard: MAIN_MENU_BUTTONS
        }
      }
    );

    logger.info('Flow restarted', { userId });

  } catch (error) {
    logger.error('Error restarting flow', {
      error,
      userId
    });

    // Send error message
    await bot.sendMessage(
      chatId,
      '😔 Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
    );
  }
}

/**
 * Handle invalid state by clearing it and showing main menu
 */
export async function handleInvalidState(msg: Message): Promise<void> {
  try {
    const telegramId = msg.from?.id;
    if (!telegramId) {
      logger.warn('Received invalid state without user ID');
      return;
    }

    // Get or create user to get database user.id
    const user = await findOrCreateUser({
      id: telegramId,
      username: msg.from?.username,
      first_name: msg.from?.first_name,
      last_name: msg.from?.last_name
    });

    // Clear invalid state using database user.id
    await clearState(user.id);
    await handleStartCommand(msg);
  } catch (error) {
    logger.error('Error handling invalid state', {
      error,
      telegramId: msg.from?.id
    });
    
    // Get bot instance for error message
    const bot = await getBotInstance();
    
    // Send error message to user
    await bot.sendMessage(
      msg.chat.id,
      '😔 Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
    );
  }
}

/**
 * Handle expired state by clearing it and showing main menu
 */
export async function handleExpiredState(msg: Message): Promise<void> {
  try {
    const telegramId = msg.from?.id;
    if (!telegramId) {
      logger.warn('Received expired state without user ID');
      return;
    }

    // Get or create user to get database user.id
    const user = await findOrCreateUser({
      id: telegramId,
      username: msg.from?.username,
      first_name: msg.from?.first_name,
      last_name: msg.from?.last_name
    });

    // Clear state and show main menu using database user.id
    await clearState(user.id);
    await handleStartCommand(msg);
  } catch (error) {
    logger.error('Error handling expired state', {
      error,
      telegramId: msg.from?.id
    });
    
    // Get bot instance for error message
    const bot = await getBotInstance();
    
    // Send error message to user
    await bot.sendMessage(
      msg.chat.id,
      '😔 Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
    );
  }
} 