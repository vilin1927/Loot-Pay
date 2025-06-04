import { v4 as uuidv4 } from 'uuid';
import { db } from '../../database/connection';
import { logger } from '../../utils/logger';

// Transaction data interface
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
 * Create a new transaction
 */
export async function createTransaction(
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
 * Update transaction details
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
 * Get user's transactions
 */
export async function getUserTransactions(
  userId: number,
  limit: number = 10,
  offset: number = 0
) {
  try {
    // Get transactions
    const transactions = await db('transactions')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db('transactions')
      .where({ user_id: userId })
      .count();

    logger.info('User transactions retrieved', {
      userId,
      count: transactions.length,
      total: count
    });

    return {
      transactions,
      total: Number(count)
    };

  } catch (error) {
    logger.error('Error getting user transactions', {
      error,
      userId
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