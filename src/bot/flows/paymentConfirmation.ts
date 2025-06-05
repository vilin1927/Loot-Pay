import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../utils/logger';
import { getState, setState } from '../../services/state/stateService';
import { createPayment } from '../../services/payment/paymentService';
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

    // ✅ CHECK: Ensure we have required data including transactionId
    const { steamUsername, amountUSD, transactionId } = state.state_data;
    
    if (!steamUsername || !amountUSD || !transactionId) {
      logger.error('Missing required payment data in legacy flow', {
        userId,
        hasUsername: !!steamUsername,
        hasAmount: !!amountUSD,
        hasTransactionId: !!transactionId
      });
      throw new Error('Missing required payment data');
    }

    // ✅ USE: New centralized payment service with required transactionId
    const payment = await createPayment(userId, steamUsername, amountUSD, transactionId);

    // Update state
    await setState(userId, 'PAYMENT_PENDING', {
      ...state.state_data,
      paymentUrl: payment.paymentUrl,
      databaseTransactionId: payment.transactionId
    });

    // Send payment confirmation
    await bot.sendMessage(
      chatId,
      PAYMENT_DETAILS(steamUsername, amountUSD, payment.totalAmountRUB),
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: `✅ Оплатить СБП [${formatRussianCurrency(payment.totalAmountRUB)}]`, url: payment.paymentUrl }
            ],
            [
              { text: '🔁 Изменить логин', callback_data: 'steam_username' },
              { text: '💵 Изменить сумму', callback_data: 'amount_custom' }
            ]
          ]
        }
      }
    );

    logger.info('Legacy payment created using new service', {
      userId,
      amountUSD,
      totalAmountRUB: payment.totalAmountRUB,
      transactionId,
      databaseTransactionId: payment.transactionId
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

export async function showPaymentConfirmation(
  bot: TelegramBot,
  chatId: number,
  userId: number
) {
  try {
    const state = await getState(userId);
    if (!state?.state_data?.amountUSD) {
      throw new Error('Missing amount data');
    }

    // Check if Steam username is set
    if (!state.state_data.steamUsername) {
      logger.info('Steam username missing, redirecting to Steam username flow', { userId });
      await bot.sendMessage(chatId, '🎮 Сначала введите логин Steam аккаунта:');
      await setState(userId, 'STEAM_USERNAME', { amountUSD: state.state_data.amountUSD });
      return;
    }

    const { steamUsername, amountUSD } = state.state_data;
    const exchangeRate = 90; // TODO: Get real rate
    const totalRUB = Math.round(amountUSD * exchangeRate * 1.1); // 10% commission

    const message = `🔎 Проверь данные перед оплатой:

🧾 Услуга: Пополнение Steam 
👤 Аккаунт: ${steamUsername}
💵 Сумма: ${amountUSD} USD (≈${totalRUB}₽)
💰 Комиссия: 10% (уже включена)

❗️ Убедитесь, что данные верны!`;

    await bot.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: `✅ Оплатить ${totalRUB}₽`, callback_data: 'confirm_payment' }],
          [
            { text: '🔁 Изменить логин', callback_data: 'steam_username' },
            { text: '💵 Изменить сумму', callback_data: 'amount_custom' }
          ]
        ]
      }
    });

    logger.info('Payment confirmation shown', { userId, steamUsername, amountUSD });
  } catch (error) {
    logger.error('Error showing payment confirmation', { 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      userId 
    });
    await bot.sendMessage(chatId, '❌ Ошибка. Попробуйте снова.');
  }
} 