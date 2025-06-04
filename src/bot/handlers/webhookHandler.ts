import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import TelegramBot from 'node-telegram-bot-api';
import { getTransactionByOrderId, updateTransaction } from '../../services/transaction/transactionService';
import { getUserByTelegramId } from '../../services/user/userService';
import { formatRussianCurrency } from '../../utils/locale';
import { processPaymentWebhook } from '../../services/webhook/webhookProcessor';

// Status messages
const PAYMENT_SUCCESS_MESSAGE = `
✅ Оплата успешно завершена!

Сумма: {amount_rub}
Steam аккаунт: {steam_username}

Средства будут зачислены в течение 5 минут.
Если возникнут вопросы, обращайтесь в поддержку.
`;

const PAYMENT_FAILED_MESSAGE = `
❌ Оплата не удалась

Причина: {error_message}

Пожалуйста, попробуйте снова или обратитесь в поддержку.
`;

const PAYMENT_PENDING_MESSAGE = `
⏳ Ожидание подтверждения платежа

Сумма: {amount_rub}
Steam аккаунт: {steam_username}

Пожалуйста, подождите...
`;

// Webhook payload interface
interface PayDigitalWebhook {
  orderId: string;
  status: 'paid' | 'pending' | 'failed';
  errorCode?: string;
  errorMessage?: string;
  amount?: number;
  currency?: string;
}

/**
 * Handle PayDigital webhook
 */
export async function handlePayDigitalWebhook(
  bot: TelegramBot,
  payload: PayDigitalWebhook
) {
  try {
    // Get transaction
    const transaction = await getTransactionByOrderId(payload.orderId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${payload.orderId}`);
    }

    // Get user
    const user = await getUserByTelegramId(transaction.user_id);
    if (!user) {
      throw new Error(`User not found: ${transaction.user_id}`);
    }

    // Update transaction
    const updates: any = {
      paydigital_status: payload.status,
      paydigital_response: payload
    };

    if (payload.status === 'paid') {
      updates.status = 'completed';
      updates.completed_at = new Date();
    } else if (payload.status === 'failed') {
      updates.status = 'failed';
      updates.error_code = payload.errorCode;
      updates.error_message = payload.errorMessage;
    }

    await updateTransaction(transaction.id, updates);

    // Send status message
    const message = getStatusMessage(payload.status, {
      amount_rub: transaction.amount_rub + transaction.commission_rub,
      steam_username: transaction.steam_username,
      error_message: payload.errorMessage
    });

    await bot.sendMessage(user.telegram_id, message);

    logger.info('Webhook processed', {
      orderId: payload.orderId,
      status: payload.status,
      userId: user.id
    });

  } catch (error) {
    logger.error('Webhook processing error', {
      error,
      payload
    });
    throw error;
  }
}

/**
 * Get status message based on payment status
 */
function getStatusMessage(
  status: string,
  params: {
    amount_rub: number;
    steam_username: string;
    error_message?: string;
  }
): string {
  // Format amount
  const formattedAmount = formatRussianCurrency(params.amount_rub);

  switch (status) {
    case 'paid':
      return PAYMENT_SUCCESS_MESSAGE
        .replace('{amount_rub}', formattedAmount)
        .replace('{steam_username}', params.steam_username);

    case 'failed':
      return PAYMENT_FAILED_MESSAGE
        .replace('{error_message}', params.error_message || 'Неизвестная ошибка');

    case 'pending':
      return PAYMENT_PENDING_MESSAGE
        .replace('{amount_rub}', formattedAmount)
        .replace('{steam_username}', params.steam_username);

    default:
      throw new Error(`Unknown status: ${status}`);
  }
}

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  try {
    const payload = req.body;
    
    logger.info('Webhook received', { payload });

    // Check if this is a payment webhook from PayDigital
    if (payload.order_uuid && payload.status) {
      // Process the payment webhook
      await processPaymentWebhook(payload);
      res.status(200).json({ success: true });
      return;
    }

    // Verify webhook secret for Telegram webhooks
    const secret = req.headers['x-telegram-bot-api-secret-token'];
    if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      logger.warn('Invalid webhook secret', { secret });
      res.status(401).send('Unauthorized');
      return;
    }

    // Process Telegram update
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false });
    await bot.processUpdate(req.body);
    res.sendStatus(200);

    logger.info('Telegram webhook processed', {
      updateId: req.body.update_id
    });
  } catch (error) {
    logger.error('Webhook processing failed', { error });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
} 