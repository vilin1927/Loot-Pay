import { v4 as uuidv4 } from 'uuid';
import { db } from '../../database/connection';
import { logger } from '../../utils/logger';

// New interface as specified
interface CreateTransactionData {
  userId: number;
  steamUsername: string;
  amountUSD: number;
  amountRUB: number;
  totalAmountRUB: number;
  exchangeRate: number;
}

// Existing transaction data interface
interface TransactionData {
  user_id: number;
  steam_username: string;
  amount_usd: number;
  amount_rub: number;
  commission_rub: number;
  exchange_rate: number;
  sbp_payment_expires_at: Date;
}

// Transaction update interface
interface TransactionUpdate {
  sbp_payment_id?: string;
  sbp_payment_url?: string;
  sbp_payment_status?: string;
  paydigital_transaction_id?: string;
  paydigital_order_id?: string;
  paydigital_status?: string;
  paydigital_response?: Record<string, any>;
  status?: string;
  error_code?: string;
  error_message?: string;
  completed_at?: Date;
}

/**
 * Create a new transaction (new specification)
 */
export async function createTransaction(data: CreateTransactionData) {
  try {
    // Calculate commission from the total amount
    const commissionRUB = data.totalAmountRUB - data.amountRUB;
    
    // Generate UUID-based order ID for better security
    const orderId = `LP-${uuidv4()}`;
    
    const [transaction] = await db('transactions')
      .insert({
        user_id: data.userId,
        steam_username: data.steamUsername,
        amount_usd: data.amountUSD,
        amount_rub: data.amountRUB,
        commission_rub: commissionRUB,
        exchange_rate: data.exchangeRate,
        paydigital_order_id: orderId,  // ✅ STORE UUID-BASED ORDER ID
        status: 'pending',
        sbp_payment_expires_at: new Date(Date.now() + 30 * 60 * 1000)
      })
      .returning('*');

    logger.info('Transaction created with UUID order ID', { 
      transactionId: transaction.id,
      orderId: orderId
    });
    return transaction;
  } catch (error) {
    logger.error('Error creating transaction', { error });
    throw error;
  }
}

/**
 * Update transaction status (new specification)
 */
export async function updateTransactionStatus(
  transactionId: string, 
  status: string, 
  externalPaymentId?: string,
  paymentUrl?: string
) {
  try {
    const updateData: any = { 
      status,
      ...(status === 'completed' && { completed_at: new Date() })
    };
    
    // Map to actual database columns
    if (externalPaymentId) updateData.sbp_payment_id = externalPaymentId;
    if (paymentUrl) updateData.sbp_payment_url = paymentUrl;

    const [transaction] = await db('transactions')
      .where('id', transactionId)
      .update(updateData)
      .returning('*');

    logger.info('Transaction updated', { transactionId, status });
    return transaction;
  } catch (error) {
    logger.error('Error updating transaction', { error, transactionId });
    throw error;
  }
}

/**
 * Get user transactions (updated specification - only successful payments)
 */
export async function getUserTransactions(userId: number, limit = 3, offset = 0) {
  try {
    // ✅ FILTER: Only show completed/successful transactions
    const transactions = await db('transactions')
      .where('user_id', userId)
      .where('status', 'completed')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    // ✅ COUNT: Only count completed transactions for pagination
    const total = await db('transactions')
      .where('user_id', userId)
      .where('status', 'completed')
      .count('* as count')
      .first();

    return {
      transactions,
      total: Number(total?.count || 0),
      hasMore: offset + limit < Number(total?.count || 0)
    };
  } catch (error) {
    logger.error('Error getting user transactions', { error, userId });
    throw error;
  }
}

/**
 * Create a new transaction (legacy interface for existing code)
 */
export async function createTransactionLegacy(
  userId: number,
  data: TransactionData
) {
  try {
    // Generate unique order ID
    const orderId = `LP-${uuidv4().slice(0, 8)}`;

    // Create transaction
    const [transaction] = await db('transactions')
      .insert({
        ...data,
        paydigital_order_id: orderId,
        status: 'pending',
        sbp_payment_status: 'pending',
        paydigital_status: 'pending'
      })
      .returning('*');

    logger.info('Transaction created', {
      userId,
      transactionId: transaction.id,
      orderId,
      amount: data.amount_usd
    });

    return transaction;

  } catch (error) {
    logger.error('Error creating transaction', {
      error,
      userId,
      data
    });
    throw error;
  }
}

/**
 * Update transaction details (legacy interface)
 */
export async function updateTransaction(
  transactionId: number,
  updates: TransactionUpdate
) {
  try {
    // Update transaction
    const [transaction] = await db('transactions')
      .where({ id: transactionId })
      .update({
        ...updates,
        updated_at: new Date()
      })
      .returning('*');

    logger.info('Transaction updated', {
      transactionId,
      updates
    });

    return transaction;

  } catch (error) {
    logger.error('Error updating transaction', {
      error,
      transactionId,
      updates
    });
    throw error;
  }
}

/**
 * Get transaction by numeric ID
 */
export async function getTransaction(transactionId: number) {
  try {
    const transaction = await db('transactions')
      .where({ id: transactionId })
      .first();

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return transaction;

  } catch (error) {
    logger.error('Error getting transaction', {
      error,
      transactionId
    });
    throw error;
  }
}

/**
 * Get transaction by PayDigital order ID
 */
export async function getTransactionByOrderId(orderId: string) {
  try {
    const transaction = await db('transactions')
      .where({ paydigital_order_id: orderId })
      .first();

    if (!transaction) {
      throw new Error(`Transaction not found for order ID: ${orderId}`);
    }

    return transaction;

  } catch (error) {
    logger.error('Error getting transaction by order ID', {
      error,
      orderId
    });
    throw error;
  }
} 