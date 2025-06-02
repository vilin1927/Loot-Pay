import { Message } from 'node-telegram-bot-api';
import bot from '../bot';
import { logger } from '../utils/logger';
import { getState, setState } from '../services/state/stateService';
import { createTransaction } from '../services/transaction/transactionService';
import { createPayment } from '../services/paydigital/paydigitalService';
import { formatRussianCurrency } from '../utils/locale';

// Payment processing message
const PAYMENT_PROCESSING_MESSAGE = `
⏳ Создаю платеж...

Пожалуйста, подождите.
`;

// Payment link message
const PAYMENT_LINK_MESSAGE = `
💳 Оплата готова!

Нажмите кнопку ниже для оплаты через СБП:

Сумма к оплате: {amount_rub} ₽
Срок действия: 15 минут

⚠️ Важно: не закрывайте чат до завершения оплаты
`;

// Handle SBP payment creation
export async function handleSbpPayment(
  chatId: number,
  userId: number
) {
  try {
    // Get user state
    const state = await getState(userId);
    if (!state || state.current_state !== 'AMOUNT_SELECTED') {
      throw new Error('Invalid state for SBP payment');
    }

    const { steam_username, amount_usd, amount_rub, commission_rub, exchange_rate } = state.state_data;

    // Show processing message
    await bot.sendMessage(chatId, PAYMENT_PROCESSING_MESSAGE);

    // Create transaction
    const transaction = await createTransaction(userId, {
      steam_username,
      amount_usd,
      amount_rub,
      commission_rub,
      exchange_rate,
      sbp_payment_expires_at: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    });

    // Create PayDigital payment
    const { paymentUrl } = await createPayment({
      steamUsername: steam_username,
      amount: amount_rub + commission_rub,
      netAmount: amount_rub,
      orderId: transaction.paydigital_order_id
    });

    // Update transaction with payment URL
    await updateTransaction(transaction.id, {
      sbp_payment_url: paymentUrl,
      sbp_payment_status: 'created'
    });

    // Format amount
    const formattedAmount = formatRussianCurrency(amount_rub + commission_rub);

    // Show payment link
    await bot.sendMessage(
      chatId,
      PAYMENT_LINK_MESSAGE.replace('{amount_rub}', formattedAmount),
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💳 Оплатить', url: paymentUrl }
            ],
            [
              { text: '❌ Отмена', callback_data: 'cancel_payment' }
            ]
          ]
        }
      }
    );

    // Update state
    await setState(userId, 'PAYMENT_CREATED', {
      transaction_id: transaction.id,
      payment_url: paymentUrl,
      expires_at: transaction.sbp_payment_expires_at
    });

    logger.info('SBP payment created', {
      userId,
      transactionId: transaction.id,
      amount: amount_rub + commission_rub
    });

  } catch (error) {
    logger.error('Error creating SBP payment', {
      error,
      userId
    });

    // Send error message
    await bot.sendMessage(
      chatId,
      '😔 Произошла ошибка при создании платежа. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
    );
  }
} 