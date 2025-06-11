import { getBotInstance } from '../../bot/botInstance';
import { db } from '../../database/connection';
import { analyticsService } from '../analytics/analyticsService';
import { logger } from '../../utils/logger';

export interface UserStatus {
  isAccessible: boolean;
  status: 'active' | 'blocked' | 'chat_deleted' | 'deactivated' | 'unknown_error';
  errorMessage?: string;
  lastChecked: Date;
}

/**
 * Main function to check if a user is accessible for bot messages
 */
export async function checkUserAccessibility(userId: number, telegramId: number): Promise<UserStatus> {
  try {
    const bot = await getBotInstance();
    
    logger.info('Checking user accessibility', { userId, telegramId });
    
    // Try to send a typing action - least intrusive way to test accessibility
    await bot.sendChatAction(telegramId, 'typing');
    
    logger.info('User is accessible', { userId, telegramId });
    
    return { 
      isAccessible: true, 
      status: 'active',
      lastChecked: new Date()
    };
    
  } catch (error: any) {
    logger.warn('User accessibility check failed', { 
      userId, 
      telegramId, 
      error: error.message 
    });
    
    return analyzeError(error);
  }
}

/**
 * Analyze Telegram API errors to determine user status
 */
function analyzeError(error: any): UserStatus {
  const errorMsg = error.message || '';
  const errorCode = error.code;
  
  logger.debug('Analyzing accessibility error', { errorMsg, errorCode });
  
  // User blocked the bot
  if (errorMsg.includes('bot was blocked by the user') || 
      errorMsg.includes('Forbidden: bot was blocked')) {
    return { 
      isAccessible: false, 
      status: 'blocked',
      errorMessage: 'User blocked the bot',
      lastChecked: new Date()
    };
  }
  
  // Chat not found (user deleted chat or deactivated account)
  if (errorMsg.includes('chat not found') || 
      errorMsg.includes('Bad Request: chat not found')) {
    return { 
      isAccessible: false, 
      status: 'chat_deleted',
      errorMessage: 'Chat not found',
      lastChecked: new Date()
    };
  }
  
  // User deactivated their account
  if (errorMsg.includes('user is deactivated') ||
      errorMsg.includes('Forbidden: user is deactivated')) {
    return { 
      isAccessible: false, 
      status: 'deactivated',
      errorMessage: 'User account deactivated',
      lastChecked: new Date()
    };
  }
  
  // Unknown error
  return { 
    isAccessible: false, 
    status: 'unknown_error',
    errorMessage: errorMsg || 'Unknown error occurred',
    lastChecked: new Date()
  };
}

/**
 * Find user by ID from database
 */
async function findUserById(userId: number) {
  const user = await db('users').where('id', userId).first();
  if (!user) {
    throw new Error(`User ${userId} not found in database`);
  }
  return user;
}

/**
 * Update user accessibility status in database
 */
async function updateUserAccessibilityStatus(userId: number, status: UserStatus): Promise<void> {
  try {
    await db('users')
      .where('id', userId)
      .update({
        last_accessibility_check: status.lastChecked,
        is_accessible: status.isAccessible,
        accessibility_status: status.status,
        updated_at: new Date()
      });
      
    logger.info('User accessibility status updated', { userId, status: status.status });
  } catch (error) {
    logger.error('Failed to update user accessibility status', { userId, error });
  }
}

/**
 * Test specific user accessibility (User 22 as requested)
 */
export async function testUser22Accessibility(): Promise<UserStatus> {
  try {
    logger.info('Testing User 22 accessibility');
    
    const user22 = await findUserById(22);
    
    if (!user22) {
      logger.error('User 22 not found in database');
      throw new Error('User 22 not found');
    }
    
    const status = await checkUserAccessibility(22, user22.telegram_id);
    
    logger.info('User 22 accessibility status', { 
      userId: 22,
      telegramId: user22.telegram_id,
      username: user22.username,
      status: status.status,
      isAccessible: status.isAccessible 
    });
    
    // Update database with the result
    await updateUserAccessibilityStatus(22, status);
    
    // Track in analytics
    await analyticsService.trackEvent(22, 'accessibility_check', {
      result: status.status,
      isAccessible: status.isAccessible,
      telegramId: user22.telegram_id,
      errorMessage: status.errorMessage || null
    });
    
    return status;
    
  } catch (error) {
    logger.error('Error testing User 22 accessibility', { error });
    throw error;
  }
}

/**
 * Check accessibility for multiple users (batch operation)
 */
export async function checkMultipleUsersAccessibility(userIds: number[]): Promise<Map<number, UserStatus>> {
  const results = new Map<number, UserStatus>();
  
  logger.info('Checking accessibility for multiple users', { userCount: userIds.length });
  
  for (const userId of userIds) {
    try {
      const user = await findUserById(userId);
      const status = await checkUserAccessibility(userId, user.telegram_id);
      
      results.set(userId, status);
      
      // Update database
      await updateUserAccessibilityStatus(userId, status);
      
      // Track in analytics
      await analyticsService.trackEvent(userId, 'accessibility_check', {
        result: status.status,
        isAccessible: status.isAccessible,
        batchCheck: true
      });
      
      // Small delay to avoid hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      logger.error('Error checking user accessibility', { userId, error });
      results.set(userId, {
        isAccessible: false,
        status: 'unknown_error',
        errorMessage: 'Failed to check accessibility',
        lastChecked: new Date()
      });
    }
  }
  
  logger.info('Batch accessibility check completed', { 
    totalUsers: userIds.length,
    activeUsers: Array.from(results.values()).filter(s => s.isAccessible).length,
    blockedUsers: Array.from(results.values()).filter(s => s.status === 'blocked').length
  });
  
  return results;
}

/**
 * Get accessibility statistics for all users
 */
export async function getAccessibilityStatistics(): Promise<{
  total: number;
  active: number;
  blocked: number;
  chatDeleted: number;
  deactivated: number;
  unknown: number;
  neverChecked: number;
}> {
  try {
    const stats = await db('users')
      .select('accessibility_status')
      .count('* as count')
      .groupBy('accessibility_status');
      
    const totalUsers = await db('users').count('* as count').first();
    
    const result = {
      total: parseInt(totalUsers?.count as string) || 0,
      active: 0,
      blocked: 0,
      chatDeleted: 0,
      deactivated: 0,
      unknown: 0,
      neverChecked: 0
    };
    
    stats.forEach(stat => {
      const count = parseInt(stat.count as string);
      switch (stat.accessibility_status) {
        case 'active':
          result.active = count;
          break;
        case 'blocked':
          result.blocked = count;
          break;
        case 'chat_deleted':
          result.chatDeleted = count;
          break;
        case 'deactivated':
          result.deactivated = count;
          break;
        case 'unknown_error':
          result.unknown = count;
          break;
        case null:
        case undefined:
          result.neverChecked = count;
          break;
      }
    });
    
    logger.info('Accessibility statistics retrieved', result);
    return result;
    
  } catch (error) {
    logger.error('Error getting accessibility statistics', { error });
    throw error;
  }
} 