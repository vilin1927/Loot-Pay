import { updateTransactionStatus } from '../transaction/transactionService';
import { getBotInstance } from '../../bot/botInstance';
import { logger } from '../../utils/logger';
import { db } from '../../database/connection';
// import crypto from 'crypto'; // Temporarily disabled for testing

// ✅ UPDATED: PayDigital webhook format from official documentation
interface PayDigitalWebhookPayload {
  order_uuid: string;                    // идентификатор транзакции
  sbp_id?: string;                      // НСПК-ссылка для оплаты по QR
  amount: number;                       // сумма транзакции
  status: 'Paid' | 'Pending' | 'Failed'; // статус транзакции
  paid_date_msk?: string;               // дата оплаты по Москве
  hash: string;                         // хэш для верификации
  order_id?: string;                    // номер заказа
}

interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

/**
 * ✅ ENHANCED: Verify PayDigital webhook hash (disabled for testing)
 */
// function verifyWebhookHash(payload: PayDigitalWebhookPayload): boolean {
//   try {
//     const { order_uuid, hash } = payload;
//     const webhookSecret = process.env.PAYDIGITAL_WEBHOOK_SECRET;
    
//     if (!webhookSecret) {
//       logger.warn('PayDigital webhook secret not configured');
//       return false; // In production, you might want to reject if no secret
//     }
    
//     // PayDigital hash: SHA256(order_uuid + webhook_secret)
//     const expectedHash = crypto
//       .createHash('sha256')
//       .update(order_uuid + webhookSecret)
//       .digest('hex');
      
//     const isValid = expectedHash === hash;
    
//     if (!isValid) {
//       logger.error('Invalid webhook hash', {
//         order_uuid,
//         expectedHash: expectedHash.substring(0, 8) + '...',
//         receivedHash: hash?.substring(0, 8) + '...'
//       });
//     }
    
//     return isValid;
//   } catch (error) {
//     logger.error('Error verifying webhook hash', { error, payload });
//     return false;
//   }
// }

/**
 * ✅ ENHANCED: Process PayDigital payment webhook with official format
 */
export async function processPaymentWebhook(payload: PayDigitalWebhookPayload, clientIP?: string) {
  try {
    logger.info('Processing PayDigital webhook', { 
      order_uuid: payload.order_uuid,
      status: payload.status,
      amount: payload.amount,
      clientIP
    });

    // ✅ Security: Verify IP address (PayDigital webhooks come from authorized IPs)
    const authorizedIPs = ['62.76.102.182', '195.210.170.29', '89.113.156.153'];
    
    if (clientIP && !authorizedIPs.includes(clientIP)) {
      logger.warn('Webhook from unauthorized IP', { 
        clientIP, 
        order_uuid: payload.order_uuid,
        authorizedIPs
      });
      
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Unauthorized webhook IP: ${clientIP}`);
      }
    }

    // ✅ Security: Verify webhook hash (disabled for testing)
    // TODO: Re-enable hash verification in production
    console.log('🔧 TESTING MODE: Hash verification disabled');
    // if (!verifyWebhookHash(payload)) {
    //   throw new Error('Invalid webhook signature');
    // }

    const { order_uuid, status, amount, paid_date_msk } = payload;

    if (!order_uuid) {
      throw new Error('Missing order_uuid in webhook payload');
    }

    if (!status || !['Paid', 'Pending', 'Failed'].includes(status)) {
      throw new Error(`Invalid status in webhook: ${status}`);
    }

    // Find transaction by order_uuid using the correct database field
    let transaction;
    
    // PayDigital sends either order_uuid or order_id in the webhook
    // Our database stores this in the 'paydigital_order_id' field
    if (order_uuid.startsWith('LP-')) {
      // If it's in LP-{id} format, search by paydigital_order_id field directly
      transaction = await db('transactions').where('paydigital_order_id', order_uuid).first();
    } else {
      // If it's a raw UUID, it could be either:
      // 1. A direct paydigital_order_id value 
      // 2. Need to try both paydigital_order_id and the LP-prefixed format
      transaction = await db('transactions').where('paydigital_order_id', order_uuid).first();
      
      if (!transaction) {
        // Try with LP- prefix in case the webhook sends raw UUID
        transaction = await db('transactions').where('paydigital_order_id', `LP-${order_uuid}`).first();
      }
    }

    if (!transaction) {
      logger.error('Transaction not found for webhook', { 
        order_uuid, 
        searchedId: order_uuid.startsWith('LP-') ? order_uuid.substring(3) : order_uuid 
      });
      throw new Error(`Transaction not found: ${order_uuid}`);
    }

    // ✅ Update transaction with PayDigital data
    const updates: any = {
      paydigital_status: status,
      updated_at: new Date()
    };

    // Map PayDigital status to internal status
    if (status === 'Paid') {
      updates.status = 'completed';
      updates.completed_at = paid_date_msk ? new Date(paid_date_msk) : new Date();
      updates.sbp_payment_status = 'completed';
    } else if (status === 'Failed') {
      updates.status = 'failed';
      updates.sbp_payment_status = 'failed';
    } else if (status === 'Pending') {
      updates.status = 'pending';
      updates.sbp_payment_status = 'pending';
    }

    // Store PayDigital webhook data
    updates.paydigital_response = JSON.stringify(payload);

    await updateTransactionStatus(transaction.id.toString(), updates.status);

    // Update additional fields
    await db('transactions').where('id', transaction.id).update(updates);

    // Notify user
    await notifyUser(transaction.user_id, transaction, updates.status);

    logger.info('PayDigital webhook processed successfully', { 
      order_uuid, 
      status, 
      transactionId: transaction.id,
      amount,
      paid_date_msk
    });

  } catch (error) {
    logger.error('Error processing PayDigital webhook', { 
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