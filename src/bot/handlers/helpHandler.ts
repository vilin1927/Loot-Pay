import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../utils/logger';
import { handleError } from '../../utils/errorHandler';

const HELP_MESSAGE = `
❓ Помощь по LootPay

🎮 Основные команды:
/start - Вернуться в главное меню
/help - Показать эту справку
/terms - Условия использования
/support - Связаться с поддержкой

💰 Как пополнить Steam:
1. Нажмите "Пополнить Steam"
2. Введите логин Steam аккаунта
3. Выберите сумму пополнения
4. Оплатите через СБП
`;

export async function handleHelp(
  bot: TelegramBot,
  chatId: number
): Promise<void> {
  try {
    await bot.sendMessage(chatId, HELP_MESSAGE);
    logger.info('Help command handled', { chatId });
  } catch (error) {
    logger.error('Error handling help command', {
      error,
      chatId
    });
    await handleError(chatId, error as Error);
  }
} 