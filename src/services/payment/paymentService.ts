import { createTransaction } from '../transaction/transactionService';
import { payDigitalService } from '../paydigital/paydigitalService';
import { exchangeRateService } from '../exchangeRate/exchangeRateService';
import { calculateCommission } from '../commission/commissionService';
import { logger } from '../../utils/logger';
import { analyticsService } from '../analytics/analyticsService';
import { db } from '../../database/connection';

interface PaymentResult {
  transactionId: number;
  paymentUrl: string;
  totalAmountRUB: number;
  baseAmountRUB: number;
  commissionRUB: number;
}

/**
 * ✅ UPDATED: Create a payment for Steam funding using required transactionId
 * @param userId Database user ID
 * @param steamUsername Validated Steam username
 * @param amountUSD Amount in USD
 * @param transactionId TransactionId from Steam validation (REQUIRED)
 * @returns Payment details including URL
 */
export async function createPayment(
  userId: number,
  steamUsername: string,
  amountUSD: number,
  transactionId: string
): Promise<PaymentResult> {
  // Input validation
  if (!userId || userId <= 0) {
    throw new Error('Invalid user ID provided');
  }
  
  if (!steamUsername || steamUsername.trim().length === 0) {
    throw new Error('Steam username is required');
  }
  
  if (!amountUSD || amountUSD <= 0) {
    throw new Error('Invalid amount provided');
  }
  
  if (!transactionId || transactionId.trim().length === 0) {
    throw new Error('Transaction ID is required for payment processing');
  }

  try {
    // 1. Get current exchange rate with enhanced error handling
    let rateResult;
    try {
      rateResult = await exchangeRateService.getCurrentUSDRUBRate();
    } catch (exchangeError) {
      await analyticsService.trackEvent(userId, 'payment_exchange_rate_error', {
        error: exchangeError instanceof Error ? exchangeError.message : 'Unknown exchange rate error',
        steamUsername,
        amountUSD,
        transactionId
      });
      throw new Error('Exchange rate service is temporarily unavailable');
    }
    
    if (!rateResult.success || !rateResult.rate) {
      await analyticsService.trackEvent(userId, 'payment_exchange_rate_unavailable', {
        rateResult,
        steamUsername,
        amountUSD,
        transactionId
      });
      throw new Error('Current exchange rate is unavailable');
    }
    
    const exchangeRate = rateResult.rate.rate;
    logger.info('Got exchange rate for payment', { 
      amountUSD, 
      exchangeRate, 
      source: rateResult.source,
      rateAge: rateResult.rate.created_at 
    });

    // 2. Calculate commission and amounts
    const commission = calculateCommission(amountUSD, exchangeRate);
    logger.info('Calculated commission for payment', { 
      amountUSD, 
      baseAmountRUB: commission.baseAmountRUB,
      totalAmountRUB: commission.totalAmountRUB,
      commissionRUB: commission.lootpayFeeRUB + commission.paydigitalFeeRUB
    });

    // 3. Create transaction record with enhanced error handling
    let transaction;
    try {
      transaction = await createTransaction({
        userId,
        steamUsername,
        amountUSD,
        amountRUB: commission.baseAmountRUB,
        totalAmountRUB: commission.totalAmountRUB,
        exchangeRate
      });
    } catch (dbError) {
      await analyticsService.trackEvent(userId, 'payment_database_error', {
        error: dbError instanceof Error ? dbError.message : 'Unknown database error',
        steamUsername,
        amountUSD,
        transactionId,
        operationType: 'create_transaction'
      });
      throw new Error('Unable to create transaction record. Please try again.');
    }

    logger.info('Transaction created for payment', {
      transactionId: transaction.id,
      userId,
      steamUsername,
      amountUSD,
      paydigitalTransactionId: transactionId
    });

    // 4. Create PayDigital payment with enhanced error handling
    let paymentUrl;
    try {
      paymentUrl = await payDigitalService.createSteamPayment(
        steamUsername,
        amountUSD,
        commission.totalAmountRUB,  // Total amount user pays (with commission)
        commission.netAmountRUB,    // Net amount Steam receives (without commission)
        transaction.paydigital_order_id,  // ✅ Use stored UUID-based order ID
        transactionId               // Use stored transaction ID (required)
      );
    } catch (payDigitalError) {
      await analyticsService.trackEvent(userId, 'payment_provider_error', {
        error: payDigitalError instanceof Error ? payDigitalError.message : 'Unknown payment provider error',
        steamUsername,
        amountUSD,
        transactionId,
        transactionDbId: transaction.id,
        provider: 'paydigital'
      });
      
      // Check for specific PayDigital error types
      if (payDigitalError instanceof Error) {
        if (payDigitalError.message.includes('транзакция с таким ID уже обработана')) {
          throw new Error('This transaction has already been processed. Please start a new transaction.');
        }
        
        if (payDigitalError.message.includes('timeout') || payDigitalError.message.includes('network')) {
          throw new Error('Payment service is temporarily unavailable. Please try again in a few moments.');
        }
        
        if (payDigitalError.message.includes('insufficient funds') || payDigitalError.message.includes('недостаточно')) {
          throw new Error('Payment service reported insufficient funds. Please check your payment method.');
        }
        
        if (payDigitalError.message.includes('invalid') || payDigitalError.message.includes('неверн')) {
          throw new Error('Invalid payment parameters. Please contact support if this persists.');
        }
      }
      
      throw new Error('Payment processing failed. Please try again or contact support.');
    }

    // 5. Track successful payment link generation
    try {
      await analyticsService.trackPaymentLinkGenerated(
        userId, 
        amountUSD, 
        commission.totalAmountRUB, 
        'paydigital'
      );
    } catch (analyticsError) {
      // Don't break payment flow if analytics fails
      logger.warn('Payment link analytics tracking failed', { 
        error: analyticsError instanceof Error ? analyticsError.message : 'Unknown error',
        userId,
        transactionId: transaction.id
      });
    }

    // 6. Notify User 22 (admin) about payment link generation
    try {
      const { notifyPaymentLinkGenerated } = await import('../admin/adminNotificationService');
      const user = await db('users').where('id', userId).first();
      if (user) {
        await notifyPaymentLinkGenerated(
          userId,
          user.username || 'Unknown',
          steamUsername,
          amountUSD,
          commission.totalAmountRUB,
          transaction.id
        );
      }
    } catch (notificationError) {
      // Don't break payment flow if notification fails
      logger.warn('Admin notification failed for payment link', { 
        error: notificationError instanceof Error ? notificationError.message : 'Unknown error',
        userId,
        transactionId: transaction.id
      });
    }

    // 6. Update transaction with payment URL
    // Note: We'll implement updateTransactionStatus when needed
    
    logger.info('Payment created successfully using required transactionId', {
      transactionId: transaction.id,
      paymentUrl,
      totalAmountRUB: commission.totalAmountRUB,
      paydigitalTransactionId: transactionId
    });

    return {
      transactionId: transaction.id,
      paymentUrl,
      totalAmountRUB: commission.totalAmountRUB,
      baseAmountRUB: commission.baseAmountRUB,
      commissionRUB: commission.lootpayFeeRUB + commission.paydigitalFeeRUB
    };

  } catch (error) {
    logger.error('Error creating payment', {
      error,
      userId,
      steamUsername,
      amountUSD,
      paydigitalTransactionId: transactionId
    });
    throw error;
  }
} 