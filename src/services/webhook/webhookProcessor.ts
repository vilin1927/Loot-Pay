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

export async function processPaymentWebhook(payload: WebhookPayload) {
  try {
    const { order_uuid, status, amount } = payload;

    // Find transaction
    const transaction = await db('transactions')
      .where('id', order_uuid)
      .first();

    if (!transaction) {
      logger.error('Transaction not found for webhook', { order_uuid });
      return;
    }

    // Update transaction status
    const newStatus = status === 'Paid' ? 'completed' : 
                     status === 'Pending' ? 'pending' : 'failed';
    
    await updateTransactionStatus(order_uuid, newStatus);

    // Notify user
    await notifyUser(transaction.user_id, transaction, newStatus);

    logger.info('Webhook processed successfully', { order_uuid, status });

  } catch (error) {
    logger.error('Error processing webhook', { error, payload });
    throw error;
  }
}

async function notifyUser(userId: number, transaction: any, status: string) {
  try {
    const bot = await getBotInstance();
    
    // Get user's telegram_id
    const user = await db('users').where('id', userId).first();
    if (!user) return;

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
    }

    if (message) {
      await bot.sendMessage(user.telegram_id, message, {
        reply_markup: { inline_keyboard: buttons }
      });
    }

  } catch (error) {
    logger.error('Error notifying user', { error, userId });
  }
} 