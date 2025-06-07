import { logger } from './logger';
import { clearState } from '../services/state/stateService';
import { getBotInstance } from '../bot/botInstance';
import { analyticsService } from '../services/analytics/analyticsService';

// Error types that require state clearing
const STATE_CLEARING_ERRORS = [
  'INVALID_STATE',
  'EXPIRED_STATE',
  'PAYMENT_FAILED',
  'API_ERROR'
];

// Enhanced user-friendly error messages with specific actions
const ERROR_MESSAGES = {
  DEFAULT: '🚫 Произошла неожиданная ошибка. Попробуйте позже или обратитесь в поддержку.',
  PAYMENT: {
    GENERAL: '💳 Ошибка при обработке платежа. Попробуйте еще раз через несколько минут.',
    DUPLICATE: '💳 Этот платёж уже обрабатывается. Пожалуйста, не создавайте дублирующие платежи.',
    INSUFFICIENT_FUNDS: '💳 Недостаточно средств. Проверьте баланс вашего счёта.',
    TIMEOUT: '💳 Время ожидания истекло. Попробуйте создать новый платёж.',
    INVALID_PARAMS: '💳 Неверные параметры платежа. Попробуйте создать новый заказ.'
  },
  STEAM: {
    GENERAL: '🎮 Ошибка при проверке Steam аккаунта. Проверьте логин и попробуйте снова.',
    NOT_FOUND: '🎮 Steam аккаунт не найден. Убедитесь, что логин введён правильно.',
    RESTRICTED: '🎮 Аккаунт Steam ограничен. Обратитесь в поддержку Steam.',
    TIMEOUT: '🎮 Временная ошибка подключения к Steam. Попробуйте через несколько секунд.',
    INVALID_FORMAT: '🎮 Неверный формат логина Steam. Используйте только допустимые символы.'
  },
  API: {
    GENERAL: '🌐 Временная ошибка сервиса. Попробуйте через несколько минут.',
    EXCHANGE_RATE: '💱 Ошибка получения курса валют. Попробуйте через несколько секунд.',
    NETWORK: '🌐 Проблемы с подключением. Проверьте интернет-соединение.'
  },
  VALIDATION: {
    GENERAL: '❌ Неверные данные. Проверьте введённую информацию.',
    AMOUNT: '💰 Неверная сумма. Введите корректное значение.',
    USERNAME: '👤 Неверный формат логина. Используйте только допустимые символы.',
    LIMIT: '⚠️ Сумма вне допустимых пределов. Выберите сумму в указанном диапазоне.'
  },
  STATE: '⏰ Сессия истекла. Нажмите /start чтобы начать заново.',
  DATABASE: '🗄️ Ошибка базы данных. Попробуйте позже или обратитесь в поддержку.'
};

/**
 * Enhanced error classification and message selection
 */
function getErrorMessage(error: Error): string {
  const message = error.message.toLowerCase();
  
  // Steam-related errors
  if (message.includes('steam')) {
    if (message.includes('not found') || message.includes('404')) {
      return ERROR_MESSAGES.STEAM.NOT_FOUND;
    }
    if (message.includes('restricted') || message.includes('limited')) {
      return ERROR_MESSAGES.STEAM.RESTRICTED;
    }
    if (message.includes('timeout') || message.includes('network')) {
      return ERROR_MESSAGES.STEAM.TIMEOUT;
    }
    if (message.includes('format') || message.includes('characters')) {
      return ERROR_MESSAGES.STEAM.INVALID_FORMAT;
    }
    return ERROR_MESSAGES.STEAM.GENERAL;
  }
  
  // Payment-related errors
  if (message.includes('payment') || message.includes('платеж')) {
    if (message.includes('duplicate') || message.includes('уже обработана')) {
      return ERROR_MESSAGES.PAYMENT.DUPLICATE;
    }
    if (message.includes('insufficient') || message.includes('недостаточно')) {
      return ERROR_MESSAGES.PAYMENT.INSUFFICIENT_FUNDS;
    }
    if (message.includes('timeout') || message.includes('время')) {
      return ERROR_MESSAGES.PAYMENT.TIMEOUT;
    }
    if (message.includes('invalid') || message.includes('неверн')) {
      return ERROR_MESSAGES.PAYMENT.INVALID_PARAMS;
    }
    return ERROR_MESSAGES.PAYMENT.GENERAL;
  }
  
  // API-related errors
  if (message.includes('api') || message.includes('service')) {
    if (message.includes('exchange') || message.includes('rate')) {
      return ERROR_MESSAGES.API.EXCHANGE_RATE;
    }
    if (message.includes('network') || message.includes('connection')) {
      return ERROR_MESSAGES.API.NETWORK;
    }
    return ERROR_MESSAGES.API.GENERAL;
  }
  
  // Validation errors
  if (message.includes('validation') || message.includes('invalid')) {
    if (message.includes('amount') || message.includes('сумма')) {
      return ERROR_MESSAGES.VALIDATION.AMOUNT;
    }
    if (message.includes('username') || message.includes('логин')) {
      return ERROR_MESSAGES.VALIDATION.USERNAME;
    }
    if (message.includes('limit') || message.includes('предел')) {
      return ERROR_MESSAGES.VALIDATION.LIMIT;
    }
    return ERROR_MESSAGES.VALIDATION.GENERAL;
  }
  
  // State errors
  if (message.includes('state') || message.includes('session') || message.includes('сессия')) {
    return ERROR_MESSAGES.STATE;
  }
  
  // Database errors
  if (message.includes('database') || message.includes('sql') || message.includes('db')) {
    return ERROR_MESSAGES.DATABASE;
  }
  
  return ERROR_MESSAGES.DEFAULT;
}

