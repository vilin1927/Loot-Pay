import { createTransaction } from '../transaction/transactionService';
import { payDigitalService } from '../paydigital/paydigitalService';
import { exchangeRateService } from '../exchangeRate/exchangeRateService';
import { calculateCommission } from '../commission/commissionService';
import { logger } from '../../utils/logger';

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
  transactionId: string  // ✅ REQUIRED PARAMETER - NO FALLBACK
): Promise<PaymentResult> {
  try {
    // 1. Get current exchange rate
    const exchangeRate = await exchangeRateService.getRate();
    logger.info('Got exchange rate for payment', { amountUSD, exchangeRate });

    // 2. Calculate commission and amounts
    const commission = calculateCommission(amountUSD, exchangeRate);
    logger.info('Calculated commission for payment', { 
      amountUSD, 
      baseAmountRUB: commission.baseAmountRUB,
      totalAmountRUB: commission.totalAmountRUB,
      commissionRUB: commission.lootpayFeeRUB + commission.paydigitalFeeRUB
    });

    // 3. Create transaction record
    const transaction = await createTransaction({
      userId,
      steamUsername,
      amountUSD,
      amountRUB: commission.baseAmountRUB,
      totalAmountRUB: commission.totalAmountRUB,
      exchangeRate
    });

    logger.info('Transaction created for payment', {
      transactionId: transaction.id,
      userId,
      steamUsername,
      amountUSD,
      paydigitalTransactionId: transactionId
    });

    // ✅ CRITICAL FIX: Use required transactionId from Steam validation
    const paymentUrl = await payDigitalService.createSteamPayment(
      steamUsername,
      amountUSD,
      commission.totalAmountRUB,
      `LP-${transaction.id}`, // Use transaction ID as order ID
      transactionId  // ✅ USE STORED TRANSACTION ID (REQUIRED)
    );

    // 5. Update transaction with payment URL
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