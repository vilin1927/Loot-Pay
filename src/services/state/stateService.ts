import { db } from '../../database/connection';
import { logger } from '../../utils/logger';

// User state types
export type UserState = 
  | 'QUESTIONNAIRE_Q1'
  | 'QUESTIONNAIRE_Q2'
  | 'QUESTIONNAIRE_Q3'
  | 'QUESTIONNAIRE_COMPLETE'
  | 'STEAM_USERNAME'
  | 'AMOUNT_SELECTION'
  | 'AMOUNT_SELECTED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_COMPLETED';

// State data interface
export interface StateData {
  steamUsername?: string;
  amountUSD?: number;
  totalAmountRUB?: number;
  orderId?: string;
  paymentUrl?: string;
  questionnaireAnswers?: {
    q1?: string;
    q2?: string;
    q3?: string;
  };
  [key: string]: any;
}

/**
 * Get user state
 */
export async function getState(userId: number) {
  try {
    const state = await db('user_states')
      .where({ user_id: userId })
      .first();

    return state;
  } catch (error) {
    logger.error('Error getting user state', {
      error,
      userId
    });
    throw error;
  }
}

/**
 * Set user state
 */
export async function setState(
  userId: number,
  state: UserState,
  data: StateData
) {
  try {
    await db('user_states')
      .insert({
        user_id: userId,
        current_state: state,
        state_data: data,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      })
      .onConflict('user_id')
      .merge();

    logger.info('User state updated', {
      userId,
      state,
      data
    });
  } catch (error) {
    logger.error('Error setting user state', {
      error,
      userId,
      state
    });
    throw error;
  }
}

/**
 * Clear user state
 */
export async function clearState(userId: number) {
  try {
    await db('user_states')
      .where({ user_id: userId })
      .delete();

    logger.info('User state cleared', { userId });
  } catch (error) {
    logger.error('Error clearing user state', {
      error,
      userId
    });
    throw error;
  }
}

/**
 * Clean up expired states
 */
export async function cleanupExpiredStates() {
  try {
    const result = await db('user_states')
      .where('expires_at', '<', new Date())
      .delete();

    logger.info('Expired states cleaned up', {
      count: result
    });
  } catch (error) {
    logger.error('Error cleaning up expired states', { error });
    throw error;
  }
} 