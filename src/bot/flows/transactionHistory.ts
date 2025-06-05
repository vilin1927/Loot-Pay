import TelegramBot from 'node-telegram-bot-api';
import { getUserTransactions } from '../../services/transaction/transactionService';
import { logger } from '../../utils/logger';

export async function showTransactionHistory(
  bot: TelegramBot,
  chatId: number,
  userId: number,
  page: number = 0
) {
  try {
    const { transactions, total, hasMore } = await getUserTransactions(userId, 3, page * 3);

    if (transactions.length === 0) {
      await bot.sendMessage(chatId, `У вас пока нет ни одного пополнения 😔
Но это легко исправить! Пополните Steam-кошелёк за пару минут — быстро, безопасно и с честным курсом 💳
👇 Выберите действие ниже:`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💰 Пополнить сейчас', callback_data: 'fund_steam' }],
            [{ text: '🔄 В начало', callback_data: 'main_menu' }]
          ]
        }
      });
      return;
    }

    let message = `📊 История пополнений (${total} успешных)\n\n`;
    
    transactions.forEach((tx) => {
      const date = new Date(tx.created_at).toLocaleDateString('ru-RU');
      // Since we only show completed transactions, always show ✅
      
      message += `✅ ${date}\n`;
      message += `💰 ${tx.amount_usd} USD → ${tx.amount_rub + tx.commission_rub}₽\n`;
      message += `🎮 ${tx.steam_username}\n\n`;
    });

    const keyboard = [];
    
    // Pagination buttons
    const navButtons = [];
    if (page > 0) navButtons.push({ text: '⬅️ Назад', callback_data: `history_page_${page - 1}` });
    if (hasMore) navButtons.push({ text: 'Далее ➡️', callback_data: `history_page_${page + 1}` });
    if (navButtons.length > 0) keyboard.push(navButtons);

    // Action buttons
    keyboard.push([
      { text: '💰 Новое пополнение', callback_data: 'fund_steam' },
      { text: '🏠 Главное меню', callback_data: 'main_menu' }
    ]);

    await bot.sendMessage(chatId, message, {
      reply_markup: { inline_keyboard: keyboard }
    });

  } catch (error) {
    logger.error('Error showing transaction history', { error, userId });
    await bot.sendMessage(chatId, '❌ Ошибка загрузки истории. Попробуйте позже.');
  }
} 