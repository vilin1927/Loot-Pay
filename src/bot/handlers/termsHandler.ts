import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../utils/logger';
import { handleError } from '../../utils/errorHandler';
import { getSystemSetting } from '../../services/settings/settingsService';

async function getTermsMessage(): Promise<string> {
  const commissionPercent = await getSystemSetting('commission_percent') || '10';
  return `
📄 Условия использования LootPay

1. КОМИССИЯ: ${commissionPercent}% от суммы пополнения
2. ВОЗВРАТ: Возможен в течение 24 часов при технических сбоях
3. ОТВЕТСТВЕННОСТЬ: Пользователь отвечает за правильность Steam логина
4. ПОДДЕРЖКА: @lootpay_support

Полная версия: https://lootpay.ru/terms
`;
}

export async function handleTerms(
  bot: TelegramBot,
  chatId: number
): Promise<void> {
  try {
    const termsMessage = await getTermsMessage();
    await bot.sendMessage(chatId, termsMessage);
    logger.info('Terms command handled', { chatId });
  } catch (error) {
    logger.error('Error handling terms command', {
      error,
      chatId
    });
    await handleError(chatId, error as Error);
  }
} 