import { Message } from 'node-telegram-bot-api';
import bot from '../bot';
import { logger } from '../utils/logger';
import { setState } from '../services/state/stateService';
import { payDigitalService } from '../services/paydigital/paydigitalService';
import { db } from '../services/database/connection';

// Messages
const SUCCESS_MESSAGE = `
✅ Steam аккаунт найден!

Теперь выберите сумму пополнения:
`;

const ERROR_MESSAGE = `
❌ Не удалось найти Steam аккаунт.

Пожалуйста, проверьте логин и попробуйте снова.
`;

const HELP_MESSAGE = `
ℹ️ Как найти свой Steam логин:

1. Откройте Steam
2. Нажмите на свой профиль
3. Скопируйте логин из URL
4. Вставьте его сюда

Пример: https://steamcommunity.com/id/username
`;

// Amount selection buttons
const AMOUNT_BUTTONS = [
  [
    { text: '5$', callback_data: 'amount_5' },
    { text: '10$', callback_data: 'amount_10' }
  ],
  [
    { text: '15$', callback_data: 'amount_15' },
    { text: '20$', callback_data: 'amount_20' }
  ],
  [
    { text: 'Другая сумма', callback_data: 'amount_custom' }
  ]
];

// Handle Steam username validation
export async function handleSteamUsername(
  chatId: number,
  userId: number,
  username: string
) {
  try {
    // Validate username format
    if (!username.match(/^[a-zA-Z0-9_-]{3,32}$/)) {
      await bot.sendMessage(chatId, ERROR_MESSAGE, {
        reply_markup: {
          inline_keyboard: [[
            { text: '❓ Как найти логин?', callback_data: 'steam_help' }
          ]]
        }
      });
      return;
    }

    // Check Steam username
    const transactionId = await payDigitalService.checkSteam(username);

    // Save username and transaction ID
    await db('users')
      .where({ id: userId })
      .update({
        steam_username: username,
        last_transaction_id: transactionId
      });

    // Update state
    await setState(userId, 'AMOUNT_SELECTION', {
      steam_username: username,
      transaction_id: transactionId
    });

    // Show success message with amount buttons
    await bot.sendMessage(chatId, SUCCESS_MESSAGE, {
      reply_markup: {
        inline_keyboard: AMOUNT_BUTTONS
      }
    });

    logger.info('Steam username validated', {
      userId,
      username,
      transactionId
    });

  } catch (error) {
    logger.error('Error validating Steam username', {
      error,
      userId,
      username
    });

    // Show error message with help button
    await bot.sendMessage(chatId, ERROR_MESSAGE, {
      reply_markup: {
        inline_keyboard: [[
          { text: '❓ Как найти логин?', callback_data: 'steam_help' }
        ]]
      }
    });
  }
}

// Handle help button click
export async function handleSteamHelp(chatId: number) {
  await bot.sendMessage(chatId, HELP_MESSAGE);
} 