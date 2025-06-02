import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../utils/logger';
import { setState } from '../../services/state/stateService';
import { validateSteamUsername } from '../../services/paydigital/paydigitalService';

const STEAM_USERNAME_PROMPT = `
🎮 Введите логин вашего Steam аккаунта:

❗️ Убедитесь, что логин указан верно
❗️ Логин должен быть публичным
❗️ Аккаунт должен быть не менее 30 дней
`;

const STEAM_USERNAME_ERROR = `
❌ Ошибка: Не удалось найти аккаунт Steam

Проверьте:
1. Правильность написания логина
2. Публичность профиля
3. Возраст аккаунта (от 30 дней)

Попробуйте еще раз или обратитесь в поддержку.
`;

export async function handleSteamUsernameRequest(
  bot: TelegramBot,
  chatId: number,
  userId: number,
  username?: string
): Promise<void> {
  try {
    if (!username) {
      // Initial prompt
      await bot.sendMessage(chatId, STEAM_USERNAME_PROMPT);
      await setState(userId, 'STEAM_USERNAME', {});
      return;
    }

    // Validate username
    const isValid = await validateSteamUsername(username);
    if (!isValid) {
      await bot.sendMessage(chatId, STEAM_USERNAME_ERROR);
      return;
    }

    // Store username and move to amount selection
    await setState(userId, 'AMOUNT_SELECTION', { steamUsername: username });
    await handleAmountSelection(bot, chatId, userId);

    logger.info('Steam username validated', {
      userId,
      username
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