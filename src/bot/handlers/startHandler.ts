import { Message } from 'node-telegram-bot-api';
import bot from '../index';
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

    // Welcome message with inline keyboard
    const welcomeMessage = `
🎮 Добро пожаловать в LootPay!

Пополняйте Steam быстро и безопасно через СБП.

💰 Комиссия: 10% от суммы
⚡️ Скорость: Мгновенное зачисление
🔒 Безопасность: Гарантированная защита

Выберите действие:
    `;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '💳 Пополнить Steam', callback_data: 'fund_steam' },
          { text: '📊 Мои транзакции', callback_data: 'my_transactions' }
        ],
        [
          { text: '❓ Помощь', callback_data: 'help' },
          { text: '📞 Поддержка', callback_data: 'support' }
        ]
      ]
    };

    await bot.sendMessage(msg.chat.id, welcomeMessage, {
      parse_mode: 'HTML',
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
    
    // Send error message to user
    await bot.sendMessage(
      msg.chat.id,
      '😔 Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
    );
  }
} 