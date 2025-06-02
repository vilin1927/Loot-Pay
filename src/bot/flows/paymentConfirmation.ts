import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../utils/logger';
import { getState, setState } from '../../services/state/stateService';
import { createSteamPayment } from '../../services/paydigital/paydigitalService';
import { handleSteamUsernameRequest } from './steamUsername';
import { handleAmountSelection } from './amountSelection';

const PAYMENT_ERROR = `
❌ Ошибка при создании платежа

Пожалуйста, попробуйте позже или обратитесь в поддержку.
`;

// Payment confirmation message
const PAYMENT_CONFIRMATION_MESSAGE = `
💳 Подтверждение платежа

👤 Steam аккаунт: {steam_username}
💰 Сумма пополнения: {amount_usd}$ ({amount_rub} ₽)
💸 Комиссия: {commission_rub} ₽
💵 Итого к оплате: {total_rub} ₽

Нажмите "Оплатить" для перехода к оплате через СБП.
`;

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
    const paymentUrl = await createSteamPayment(
      steamUsername,
      amountUSD,
      totalAmountRUB
    );

    // Update state
    await setState(userId, 'PAYMENT_PENDING', {
      ...state.state_data,
      paymentUrl
    });

    // Send payment link
    await bot.sendMessage(
      chatId,
      `💳 Оплата: ${totalAmountRUB}₽\n\nНажмите кнопку ниже для оплаты:`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '💳 Оплатить', url: paymentUrl }
          ]]
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

    // Send error message
    await bot.sendMessage(chatId, PAYMENT_ERROR);
    throw error;
  }
}

// Handle change Steam username
export async function handleChangeSteam(
  chatId: number,
  userId: number
) {
  await handleSteamUsernameRequest(chatId, userId);
}

// Handle change amount
export async function handleChangeAmount(
  chatId: number,
  userId: number
) {
  await handleAmountSelection(chatId, userId);
} 