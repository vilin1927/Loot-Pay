import { updateTransactionStatus } from '../transaction/transactionService';
import { getBotInstance } from '../../bot/botInstance';
import { logger } from '../../utils/logger';
import { db } from '../../database/connection';
import crypto from 'crypto';

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
 * ✅ ENHANCED: Verify PayDigital webhook hash
 */
function verifyWebhookHash(payload: PayDigitalWebhookPayload): boolean {
  try {
    const { order_uuid, hash } = payload;
    const webhookSecret = process.env.PAYDIGITAL_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      logger.warn('PayDigital webhook secret not configured');
      return false; // In production, you might want to reject if no secret
    }
    
    // PayDigital hash: SHA256(order_uuid + webhook_secret)
    const expectedHash = crypto
      .createHash('sha256')
      .update(order_uuid + webhookSecret)
      .digest('hex');
      
    const isValid = expectedHash === hash;
    
    if (!isValid) {
      logger.error('Invalid webhook hash', {
        order_uuid,
        expectedHash: expectedHash.substring(0, 8) + '...',
        receivedHash: hash?.substring(0, 8) + '...'
      });
    }
    
    return isValid;
  } catch (error) {
    logger.error('Error verifying webhook hash', { error, payload });
    return false;
  }
}

/**
 * ✅ ENHANCED: Process PayDigital payment webhook with official format
 */
export async function processPaymentWebhook(payload: PayDigitalWebhookPayload, clientIP?: string) {
  try {
    logger.info('Processing PayDigital webhook', { 
      order_uuid: payload.order_uuid,
      order_id: payload.order_id,
      status: payload.status,
      amount: payload.amount,
      clientIP
    });

    // ✅ Security: Verify IP address (PayDigital webhooks come from authorized IPs)
    const authorizedIPs = ['62.76.102.182', '195.210.170.29'];
    
    if (clientIP) {
      // Handle comma-separated IP lists (proxy chains)
      const clientIPs = clientIP.split(',').map(ip => ip.trim());
      const hasAuthorizedIP = clientIPs.some(ip => authorizedIPs.includes(ip));
      
      if (!hasAuthorizedIP) {
        logger.warn('Webhook from unauthorized IP', { 
          clientIP, 
          clientIPs,
          order_uuid: payload.order_uuid,
          authorizedIPs
        });
        
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`Unauthorized webhook IP: ${clientIP}`);
        }
      } else {
        logger.info('Webhook from authorized IP', { 
          clientIP, 
          clientIPs,
          authorizedIP: clientIPs.find(ip => authorizedIPs.includes(ip))
        });
      }
    }

    // ✅ Security: Verify webhook hash
    if (!verifyWebhookHash(payload)) {
      throw new Error('Invalid webhook signature');
    }

    const { order_uuid, order_id, status, amount, paid_date_msk } = payload;

    if (!order_uuid) {
      throw new Error('Missing order_uuid in webhook payload');
    }

    if (!status || !['Paid', 'Pending', 'Failed'].includes(status)) {
      throw new Error(`Invalid status in webhook: ${status}`);
    }

    // ✅ FIXED: Find transaction by order_id (our reference) instead of order_uuid (PayDigital's internal ID)
    let transaction;
    
    // PayDigital webhook contains:
    // - order_uuid: PayDigital's internal UUID (for hash verification)
    // - order_id: Our reference UUID that we sent (for database lookup)
    if (order_id) {
      // Use order_id if available (this is our reference)
      transaction = await db('transactions').where('paydigital_order_id', order_id).first();
      logger.info('Webhook lookup using order_id', { order_id, found: !!transaction });
    }
    
    // Fallback: try order_uuid if order_id lookup failed (backward compatibility)
    if (!transaction) {
      transaction = await db('transactions').where('paydigital_order_id', order_uuid).first();
      logger.info('Webhook fallback lookup using order_uuid', { order_uuid, found: !!transaction });
    }

    if (!transaction) {
      logger.error('Transaction not found for webhook', { 
        order_uuid,
        order_id,
        searchedFields: ['paydigital_order_id']
      });
      throw new Error(`Transaction not found: ${order_id || order_uuid}`);
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
    await notifyUser(transaction.user_id, transaction, updates.status, amount);

    logger.info('PayDigital webhook processed successfully', { 
      order_uuid,
      order_id,
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

async function notifyUser(userId: number, transaction: any, status: string, webhookAmount?: number) {
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
      // Parse the PayDigital response to get the actual paid amount
      let finalAmount = webhookAmount; // amount from webhook payload
      
      // If webhook doesn't have amount, try parsing from paydigital_response
      if (!finalAmount && transaction.paydigital_response) {
        try {
          const paydigitalData = JSON.parse(transaction.paydigital_response);
          finalAmount = paydigitalData.amount;
        } catch (e) {
          // Fallback to transaction total_amount_rub
          finalAmount = transaction.total_amount_rub;
        }
      }
      
      // Format with 1 decimal place and Russian locale (comma as decimal separator)
      const paidAmount = new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }).format(finalAmount || 0);
      
      message = `🎉 Платеж успешно завершен!

💰 Сумма: ${transaction.amount_usd} USD
🎮 Steam: ${transaction.steam_username}
💳 Вы оплатили: ${paidAmount} ₽

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