import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../utils/logger';
import { handleStartPayment } from './start';
import { handleQuestionResponse } from '../flows/questionnaire/questionnaireHandler';
import { handleError } from '../../utils/errorHandler';
import { findOrCreateUser } from '../../services/user/userService';

// Handle callback queries
export async function handleCallbackQuery(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery
): Promise<void> {
  try {
    if (!query.message?.chat.id || !query.from?.id) {
      throw new Error('Missing chat or user ID in callback query');
    }

    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const data = query.data;

    if (!data) {
      throw new Error('Missing callback data');
    }

    // Get or create user to get database user.id
    const user = await findOrCreateUser({
      id: telegramId,
      username: query.from?.username,
      first_name: query.from?.first_name,
      last_name: query.from?.last_name
    });

    const userId = user.id; // Use database user.id, not telegram_id

    // Handle questionnaire responses
    if (data.startsWith('q')) {
      const [questionPart, answer] = data.split('_');
      const questionNumber = parseInt(questionPart.substring(1)) as 1 | 2 | 3;
      
      await handleQuestionResponse(bot, chatId, userId, questionNumber, answer);
      return;
    }

    // Handle other button clicks
    switch (data) {
      case 'start_payment':
        await handleStartPayment(bot, chatId, userId);
        break;

      case 'show_history':
        // TODO: Implement history display
        await bot.sendMessage(chatId, '📊 История пополнений будет доступна в ближайшее время');
        break;

      case 'show_support':
        await bot.sendMessage(chatId, `
🛠 Поддержка LootPay

📞 Связаться с нами:
@lootpay_support - Telegram
support@lootpay.ru - Email

⏰ Время работы: 24/7
📱 Среднее время ответа: 15 минут
        `, {
          reply_markup: {
            inline_keyboard: [[
              { text: '📞 Написать в поддержку', url: 'https://t.me/lootpay_support' }
            ]]
          }
        });
        break;

      case 'show_info':
        await bot.sendMessage(chatId, `
📄 О LootPay

LootPay - это сервис для быстрого и безопасного пополнения Steam кошелька через СБП.

💰 Комиссия: 10% от суммы
💳 Минимальная сумма: 5$
⚡️ Мгновенное зачисление
🛡️ Безопасные платежи

📋 Оферта: https://lootpay.ru/terms
❓ FAQ: https://lootpay.ru/faq
        `);
        break;

      default:
        logger.warn('Unknown callback data', { data });
        break;
    }

    // Answer callback query to remove loading state
    await bot.answerCallbackQuery(query.id);

    logger.info('Callback query handled', {
      telegramId,
      userId,
      data
    });
  } catch (error) {
    logger.error('Error handling callback query', {
      error,
      query
    });
    if (query.message?.chat.id) {
      await handleError(query.message.chat.id, error as Error);
    }
  }
} 