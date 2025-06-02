import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../utils/logger';
import { handleError } from '../../utils/errorHandler';

const SUPPORT_MESSAGE = `
🛠 Поддержка LootPay

📞 Связаться с нами:
@lootpay_support - Telegram
support@lootpay.ru - Email

⏰ Время работы: 24/7
📱 Среднее время ответа: 15 минут
`;

export async function handleSupport(
  bot: TelegramBot,
  chatId: number
): Promise<void> {
  try {
    await bot.sendMessage(chatId, SUPPORT_MESSAGE, {
      reply_markup: {
        inline_keyboard: [[
          { text: '📞 Написать в поддержку', url: 'https://t.me/lootpay_support' }
        ]]
      }
    });
    logger.info('Support command handled', { chatId });
  } catch (error) {
    logger.error('Error handling support command', {
      error,
      chatId
    });
    await handleError(chatId, error as Error);
  }
} 