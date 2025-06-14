import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../utils/logger';
import { setState } from '../../services/state/stateService';
import { payDigitalService } from '../../services/paydigital/paydigitalService';
import { getSystemSetting } from '../../services/settings/settingsService';
import { analyticsService } from '../../services/analytics/analyticsService';
import { securityWidget } from '../ui/securityWidget';

// Type for Steam validation result
interface SteamValidationResult {
  isValid: boolean;
  transactionId?: string;
  message?: string;
}

// Input validation and sanitization
function sanitizeSteamUsername(input: string): string {
  // Remove leading/trailing whitespace
  let sanitized = input.trim();
  
  // Remove potentially dangerous characters
  sanitized = sanitized.replace(/[<>'"&]/g, '');
  
  // Steam usernames are alphanumeric with underscores, hyphens, and dots
  sanitized = sanitized.replace(/[^a-zA-Z0-9_.-]/g, '');
  
  return sanitized;
}

function validateSteamUsernameFormat(username: string): { isValid: boolean; message?: string } {
  // Basic format validation
  if (!username || username.length === 0) {
    return { isValid: false, message: 'Логин не может быть пустым' };
  }
  
  if (username.length < 2) {
    return { isValid: false, message: 'Логин слишком короткий (минимум 2 символа)' };
  }
  
  if (username.length > 32) {
    return { isValid: false, message: 'Логин слишком длинный (максимум 32 символа)' };
  }
  
  // Check for valid Steam username characters
  const validPattern = /^[a-zA-Z0-9_.-]+$/;
  if (!validPattern.test(username)) {
    return { isValid: false, message: 'Логин содержит недопустимые символы. Используйте только буквы, цифры, точки, дефисы и подчёркивания' };
  }
  
  return { isValid: true };
}

const STEAM_USERNAME_PROMPT = `🧩 Введите логин аккаунта Steam:

📖 Нужна помощь? Нажмите "Как найти логин"

🎯 Для успешного пополнения:
✅ Скопируйте точный логин
✅ Проверьте дважды
✅ Убедитесь в правильности

💡 Правильный логин = быстрое зачисление`;

const STEAM_USERNAME_HELP = `🔎 Где взять логин Steam?

Логин — это уникальный идентификатор, который вы указывали при регистрации. Он нужен для пополнения вашего аккаунта.

Вот как его узнать:

1️⃣ Откройте приложение Steam 
2️⃣ Нажмите на свой ник в правом верхнем углу 
3️⃣ Выберите «Об аккаунте» 
4️⃣ В разделе «Аккаунт пользователя» вы увидите логин

📎 [Открыть страницу аккаунта в Steam](https://store.steampowered.com/account/) 

🧩 [Перейти к авторизации](https://store.steampowered.com/login/?redir=account%2F&redir_ssl=1)`;

const STEAM_USERNAME_ERROR = `⚠️ Не удалось найти такой аккаунт в Steam.

Проверь правильность логина (без пробелов и ошибок) и попробуй снова.

Если не получается — [вот инструкция, где найти логин](https://store.steampowered.com/account/)`;

const STEAM_USERNAME_SUCCESS = async (username: string) => {
  const minAmount = Number(await getSystemSetting('min_amount_usd')) || 1;
  const maxAmount = Number(await getSystemSetting('max_amount_usd')) || 25;
  
  return `✅ Аккаунт найден!
👤 Логин: ${username}
🎮 Всё готово к пополнению!

💰 Выберите сумму пополнения ниже:
— Минимум: ${minAmount} USD 
— Максимум: ${maxAmount} USD
Выберите один из вариантов ниже или введите свою сумму 👇`;
};

// Enhanced validation function with better error handling
export async function validateSteamUsernameWithTransactionId(username: string): Promise<SteamValidationResult> {
  try {
    const result = await payDigitalService.validateSteamUsernameWithTransactionId(username);
    
    // If validation failed, provide specific error messages based on common issues
    if (!result.isValid) {
      // Check for specific error patterns in the result
      if (result.message?.includes('not found') || result.message?.includes('404')) {
        return { 
          isValid: false, 
          message: 'Steam аккаунт не найден. Проверьте правильность логина и убедитесь, что профиль публичный.' 
        };
      }
      
      if (result.message?.includes('restricted') || result.message?.includes('limited')) {
        return { 
          isValid: false, 
          message: 'Аккаунт Steam ограничен. Обратитесь в поддержку для получения помощи.' 
        };
      }
      
      if (result.message?.includes('timeout') || result.message?.includes('network')) {
        return { 
          isValid: false, 
          message: 'Временная ошибка подключения к Steam. Попробуйте через несколько секунд.' 
        };
      }
      
      // Default error message
      return { 
        isValid: false, 
        message: 'Не удалось проверить аккаунт Steam. Проверьте логин и попробуйте снова.' 
      };
    }
    
    return result;
  } catch (error) {
    logger.error('Error in Steam validation', { error, username });
    
    // Return user-friendly error for any validation failures
    return { 
      isValid: false, 
      message: 'Временная ошибка при проверке аккаунта. Попробуйте позже или обратитесь в поддержку.' 
    };
  }
}

// LEGACY: Export validateSteamUsername function for backward compatibility
export async function validateSteamUsername(username: string): Promise<boolean> {
  return await payDigitalService.validateSteamUsername(username);
}

export async function handleSteamUsernameRequest(
  bot: TelegramBot,
  chatId: number,
  userId: number,
  username?: string
): Promise<void> {
  try {
    if (!username) {
      // Initial prompt
      await bot.sendMessage(chatId, STEAM_USERNAME_PROMPT, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🧠 Как найти логин?', callback_data: 'steam_login_help' },
              { text: 'ℹ️ Меню', callback_data: 'main_menu' }
            ]
          ]
        }
      });
      await setState(userId, 'STEAM_USERNAME', {});
      return;
    }

    // Sanitize input to prevent injection attacks
    const sanitizedUsername = sanitizeSteamUsername(username);
    
    // Validate username format first
    const formatValidation = validateSteamUsernameFormat(sanitizedUsername);
    if (!formatValidation.isValid) {
      await analyticsService.trackEvent(userId, 'steam_validation_failed', {
        reason: 'invalid_format',
        originalInput: username,
        sanitizedInput: sanitizedUsername,
        error: formatValidation.message
      });
      
      await bot.sendMessage(chatId, `❌ ${formatValidation.message}

Попробуйте ещё раз и убедитесь, что логин введён правильно.`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🧠 Как найти логин?', callback_data: 'steam_login_help' },
              { text: '🔄 Попробовать снова', callback_data: 'steam_username' }
            ]
          ]
        }
      });
      return;
    }

    // Track validation attempt
    await analyticsService.trackSteamValidationAttempted(userId, sanitizedUsername);

    // Validate username with PayDigital service
    const validation = await validateSteamUsernameWithTransactionId(sanitizedUsername);
    
    if (!validation.isValid) {
      await analyticsService.trackEvent(userId, 'steam_validation_failed', {
        reason: 'service_validation_failed',
        username: sanitizedUsername,
        error: validation.message
      });
      
      // Use specific error message from validation or fallback to default
      const errorMessage = validation.message || STEAM_USERNAME_ERROR;
      
      await bot.sendMessage(chatId, `❌ ${errorMessage}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🧠 Как найти логин?', callback_data: 'steam_login_help' },
              { text: '🔄 Попробовать снова', callback_data: 'steam_username' }
            ],
            [
              { text: '❓ Поддержка', callback_data: 'support' }
            ]
          ]
        }
      });
      return;
    }

    // Track successful validation
    await analyticsService.trackSteamValidationSuccess(userId, sanitizedUsername, validation.transactionId);

    // Store BOTH sanitized username AND transactionId for payment
    await setState(userId, 'AMOUNT_SELECTION', { 
      steamUsername: sanitizedUsername,
      transactionId: validation.transactionId
    });
    
    // Fixed preset amounts: 1, 10, 15, 20 USD
    function getPresetAmounts(): number[] {
      return [1, 10, 15, 20];
    }
    
    const presetAmounts = getPresetAmounts();
    
    // Build dynamic keyboard
    const keyboard: any[][] = [];
    
    // Add preset amounts in rows of 2
    for (let i = 0; i < presetAmounts.length; i += 2) {
      const row = [];
      row.push({ text: `${presetAmounts[i]} USD`, callback_data: `amount_${presetAmounts[i]}` });
      if (presetAmounts[i + 1]) {
        row.push({ text: `${presetAmounts[i + 1]} USD`, callback_data: `amount_${presetAmounts[i + 1]}` });
      }
      keyboard.push(row);
    }
    
    // Add custom amount and change login buttons
    keyboard.push([{ text: 'Своя сумма 🪙', callback_data: 'amount_custom' }]);
    keyboard.push([{ text: 'Ввести другой логин 🔄', callback_data: 'steam_username' }]);

    // Send success message with amount selection buttons
    const successMessage = await STEAM_USERNAME_SUCCESS(sanitizedUsername);
    await bot.sendMessage(chatId, successMessage, {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

    // Show security trust widget after username validation (phase-2)
    const secMsg = securityWidget();
    await bot.sendMessage(chatId, secMsg.text, secMsg.options);

    logger.info('Steam username validated with transactionId stored', {
      userId,
      username,
      transactionId: validation.transactionId
    });

  } catch (error) {
    logger.error('Error handling Steam username', {
      error,
      userId,
      username
    });
    throw error;
  }
}

export async function handleSteamUsernameHelp(
  bot: TelegramBot,
  chatId: number,
  userId: number
): Promise<void> {
  try {
    await bot.sendMessage(chatId, STEAM_USERNAME_HELP, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Перейти к пополнению 🎮', callback_data: 'steam_username' }]
        ]
      }
    });
  } catch (error) {
    logger.error('Error sending Steam username help', {
      error,
      userId
    });
    throw error;
  }
} 