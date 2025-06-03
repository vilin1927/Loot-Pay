import { Message } from 'node-telegram-bot-api';
import { getBotInstance } from '../botInstance';
import { logger } from '../../utils/logger';
import { getState, setState } from '../../services/state/stateService';
import { createTransaction, updateTransaction } from '../../services/transaction/transactionService';
import { payDigitalService } from '../../services/paydigital/paydigitalService';
import { formatRussianCurrency } from '../../utils/locale';

// Payment processing message
const PAYMENT_PROCESSING_MESSAGE = `⏳ Ваша оплата в процессе.  

Как только платёж будет завершён, мы оповестим вас здесь в чате — ничего не нужно обновлять вручную.
⏳ Если хотите, вы можете обратиться в поддержку`;

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
    // Get bot instance
    const bot = await getBotInstance();

    // Get user state
    const state = await getState(userId);
    if (!state || state.current_state !== 'AMOUNT_SELECTED') {
      throw new Error('Invalid state for SBP payment');
    }

    const { steamUsername, amountUSD, totalAmountRUB } = state.state_data;

    // Show processing message
    await bot.sendMessage(chatId, PAYMENT_PROCESSING_MESSAGE, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛠 Написать в поддержку', callback_data: 'support' }]
        ]
      }
    });

    // Create transaction
    const transaction = await createTransaction(userId, {
      user_id: userId,
      steam_username: steamUsername,
      amount_usd: amountUSD,
      amount_rub: totalAmountRUB,
      commission_rub: totalAmountRUB * 0.1, // 10% commission
      exchange_rate: 90, // TODO: Get real exchange rate
      sbp_payment_expires_at: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    });

    // Create PayDigital payment
    const paymentUrl = await payDigitalService.createSteamPayment(
      steamUsername,
      amountUSD,
      totalAmountRUB,
      transaction.paydigital_order_id
    );

    // Update transaction with payment URL
    await updateTransaction(transaction.id, {
      sbp_payment_url: paymentUrl,
      sbp_payment_status: 'created'
    });

    // Format amount
    const formattedAmount = formatRussianCurrency(totalAmountRUB);

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
    await setState(userId, 'PAYMENT_PENDING', {
      ...state.state_data,
      transaction_id: transaction.id,
      payment_url: paymentUrl,
      expires_at: transaction.sbp_payment_expires_at
    });

    logger.info('SBP payment created', {
      userId,
      transactionId: transaction.id,
      amount: totalAmountRUB
    });

  } catch (error) {
    logger.error('Error creating SBP payment', {
      error,
      userId
    });

    // Get bot instance for error message
    const bot = await getBotInstance();

    // Send error message
    await bot.sendMessage(
      chatId,
      '🚫 Произошла ошибка при создании оплаты. Пожалуйста, попробуйте позже или обратитесь в поддержку.',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🛠 Написать в поддержку', callback_data: 'support' }]
          ]
        }
      }
    );
  }
} 