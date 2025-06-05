import { getBotInstance } from '../botInstance';
import { logger } from '../../utils/logger';
import { getState, setState } from '../../services/state/stateService';
import { createPayment } from '../../services/payment/paymentService';
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

    // ✅ CHECK: Ensure we have required data including transactionId
    const { steamUsername, amountUSD, transactionId } = state.state_data;
    
    if (!steamUsername || !amountUSD || !transactionId) {
      logger.error('Missing required payment data in SBP flow', {
        userId,
        hasUsername: !!steamUsername,
        hasAmount: !!amountUSD,
        hasTransactionId: !!transactionId
      });
      throw new Error('Missing required payment data');
    }

    // Show processing message
    await bot.sendMessage(chatId, PAYMENT_PROCESSING_MESSAGE, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛠 Написать в поддержку', callback_data: 'support' }]
        ]
      }
    });

    // ✅ USE: New centralized payment service with required transactionId
    const payment = await createPayment(userId, steamUsername, amountUSD, transactionId);

    // Format amount
    const formattedAmount = formatRussianCurrency(payment.totalAmountRUB);

    // Show payment link
    await bot.sendMessage(
      chatId,
      PAYMENT_LINK_MESSAGE.replace('{amount_rub}', formattedAmount),
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💳 Оплатить', url: payment.paymentUrl }
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
      databaseTransactionId: payment.transactionId,
      paymentUrl: payment.paymentUrl,
      expires_at: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    });

    logger.info('SBP payment created using new service', {
      userId,
      databaseTransactionId: payment.transactionId,
      amount: payment.totalAmountRUB,
      transactionId,
      paymentUrl: payment.paymentUrl
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