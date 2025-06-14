import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../utils/logger';
import { getState, setState } from '../../services/state/stateService';
import { createPayment } from '../../services/payment/paymentService';
import { handleSteamUsernameRequest } from './steamUsername';
import { handleAmountSelection } from './amountSelection';
import { formatRussianCurrency } from '../../utils/locale';
import { getSystemSetting } from '../../services/settings/settingsService';
import { exchangeRateService } from '../../services/exchangeRate/exchangeRateService';
import { calculateCommission } from '../../services/commission/commissionService';
import { securityWidget } from '../ui/securityWidget';

const PAYMENT_ERROR = `🚫 Произошла ошибка при создании оплаты.

Пожалуйста, попробуйте ещё раз чуть позже. 
Если проблема повторяется — обратитесь в поддержку.`;

// Payment confirmation message
const PAYMENT_DETAILS = async (username: string, amountUSD: number, amountRUB: number) => {
  const commissionPercent = await getSystemSetting('commission_percent') || '10';
  return `🔎 Проверь данные перед оплатой:

🧾 Услуга: Пополнение Steam 
👤 Аккаунт: ${username}
💵 Сумма: ${amountUSD} USD (≈${formatRussianCurrency(amountRUB)}) — **комиссия ${commissionPercent}% уже включена**

❗️Пожалуйста, убедитесь, что логин и сумма указаны верно. 
В случае ошибки средства могут уйти другому пользователю.
Если всё правильно — выберите способ оплаты ниже 👇

🎁 РОЗЫГРЫШ АРКАНЫ для подписчиков Крипочки Тысячного Ранга! от $5/400 рублей`;
};

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

    // Check we have required data including transactionId
    const { steamUsername, amountUSD, transactionId } = state.state_data;
    
    if (!steamUsername || !amountUSD || !transactionId) {
      logger.error('Missing required payment data', {
        userId,
        hasUsername: !!steamUsername,
        hasAmount: !!amountUSD,
        hasTransactionId: !!transactionId
      });
      throw new Error('Missing required payment data');
    }

    // Create payment (service handles exchange rate internally)
    const payment = await createPayment(userId, steamUsername, amountUSD, transactionId);

    // Update state
    await setState(userId, 'PAYMENT_PENDING', {
      ...state.state_data,
      paymentUrl: payment.paymentUrl,
      databaseTransactionId: payment.transactionId
    });

    // Send payment confirmation
    const paymentDetailsText = await PAYMENT_DETAILS(steamUsername, amountUSD, payment.totalAmountRUB);
    await bot.sendMessage(
      chatId,
      paymentDetailsText,
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

    // Send security trust widget immediately after payment buttons
    const securityMsg = securityWidget(payment.paymentUrl);
    await bot.sendMessage(chatId, securityMsg.text, securityMsg.options);

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
    
    // Get current exchange rate using standardized logic
    const rateResult = await exchangeRateService.getCurrentUSDRUBRate();
    if (!rateResult.success || !rateResult.rate) {
      logger.error('Failed to get exchange rate for payment confirmation');
      throw new Error('Exchange rate service unavailable');
    }
    const exchangeRate = rateResult.rate.rate;
    const commission = calculateCommission(amountUSD, exchangeRate);

    const message = `🔎 Проверь данные перед оплатой:

🧾 Услуга: Пополнение Steam 
👤 Аккаунт: ${steamUsername}
💵 Сумма: ${amountUSD} USD (≈${formatRussianCurrency(commission.totalAmountRUB)})
💰 Комиссия: ${await getSystemSetting('commission_percent') || '10'}% (уже включена)

❗️ Убедитесь, что данные верны!

🎁 РОЗЫГРЫШ АРКАНЫ для подписчиков Крипочки Тысячного Ранга! от $5/400 рублей`;

    await bot.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: `✅ Оплатить ${formatRussianCurrency(commission.totalAmountRUB)}`, callback_data: 'confirm_payment' }],
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