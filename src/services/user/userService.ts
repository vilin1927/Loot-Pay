import { db } from '../database/connection';
import { logger } from '../../utils/logger';

// Types
interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface UserUpdate {
  username?: string;
  first_name?: string;
  last_name?: string;
  steam_username?: string;
  steam_verified?: boolean;
  current_state?: string;
  state_data?: Record<string, any>;
  state_expires_at?: Date;
  gaming_frequency?: string;
  payment_method?: string;
  referral_source?: string;
}

// Find or create a user
export async function findOrCreateUser(telegramUser: TelegramUser) {
  try {
    // Try to find existing user
    const existingUser = await db('users')
      .where({ telegram_id: telegramUser.id })
      .first();

    if (existingUser) {
      logger.debug('Found existing user', { telegramId: telegramUser.id });
      return existingUser;
    }

    // Create new user
    const [newUser] = await db('users')
      .insert({
        telegram_id: telegramUser.id,
        username: telegramUser.username,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name
      })
      .returning('*');

    logger.info('Created new user', { telegramId: telegramUser.id });
    return newUser;
  } catch (error) {
    logger.error('Error in findOrCreateUser', { error, telegramId: telegramUser.id });
    throw error;
  }
}

// Update user
export async function updateUser(userId: number, updates: UserUpdate) {
  try {
    const [updatedUser] = await db('users')
      .where({ id: userId })
      .update({
        ...updates,
        updated_at: db.fn.now()
      })
      .returning('*');

    logger.info('Updated user', { userId, updates });
    return updatedUser;
  } catch (error) {
    logger.error('Error in updateUser', { error, userId });
    throw error;
  }
}

// Get user by ID
export async function getUserById(userId: number) {
  try {
    const user = await db('users')
      .where({ id: userId })
      .first();

    if (!user) {
      logger.warn('User not found', { userId });
      return null;
    }

    logger.debug('Retrieved user', { userId });
    return user;
  } catch (error) {
    logger.error('Error in getUserById', { error, userId });
    throw error;
  }
}

// Get user by Telegram ID
export async function getUserByTelegramId(telegramId: number) {
  try {
    const user = await db('users')
      .where({ telegram_id: telegramId })
      .first();

    if (!user) {
      logger.warn('User not found by telegram ID', { telegramId });
      return null;
    }

    logger.debug('Retrieved user by telegram ID', { telegramId });
    return user;
  } catch (error) {
    logger.error('Error in getUserByTelegramId', { error, telegramId });
    throw error;
  }
} 