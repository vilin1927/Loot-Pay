import { logger } from './logger';
import { clearState } from '../services/state/stateService';
import { getBotInstance } from '../bot/botInstance';

// Error types that require state clearing
const STATE_CLEARING_ERRORS = [
  'INVALID_STATE',
  'EXPIRED_STATE',
  'PAYMENT_FAILED',
  'API_ERROR'
];

// User-friendly error messages
const ERROR_MESSAGES = {
  DEFAULT: '🚫 Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку.',
  PAYMENT: '🚫 Ошибка при обработке платежа. Пожалуйста, попробуйте еще раз или обратитесь в поддержку.',
  STEAM: '🚫 Ошибка при проверке Steam аккаунта. Пожалуйста, проверьте логин и попробуйте снова.',
  API: '🚫 Временная ошибка сервиса. Пожалуйста, попробуйте через несколько минут.',
  VALIDATION: '🚫 Неверные данные. Пожалуйста, проверьте введенную информацию.',
  STATE: '🚫 Сессия истекла. Пожалуйста, начните заново.'
};

/**
 * Handle bot errors with logging and user feedback
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
    // Get bot instance
    const bot = await getBotInstance();

    // Log error details
    logger.error('Bot error occurred', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      userId,
      chatId,
      context
    });

    // Determine error type and message
    let errorMessage = ERROR_MESSAGES.DEFAULT;
    let shouldClearState = context.shouldClearState;

    if (error.message.includes('Steam')) {
      errorMessage = ERROR_MESSAGES.STEAM;
    } else if (error.message.includes('payment')) {
      errorMessage = ERROR_MESSAGES.PAYMENT;
    } else if (error.message.includes('API')) {
      errorMessage = ERROR_MESSAGES.API;
    } else if (error.message.includes('validation')) {
      errorMessage = ERROR_MESSAGES.VALIDATION;
    } else if (error.message.includes('state')) {
      errorMessage = ERROR_MESSAGES.STATE;
      shouldClearState = true;
    }

    // Clear state if needed
    if (shouldClearState || STATE_CLEARING_ERRORS.includes(error.name)) {
      await clearState(userId);
      logger.info('User state cleared after error', {
        userId,
        error: error.name
      });
    }

    // Send user-friendly message
    await bot.sendMessage(chatId, errorMessage);

    // Add support button for critical errors
    if (error.name === 'API_ERROR' || error.name === 'PAYMENT_FAILED') {
      await bot.sendMessage(
        chatId,
        '📞 Если проблема повторяется, обратитесь в поддержку:',
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '🛠 Поддержка', url: 'https://t.me/lootpay_support' }
            ]]
          }
        }
      );
    }

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