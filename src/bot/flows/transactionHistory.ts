import TelegramBot from 'node-telegram-bot-api';
import { getUserTransactions } from '../../services/transaction/transactionService';
import { logger } from '../../utils/logger';
import { formatRussianCurrency } from '../../utils/locale';

export async function showTransactionHistory(
  bot: TelegramBot,
  chatId: number,
  userId: number,
  page: number = 0
) {
  try {
    const { transactions, total, hasMore } = await getUserTransactions(userId, 3, page * 3);

    if (transactions.length === 0) {
      await bot.sendMessage(chatId, `🔍 История пополнений пуста

Ещё ни одного пополнения не было совершено. Начните пользоваться LootPay прямо сейчас!

🎮 **Почему стоит попробовать:**
• Быстрое пополнение за 5-15 минут
• Честная комиссия без скрытых наценок  
• Поддержка 24/7 и гарантия возврата
• Удобная оплата СБП с любой карты РФ

💡 **Совет:** Начните с небольшой суммы, чтобы убедиться в качестве сервиса!`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💰 Сделать первое пополнение', callback_data: 'fund_steam' }],
            [{ text: '❓ Поддержка', callback_data: 'support' }, { text: '🏠 Главное меню', callback_data: 'main_menu' }]
          ]
        }
      });
      return;
    }

    // Calculate summary statistics
    const totalUSDSpent = transactions.reduce((sum, tx) => sum + tx.amount_usd, 0);
    const totalRUBSpent = transactions.reduce((sum, tx) => sum + tx.amount_rub + tx.commission_rub, 0);
    const averageUSD = transactions.length > 0 ? totalUSDSpent / transactions.length : 0;
    const mostRecentDate = transactions.length > 0 ? new Date(transactions[0].created_at) : null;

    let message = `📊 История пополнений\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📈 **Статистика:**\n`;
    message += `• Всего операций: ${total}\n`;
    message += `• Потрачено: ${totalUSDSpent} USD (${formatRussianCurrency(totalRUBSpent)})\n`;
    if (transactions.length > 0) {
      message += `• Средний чек: ${averageUSD.toFixed(1)} USD\n`;
      message += `• Последнее пополнение: ${mostRecentDate?.toLocaleDateString('ru-RU', {
        day: '2-digit', month: 'long', year: 'numeric'
      })}\n`;
    }
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    transactions.forEach((tx, index) => {
      const date = new Date(tx.created_at).toLocaleDateString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
      const time = new Date(tx.created_at).toLocaleTimeString('ru-RU', {
        hour: '2-digit', minute: '2-digit'
      });
      
      message += `${page * 3 + index + 1}. ✅ ${date} в ${time}\n`;
      message += `   💰 ${tx.amount_usd} USD → ${formatRussianCurrency(tx.amount_rub + tx.commission_rub)}\n`;
      message += `   🎮 ${tx.steam_username}\n`;
      message += `   📊 Курс: ${tx.exchange_rate?.toFixed(2) || 'н/д'}₽/$\n\n`;
    });

    const keyboard = [];
    
    // Pagination buttons
    const navButtons = [];
    if (page > 0) navButtons.push({ text: '⬅️ Назад', callback_data: `history_page_${page - 1}` });
    if (hasMore) navButtons.push({ text: 'Далее ➡️', callback_data: `history_page_${page + 1}` });
    if (navButtons.length > 0) keyboard.push(navButtons);

    // Action buttons
    keyboard.push([
      { text: '💰 Новое пополнение', callback_data: 'fund_steam' }
    ]);
    
    // Future expansion: transaction details
    // keyboard.push([
    //   { text: '📋 Детали операций', callback_data: 'transaction_details' }
    // ]);
    
    keyboard.push([
      { text: '🔄 Обновить', callback_data: 'my_transactions' },
      { text: '🏠 Главное меню', callback_data: 'main_menu' }
    ]);

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });

  } catch (error) {
    logger.error('Error showing transaction history', { error, userId });
    await bot.sendMessage(chatId, `❌ Не удалось загрузить историю операций

Возможные причины:
• Временные технические проблемы
• Проблемы с подключением к базе данных

Попробуйте обновить через несколько секунд или обратитесь в поддержку, если проблема не исчезает.`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔄 Попробовать снова', callback_data: 'my_transactions' },
            { text: '❓ Поддержка', callback_data: 'support' }
          ],
          [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
        ]
      }
    });
  }
} 