import { updateTransactionStatus } from '../transaction/transactionService';
import { getBotInstance } from '../../bot/botInstance';
import { logger } from '../../utils/logger';
import { db } from '../../database/connection';

interface WebhookPayload {
  order_uuid: string;
  status: 'Paid' | 'Pending' | 'Failed';
  amount: number;
  paid_date_msk?: string;
}

interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

/**
 * ✅ ENHANCED: Process payment webhook with comprehensive error handling
 */
export async function processPaymentWebhook(payload: WebhookPayload) {
  try {
    const { order_uuid, status } = payload;

    if (!order_uuid) {
      throw new Error('Missing order_uuid in webhook payload');
    }

    if (!status || !['Paid', 'Pending', 'Failed'].includes(status)) {
      throw new Error(`Invalid status in webhook: ${status}`);
    }

    // Find transaction by order_uuid (which should match our LP-{id} format)
    let transaction;
    
    // Handle both LP-{id} format and raw {id} format
    if (order_uuid.startsWith('LP-')) {
      const id = order_uuid.substring(3); // Remove 'LP-' prefix
      transaction = await db('transactions').where('id', id).first();
    } else {
      transaction = await db('transactions').where('id', order_uuid).first();
    }

    if (!transaction) {
      logger.error('Transaction not found for webhook', { 
        order_uuid, 
        searchedId: order_uuid.startsWith('LP-') ? order_uuid.substring(3) : order_uuid 
      });
      throw new Error(`Transaction not found: ${order_uuid}`);
    }

    // Update transaction status
    const newStatus = status === 'Paid' ? 'completed' : 
                     status === 'Pending' ? 'pending' : 'failed';
    
    await updateTransactionStatus(transaction.id.toString(), newStatus);

    // Notify user
    await notifyUser(transaction.user_id, transaction, newStatus);

    logger.info('Webhook processed successfully', { order_uuid, status, transactionId: transaction.id });

  } catch (error) {
    logger.error('Error processing webhook', { 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : error, 
      payload 
    });
    throw error; // Re-throw to be handled by webhook handler
  }
}

async function notifyUser(userId: number, transaction: any, status: string) {
  try {
    const bot = await getBotInstance();
    
    // Get user's telegram_id
    const user = await db('users').where('id', userId).first();
    if (!user) {
      logger.error('User not found for notification', { userId });
      return;
    }

    let message = '';
    let buttons: InlineKeyboardButton[][] = [];

    if (status === 'completed') {
      const totalAmount = transaction.amount_rub + transaction.commission_rub;
      message = `🎉 Платеж успешно завершен!

💰 Сумма: ${transaction.amount_usd} USD
🎮 Steam: ${transaction.steam_username}
💳 К доплате: ${totalAmount}₽

✅ Средства зачислены на ваш Steam аккаунт!`;
      
      buttons = [
        [{ text: '🏠 Главное меню', callback_data: 'main_menu' }],
        [{ text: '💰 Еще пополнение', callback_data: 'fund_steam' }]
      ];
    } else if (status === 'failed') {
      message = `❌ Платеж не удался

💰 Сумма: ${transaction.amount_usd} USD
🎮 Steam: ${transaction.steam_username}

Обратитесь в поддержку для выяснения причин.`;
      
      buttons = [
        [{ text: '🛠 Поддержка', callback_data: 'support' }],
        [{ text: '🔄 Попробовать снова', callback_data: 'fund_steam' }]
      ];
    } else if (status === 'pending') {
      message = `⏳ Платеж обрабатывается

💰 Сумма: ${transaction.amount_usd} USD
🎮 Steam: ${transaction.steam_username}

Пожалуйста, подождите завершения обработки.`;
      
      buttons = [
        [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
      ];
    }

    if (message) {
      await bot.sendMessage(user.telegram_id, message, {
        reply_markup: { inline_keyboard: buttons }
      });
      
      logger.info('User notified successfully', { 
        userId, 
        telegramId: user.telegram_id, 
        status,
        transactionId: transaction.id 
      });
    }

  } catch (error) {
    logger.error('Error notifying user', { 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : error, 
      userId,
      transactionId: transaction?.id
    });
  }
} 