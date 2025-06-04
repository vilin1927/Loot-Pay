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

    logger.debug('Processing callback query', { telegramId, data, queryId: query.id });

    // Answer callback query immediately to prevent loading state
    await bot.answerCallbackQuery(query.id);

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
      logger.info('Questionnaire response handled', { telegramId, userId, questionNumber, answer });
      return;
    }

    // Handle other button clicks
    switch (data) {
      case 'start_payment':
      case 'fund_steam':
        await handleStartPayment(bot, chatId, userId);
        break;

      case 'show_history':
      case 'my_transactions':
        // TODO: Implement history display
        await bot.sendMessage(chatId, '📊 История пополнений будет доступна в ближайшее время');
        break;

      case 'show_support':
      case 'support':
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

      case 'main_menu':
        // Return user to main menu by calling start handler
        await handleStartPayment(bot, chatId, userId);
        break;

      case 'steam_login_help':
        await bot.sendMessage(chatId, `
🎮 Помощь с логином Steam

📝 Как найти свой логин Steam:

1️⃣ **Через клиент Steam:**
   • Откройте Steam на компьютере
   • Ваш логин указан в правом верхнем углу

2️⃣ **Через браузер:**
   • Зайдите на steamcommunity.com
   • Ваш логин в URL: steamcommunity.com/id/ВАШ_ЛОГИН/

3️⃣ **Примеры правильных логинов:**
   • nickname123
   • player_2024
   • steam_user

❌ **НЕ используйте:**
   • Email адрес
   • Отображаемое имя
   • Телефон

💡 **Совет:** Логин Steam - это уникальный идентификатор, который вы создали при регистрации
        `, {
          reply_markup: {
            inline_keyboard: [[
              { text: '🏠 Главное меню', callback_data: 'main_menu' }
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
        logger.warn('Unknown callback data', { data, telegramId, userId });
        break;
    }

    logger.info('Callback query handled successfully', {
      telegramId,
      userId,
      data
    });
  } catch (error) {
    logger.error('Error handling callback query', {
      error,
      query: {
        id: query.id,
        data: query.data,
        from: query.from?.id
      }
    });
    if (query.message?.chat.id) {
      await handleError(query.message.chat.id, error as Error);
    }
  }
} 