import { Message } from 'node-telegram-bot-api';
import { getBotInstance } from '../botInstance';
import { findOrCreateUser } from '../../services/user/userService';
import { logger } from '../../utils/logger';
import { getSystemSetting } from '../../services/settings/settingsService';
import { formatRussianCurrency } from '../../utils/locale';

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

    // Get minimum amounts from settings
    const minAmountUSD = Number(await getSystemSetting('min_amount_usd')) || 5;
    const minAmountRUB = Number(await getSystemSetting('min_amount_rub')) || 450;

    // Welcome message with inline keyboard
    const welcomeMessage = `Привет, это 🎮 LootPay!
Бот для быстрого и надёжного пополнения Steam кошелька

Знакомо? Было?
⏳ Всего 5 минут, и баланс в Steam пополнен…
😤 А вместо этого — долгие ожидания, скрытые наценки и тревога, что средства не дойдут. 

✨ С  LootPay такого не будет ✨
⋯⋯⋯⋯⋯⋯⋯⋯
Пополняй Steam за 15 минут
с удобной оплатой, честным курсом и без риска быть обманутым ⏱️

🔹 Минимальная и прозрачная комиссия **10%** — без скрытых наценок 
🔹 Гарантия возврата при сбоях 
🔹 Поддержка 24/7
⋯⋯⋯⋯⋯⋯⋯⋯
💳 Автоматическое зачисление от ${formatRussianCurrency(minAmountRUB)} / ${minAmountUSD} USD — любые РФ-карты или СБП

🔸 Как это работает?
1️⃣ Запусти бота, включи уведомления, введи Steam ID 
2️⃣ Выбери сумму и оплати через СБП 
3️⃣ Получи уведомление о зачислении 🎉 

Пополняй без риска и обмана — вместе с 🎮 LootPay!`;

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