import { Message } from 'node-telegram-bot-api';
import { getBotInstance } from '../botInstance';
import { findOrCreateUser } from '../../services/user/userService';
import { logger } from '../../utils/logger';

export async function handleStartCommand(msg: Message) {
  try {
    const telegramId = msg.from?.id;
    if (!telegramId) {
      logger.warn('Received /start without user ID');
      return;
    }

    // Register or get user
    const user = await findOrCreateUser({
      id: telegramId,
      username: msg.from?.username,
      first_name: msg.from?.first_name,
      last_name: msg.from?.last_name
    });

    // Get bot instance
    const bot = await getBotInstance();

    // Welcome message with inline keyboard
    const welcomeMessage = `Привет, это 🎮 LootPay!

Пополняй Steam за 15 минут
с удобной оплатой, честным курсом и без риска быть обманутым ⏱️

• Комиссия 10% — самая низкая на рынке
• Гарантия возврата при сбоях 
• Поддержка 24/7

Как это работает?
⚡️Введи Steam ID 
⚡️Выбери сумму и оплати через СБП 
⚡️Получи уведомление о зачислении 🎉
⚡️ Участвуй в розыгрыше Арканы на Рубика — или получай гарантированный бонус **до $10**, если участников меньше 50! 🎁

⬇️ Нажми ниже и пополняй с 🎮 LootPay!`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '💰 Пополнить Steam', callback_data: 'fund_steam' },
          { text: '📊 История пополнений', callback_data: 'my_transactions' }
        ],
        [
          { text: '❓ Поддержка', callback_data: 'support' },
          { text: '📄 О нас / Оферта/ FAQ', callback_data: 'about' }
        ]
      ]
    };

    await bot.sendMessage(msg.chat.id, welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    logger.info('Start command handled', {
      telegramId,
      userId: user.id,
      username: user.username
    });

  } catch (error) {
    logger.error('Error handling start command', {
      error,
      telegramId: msg.from?.id
    });
    
    // Get bot instance for error message
    const bot = await getBotInstance();
    
    // Send error message to user
    await bot.sendMessage(
      msg.chat.id,
      '😔 Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
    );
  }
} 