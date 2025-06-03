import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../utils/logger';
import { getState, setState } from '../../services/state/stateService';
import { payDigitalService } from '../../services/paydigital/paydigitalService';
import { handleSteamUsernameRequest } from './steamUsername';
import { handleAmountSelection } from './amountSelection';
import { formatRussianCurrency } from '../../utils/locale';

const PAYMENT_ERROR = `🚫 Произошла ошибка при создании оплаты.

Пожалуйста, попробуйте ещё раз чуть позже. 
Если проблема повторяется — обратитесь в поддержку.`;

// Payment confirmation message
const PAYMENT_DETAILS = (username: string, amountUSD: number, amountRUB: number) => `🔎 Проверь данные перед оплатой:

🧾 Услуга: Пополнение Steam 
👤 Аккаунт: ${username}
💵 Сумма: ${amountUSD} USD (≈${formatRussianCurrency(amountRUB)}) — **комиссия 10% уже включена**

❗️Пожалуйста, убедитесь, что логин и сумма указаны верно. 
В случае ошибки средства могут уйти другому пользователю.
Если всё правильно — выберите способ оплаты ниже 👇`;

// Handle payment confirmation
export async function handlePaymentConfirmation(
  bot: TelegramBot,
  chatId: number,
  userId: number
): Promise<void> {
  try {
    // Get state
    const state = await getState(userId);
    if (!state || state.current_state !== 'AMOUNT_SELECTED') {
      throw new Error('Invalid state for payment confirmation');
    }

    const { steamUsername, amountUSD, totalAmountRUB } = state.state_data;

    // Create payment
    const paymentUrl = await payDigitalService.createSteamPayment(
      steamUsername,
      amountUSD,
      totalAmountRUB,
      `order_${Date.now()}`
    );

    // Update state
    await setState(userId, 'PAYMENT_PENDING', {
      ...state.state_data,
      paymentUrl
    });

    // Send payment confirmation
    await bot.sendMessage(
      chatId,
      PAYMENT_DETAILS(steamUsername, amountUSD, totalAmountRUB),
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: `✅ Оплатить СБП [${formatRussianCurrency(totalAmountRUB)}]`, url: paymentUrl }
            ],
            [
              { text: '🔁 Изменить логин', callback_data: 'steam_username' },
              { text: '💵 Изменить сумму', callback_data: 'amount_custom' }
            ]
          ]
        }
      }
    );

    logger.info('Payment created', {
      userId,
      amountUSD,
      totalAmountRUB
    });

  } catch (error) {
    logger.error('Error handling payment confirmation', {
      error,
      userId
    });

    // Send error message with buttons
    await bot.sendMessage(chatId, PAYMENT_ERROR, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔁 Изменить логин', callback_data: 'steam_username' },
            { text: '💵 Изменить сумму', callback_data: 'amount_custom' }
          ],
          [
            { text: '❗️Поддержка', callback_data: 'support' }
          ]
        ]
      }
    });
    throw error;
  }
}

// Handle change Steam username
export async function handleChangeSteam(
  bot: TelegramBot,
  chatId: number,
  userId: number
) {
  await handleSteamUsernameRequest(bot, chatId, userId);
}

// Handle change amount
export async function handleChangeAmount(
  bot: TelegramBot,
  chatId: number,
  userId: number
) {
  await handleAmountSelection(bot, chatId, userId);
} 