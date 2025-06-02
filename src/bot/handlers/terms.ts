import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../utils/logger';

const TERMS_MESSAGE = `
📄 Условия использования LootPay

1. КОМИССИЯ: 10% от суммы пополнения
2. ВОЗВРАТ: Возможен в течение 24 часов при технических сбоях
3. ОТВЕТСТВЕННОСТЬ: Пользователь отвечает за правильность Steam логина
4. ПОДДЕРЖКА: @lootpay_support

Полная версия: https://lootpay.ru/terms
`;

export async function handleTerms(
  bot: TelegramBot,
  chatId: number
): Promise<void> {
  try {
    await bot.sendMessage(chatId, TERMS_MESSAGE);
    logger.info('Terms message sent', { chatId });
  } catch (error) {
    logger.error('Error sending terms message', {
      error,
      chatId
    });
    throw error;
  }
} 