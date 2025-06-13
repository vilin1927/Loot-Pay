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
  source_channel?: string; // Deep-link attribution
}

// Simple cache to prevent repeated database queries
const userCache = new Map<number, { user: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

// Mutex for preventing concurrent user creation
const userCreationLocks = new Map<number, Promise<any>>();

// Find or create a user with proper race condition handling and mutex
export async function findOrCreateUser(telegramUser: TelegramUser) {
  const telegramId = telegramUser.id;
  
  // Check if there's already a creation process running for this user
  const existingLock = userCreationLocks.get(telegramId);
  if (existingLock) {
    logger.debug('Waiting for existing user creation process', { telegramId });
    return await existingLock;
  }

  // Create a new promise for this user creation process
  const creationPromise = performFindOrCreateUser(telegramUser);
  userCreationLocks.set(telegramId, creationPromise);

  try {
    const result = await creationPromise;
    return result;
  } finally {
    // Clean up the lock
    userCreationLocks.delete(telegramId);
  }
}

// Internal function that actually performs the find or create operation
async function performFindOrCreateUser(telegramUser: TelegramUser) {
  try {
    const now = Date.now();
    const telegramId = telegramUser.id;
    
    // Check cache first
    const cached = userCache.get(telegramId);
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      logger.debug('Returning cached user', { telegramId });
      return cached.user;
    }

    // Try to find existing user first
    const existingUser = await db('users')
      .where({ telegram_id: telegramId })
      .first();

    if (existingUser) {
      // Cache the user
      userCache.set(telegramId, { user: existingUser, timestamp: now });
      logger.debug('Found existing user', { telegramId });
      return existingUser;
    }

    // Try to create new user with race condition handling
    try {
      const [newUser] = await db('users')
        .insert({
          telegram_id: telegramId,
          username: telegramUser.username,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name
        })
        .returning('*');

      // Cache the new user
      userCache.set(telegramId, { user: newUser, timestamp: now });
      logger.info('Created new user', { telegramId });
      return newUser;

    } catch (insertError: any) {
      // Handle unique constraint violation (race condition)
      if (insertError.code === '23505' || insertError.constraint?.includes('telegram_id')) {
        logger.debug('User creation race condition detected, fetching existing user', { 
          telegramId,
          error: insertError.message 
        });
        
        // Another process created the user, fetch it
        const existingUser = await db('users')
          .where({ telegram_id: telegramId })
          .first();

        if (existingUser) {
          // Cache the user
          userCache.set(telegramId, { user: existingUser, timestamp: now });
          return existingUser;
        }
        
        // If still not found, something is seriously wrong
        throw new Error(`User not found after race condition for telegram_id: ${telegramId}`);
      }
      
      // Re-throw other errors
      throw insertError;
    }

  } catch (error) {
    logger.error('Error in findOrCreateUser', { error, telegramId: telegramUser.id });
    throw error;
  }
}

// Clear user from cache when updated
export async function updateUser(userId: number, updates: UserUpdate) {
  try {
    const [updatedUser] = await db('users')
      .where({ id: userId })
      .update({
        ...updates,
        updated_at: db.fn.now()
      })
      .returning('*');

    // Clear cache for this user's telegram_id
    if (updatedUser) {
      userCache.delete(updatedUser.telegram_id);
    }

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

// Clean up expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [telegramId, cached] of userCache.entries()) {
    if ((now - cached.timestamp) > CACHE_TTL) {
      userCache.delete(telegramId);
    }
  }
}, CACHE_TTL); 