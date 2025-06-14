import TelegramBot from 'node-telegram-bot-api';
import { getUserTransactions } from '../../services/transaction/transactionService';
import { logger } from '../../utils/logger';
import { formatRussianCurrency, formatMoscowTime } from '../../utils/locale';
import { analyticsService } from '../../services/analytics/analyticsService';

export async function showTransactionHistory(
  bot: TelegramBot,
  chatId: number,
  userId: number,
  page: number = 0
) {
  try {
    const { transactions, total, hasMore } = await getUserTransactions(userId, 3, page * 3);

    // Track transaction history viewing analytics
    try {
      await analyticsService.trackEvent(userId, 'transaction_history_viewed', {
        page: page,
        total_transactions: total,
        transactions_on_page: transactions.length,
        has_more: hasMore,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.warn('Transaction history analytics failed', { error, userId, page });
    }

    if (transactions.length === 0) {
      await bot.sendMessage(chatId, `🔍 История пополнений пуста

Ещё ни одного пополнения не было совершено. Начните пользоваться LootPay прямо сейчас!`, {
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

    // Calculate summary statistics (convert strings to numbers)
    const totalUSDSpent = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount_usd.toString()), 0);
    const totalRUBSpent = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount_rub.toString()) + parseFloat(tx.commission_rub.toString()), 0);
    const averageUSD = transactions.length > 0 ? totalUSDSpent / transactions.length : 0;
    const mostRecentDate = transactions.length > 0 ? new Date(transactions[0].created_at) : null;

    let message = `📊 История пополнений\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📈 **Статистика:**\n`;
    message += `• Всего операций: ${total}\n`;
    message += `• Потрачено: ${totalUSDSpent} USD (${formatRussianCurrency(totalRUBSpent)})\n`;
    if (transactions.length > 0) {
      message += `• Средний чек: ${averageUSD.toFixed(1)} USD\n`;
      const lastTransactionDate = mostRecentDate?.toLocaleDateString('ru-RU', {
        day: '2-digit', 
        month: 'long', 
        year: 'numeric',
        timeZone: 'Europe/Moscow'
      });
      message += `• Последнее пополнение: ${lastTransactionDate} (МСК)\n`;
    }
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    transactions.forEach((tx, index) => {
      const moscowDateTime = formatMoscowTime(new Date(tx.created_at));
      const [date, time] = moscowDateTime.split(', ');
      
      // Calculate commission percentage for display (convert strings to numbers)
      const amountRub = parseFloat(tx.amount_rub.toString());
      const commissionRub = parseFloat(tx.commission_rub.toString());
      const totalPaid = amountRub + commissionRub;
      const commissionPercent = ((commissionRub / totalPaid) * 100).toFixed(1);
      
      message += `${page * 3 + index + 1}. ✅ ${date} в ${time} (МСК)\n`;
      message += `   💰 ${tx.amount_usd} USD → ${formatRussianCurrency(totalPaid)}\n`;
      message += `   🎮 ${tx.steam_username}\n`;
      const exchangeRate = tx.exchange_rate ? parseFloat(tx.exchange_rate.toString()) : null;
      message += `   📊 Курс: ${exchangeRate?.toFixed(2) || 'н/д'}₽/$ • Комиссия: ${commissionPercent}%\n\n`;
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

 