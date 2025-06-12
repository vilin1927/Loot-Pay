import TelegramBot from 'node-telegram-bot-api';

/**
 * Returns security trust message and options for Telegram sendMessage.
 * Place inline keyboard with a safe payment button (if URL provided)
 * and a FAQ button that triggers `security_faq` callback.
 */
export const securityWidget = (payUrl?: string): { text: string; options: TelegramBot.SendMessageOptions } => {
  const text = `🛡️ БЕЗОПАСНОСТЬ ПЛАТЕЖА:
  ✅ Банковская защита СБП
  ✅ Гарантия возврата средств
  ✅ 500+ успешных операций
  ✅ Партнёр PayDigital.shop`;

  const inline_keyboard: TelegramBot.InlineKeyboardButton[][] = [];
  if (payUrl) {
    inline_keyboard.push([{ text: '💳 Оплатить безопасно', url: payUrl }]);
  }
  inline_keyboard.push([{ text: '❓ Вопросы безопасности', callback_data: 'security_faq' }]);

  const options: TelegramBot.SendMessageOptions = {
    reply_markup: { inline_keyboard }
  };

  return { text, options };
}; 