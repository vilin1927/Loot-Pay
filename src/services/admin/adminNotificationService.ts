import { getBotInstance } from '../../bot/botInstance';
import { db } from '../../database/connection';
import { logger } from '../../utils/logger';
import { analyticsService } from '../analytics/analyticsService';

const ADMIN_USER_ID = 22; // User 22 is the admin

/**
 * Send notification to User 22 when a payment link is generated
 */
export async function notifyPaymentLinkGenerated(
  userId: number,
  username: string,
  steamUsername: string,
  amountUSD: number,
  totalAmountRUB: number,
  transactionId: number
): Promise<void> {
  try {
    const bot = await getBotInstance();
    
    // Get User 22's telegram ID
    const adminUser = await db('users').where('id', ADMIN_USER_ID).first();
    if (!adminUser) {
      logger.warn('Admin user (User 22) not found for payment link notification');
      return;
    }

    const message = `🔗 НОВАЯ ССЫЛКА НА ОПЛАТУ

👤 Пользователь: ${username} (ID: ${userId})
🎮 Steam: ${steamUsername}
💰 Сумма: $${amountUSD} USD (${totalAmountRUB.toFixed(1)} ₽)
🆔 Транзакция: #${transactionId}

⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

    await bot.sendMessage(adminUser.telegram_id, message);
    
    // Track analytics
    await analyticsService.trackEvent(ADMIN_USER_ID, 'admin_payment_link_notification', {
      targetUserId: userId,
      targetUsername: username,
      steamUsername,
      amountUSD,
      totalAmountRUB,
      transactionId
    });
    
    logger.info('Payment link notification sent to admin', { 
      adminUserId: ADMIN_USER_ID,
      targetUserId: userId,
      transactionId 
    });

  } catch (error) {
    logger.error('Failed to send payment link notification to admin', {
      error: error instanceof Error ? error.message : error,
      targetUserId: userId,
      transactionId
    });
  }
}

/**
 * Send notification to User 22 when a payment is completed successfully
 */
export async function notifyPaymentCompleted(
  userId: number,
  username: string,
  steamUsername: string,
  amountUSD: number,
  paidAmountRUB: number,
  transactionId: number
): Promise<void> {
  try {
    const bot = await getBotInstance();
    
    // Get User 22's telegram ID
    const adminUser = await db('users').where('id', ADMIN_USER_ID).first();
    if (!adminUser) {
      logger.warn('Admin user (User 22) not found for payment completion notification');
      return;
    }

    const message = `✅ ПЛАТЕЖ ЗАВЕРШЕН!

👤 Пользователь: ${username} (ID: ${userId})
🎮 Steam: ${steamUsername}
💰 Сумма: $${amountUSD} USD
💳 Оплачено: ${paidAmountRUB.toFixed(1)} ₽
🆔 Транзакция: #${transactionId}

🎉 Средства зачислены на Steam аккаунт!
⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

    await bot.sendMessage(adminUser.telegram_id, message);
    
    // Track analytics
    await analyticsService.trackEvent(ADMIN_USER_ID, 'admin_payment_completion_notification', {
      targetUserId: userId,
      targetUsername: username,
      steamUsername,
      amountUSD,
      paidAmountRUB,
      transactionId
    });
    
    logger.info('Payment completion notification sent to admin', { 
      adminUserId: ADMIN_USER_ID,
      targetUserId: userId,
      transactionId 
    });

  } catch (error) {
    logger.error('Failed to send payment completion notification to admin', {
      error: error instanceof Error ? error.message : error,
      targetUserId: userId,
      transactionId
    });
  }
} 