/**
 * Enhanced bot error handler with analytics and improved classification
 */
export async function handleBotError(
  error: Error,
  chatId: number,
  userId: number,
  context: {
    action?: string;
    state?: string;
    data?: any;
    shouldClearState?: boolean;
  } = {}
): Promise<void> {
  try {
    // Track error in analytics
    await analyticsService.trackEvent(userId, 'bot_error_occurred', {
      errorName: error.name,
      errorMessage: error.message,
      action: context.action,
      state: context.state,
      data: context.data,
      timestamp: new Date().toISOString()
    });

    // Get bot instance
    const bot = await getBotInstance();

    // Log error details with enhanced context
    logger.error('Bot error occurred', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      userId,
      chatId,
      context,
      timestamp: new Date().toISOString()
    });

    // Get appropriate error message
    const errorMessage = getErrorMessage(error);
    let shouldClearState = context.shouldClearState;

    // Determine if state should be cleared
    if (error.message.includes('state') || STATE_CLEARING_ERRORS.includes(error.name)) {
      shouldClearState = true;
    }

    // Clear state if needed
    if (shouldClearState) {
      await clearState(userId);
      logger.info('User state cleared after error', {
        userId,
        error: error.name
      });
    }

    // Send user-friendly message with appropriate keyboard
    const keyboard = [];
    
    // Add retry button for certain error types
    if (error.message.includes('timeout') || error.message.includes('network')) {
      keyboard.push([{ text: '🔄 Попробовать снова', callback_data: 'retry_last_action' }]);
    }
    
    // Add support button for critical errors
    if (error.name === 'API_ERROR' || error.name === 'PAYMENT_FAILED' || 
        error.message.includes('critical') || error.message.includes('database')) {
      keyboard.push([{ text: '❓ Поддержка', callback_data: 'support' }]);
    }
    
    // Always add main menu button
    keyboard.push([{ text: '🏠 Главное меню', callback_data: 'main_menu' }]);

    await bot.sendMessage(chatId, errorMessage, {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

  } catch (handlerError) {
    // Log error in error handler
    logger.error('Error in error handler', {
      originalError: error,
      handlerError,
      userId,
      chatId
    });

    // Send fallback message
    try {
      const bot = await getBotInstance();
      await bot.sendMessage(
        chatId,
        '😔 Произошла критическая ошибка. Пожалуйста, обратитесь в поддержку: @lootpay_support'
      );
    } catch (sendError) {
      logger.error('Failed to send error message', {
        error: sendError,
        userId,
        chatId
      });
    }
  }
}

/**
 * Create custom error with type
 */
export class BotError extends Error {
  constructor(
    message: string,
    public type: string,
    public context?: any
  ) {
    super(message);
    this.name = type;
  }
}

// Export error types
export const ErrorTypes = {
  INVALID_STATE: 'INVALID_STATE',
  EXPIRED_STATE: 'EXPIRED_STATE',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  API_ERROR: 'API_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  STEAM_ERROR: 'STEAM_ERROR'
} as const;

export async function handleError(
  chatId: number,
  error: Error,
  context?: Record<string, any>
) {
  try {
    // Get bot instance
    const bot = await getBotInstance();

    // Log error
    logger.error('Bot error occurred', {
      error: error.message,
      stack: error.stack,
      context
    });

    // Send error message to user
    await bot.sendMessage(
      chatId,
      '😔 Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
    );
  } catch (sendError) {
    // Log error sending error
    logger.error('Failed to send error message', {
      error: sendError,
      originalError: error
    });
  }
} 