import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../utils/logger';
import { getState, setState, clearState } from '../../services/state/stateService';
import { handleQuestion1 } from '../flows/questionnaire/question1';
import { handleQuestion2 } from '../flows/questionnaire/question2';
import { handleQuestion3 } from '../flows/questionnaire/question3';
import { handleError } from '../../utils/errorHandler';
import { handleSteamUsernameRequest } from '../flows/steamUsername';
import { handleAmountSelection } from '../flows/amountSelection';
import { handlePaymentConfirmation } from '../flows/paymentConfirmation';
import { formatRussianCurrency } from '../../utils/locale';
import { findOrCreateUser } from '../../services/user/userService';
import { sendQuestion } from '../flows/questionnaire/questionnaireHandler';

const MIN_AMOUNT_USD = 5;
const MIN_AMOUNT_RUB = formatRussianCurrency(MIN_AMOUNT_USD * 80); // Using default exchange rate for MVP

// Messages
const WELCOME_MESSAGE = `Привет, это 🎮 LootPay!
Бот для быстрого и надёжного пополнения Steam кошелька
Знакомо? Было?
⏳ Всего 5 минут, и баланс в Steam пополнен…
😤 А вместо этого — долгие ожидания, скрытые наценки и тревога, что средства не дойдут.
✨ С  LootPay такого не будет ✨
⋯⋯⋯⋯⋯⋯⋯⋯
Пополняй Steam за 15 минут
с удобной оплатой, честным курсом и без риска быть обманутым ⏱️
🔹 Минимальная и прозрачная комиссия 10% — без скрытых наценок
🔹 Гарантия возврата при сбоях
🔹 Поддержка 24/7
⋯⋯⋯⋯⋯⋯⋯⋯
💳 Автоматическое зачисление от ${MIN_AMOUNT_RUB} / ${MIN_AMOUNT_USD} USD — любые РФ-карты или СБП
🔸 Как это работает?
1️⃣ Запусти бота, включи уведомления, введи Steam ID
2️⃣ Выбери сумму и оплати через СБП
3️⃣ Получи уведомление о зачислении 🎉
Пополняй без риска и обмана — вместе с 🎮 LootPay!`;

const FIRST_QUESTION = `📋 Давайте познакомимся! Ответьте на 3 быстрых вопроса, чтобы мы могли лучше вас понимать.
❓ На что чаще всего тратишь деньги в Steam?`;

const CONTINUE_MESSAGE = `
⏳ У вас есть незавершенная операция.

Хотите продолжить с того места, где остановились?`;

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

// First question buttons
const FIRST_QUESTION_BUTTONS = [
  [
    { text: '🎮 Игры — покупаю новинки и классику', callback_data: 'q1_games' }
  ],
  [
    { text: '✨ Внутриигровые штуки, кейсы, боевые пропуски', callback_data: 'q1_items' }
  ],
  [
    { text: '🧸 Другое — что-то ещё, не из этого', callback_data: 'q1_other' }
  ],
  [
    { text: '🧘 Вообще не трачу — просто сижу, не покупаю', callback_data: 'q1_none' }
  ]
];

// Continue buttons
const CONTINUE_BUTTONS = [
  [
    { text: '✅ Да, продолжить', callback_data: 'continue_flow' },
    { text: '❌ Нет, начать заново', callback_data: 'restart_flow' }
  ]
];

/**
 * Handle /start command
 */
export async function handleStart(
  bot: TelegramBot,
  chatId: number,
  userId: number,
  userInfo: {
    username?: string;
    first_name?: string;
    last_name?: string;
  }
): Promise<void> {
  try {
    // First, ensure user exists in database
    const user = await findOrCreateUser({
      id: userId,
      username: userInfo.username,
      first_name: userInfo.first_name,
      last_name: userInfo.last_name
    });

    if (!user) {
      throw new Error('Failed to create or find user');
    }

    // Clear any existing state using database user.id
    await clearState(user.id);

    // Send welcome message with main menu buttons
    await bot.sendMessage(chatId, WELCOME_MESSAGE, {
      reply_markup: {
        inline_keyboard: MAIN_MENU_BUTTONS
      }
    });

    logger.info('Start command handled', { 
      userId,
      databaseUserId: user.id 
    });
  } catch (error) {
    logger.error('Error handling start command', {
      error,
      userId
    });
    await handleError(chatId, error as Error);
  }
}

// Handle start payment button click
export async function handleStartPayment(
  bot: TelegramBot,
  chatId: number,
  userId: number
): Promise<void> {
  try {
    // Start with first question
    await sendQuestion(bot, chatId, userId, 1);

    logger.info('Started questionnaire', {
      userId
    });
  } catch (error) {
    logger.error('Error starting questionnaire', {
      error,
      userId
    });
    await handleError(chatId, error as Error);
  }
}

async function startNewQuestionnaire(
  bot: TelegramBot,
  chatId: number,
  userId: number
): Promise<void> {
  // Send welcome message
  await bot.sendMessage(chatId, WELCOME_MESSAGE);

  // Start questionnaire
  await handleQuestion1(bot, chatId, userId);
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
        await handleStart(bot, chatId, userId, {
          username: undefined,
          first_name: undefined,
          last_name: undefined
        });
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
    await handleStart(bot, chatId, userId, {
      username: undefined,
      first_name: undefined,
      last_name: undefined
    });
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