import { Message } from 'node-telegram-bot-api';
import { getBotInstance } from '../botInstance';
import { logger } from '../../utils/logger';
import { getUserTransactions } from '../../services/transaction/transactionService';
import { formatRussianCurrency, formatMoscowTime } from '../../utils/locale';

// Constants
const TRANSACTIONS_PER_PAGE = 3;

// Messages
const NO_TRANSACTIONS_MESSAGE = `
📝 История транзакций пуста

У вас пока нет завершенных транзакций.
`;

const HISTORY_HEADER = `
📝 История транзакций

`;

const TRANSACTION_FORMAT = `
💳 Транзакция #{id}
💰 Сумма: {amount_rub}
👤 Steam: {steam_username}
📅 Дата: {date}
📊 Статус: {status}
`;

// Status emojis
const STATUS_EMOJIS = {
  completed: '✅',
  pending: '⏳',
  failed: '❌'
} as const;

// Status labels
const STATUS_LABELS = {
  completed: 'Завершена',
  pending: 'В обработке',
  failed: 'Ошибка'
} as const;

type TransactionStatus = keyof typeof STATUS_EMOJIS;

/**
 * Handle transaction history request
 */
export async function handleTransactionHistory(
  chatId: number,
  userId: number,
  page: number = 0
) {
  try {
    // Get bot instance
    const bot = await getBotInstance();

    // Get transactions
    const { transactions, total } = await getUserTransactions(
      userId,
      TRANSACTIONS_PER_PAGE,
      page * TRANSACTIONS_PER_PAGE
    );

    // Show no transactions message
    if (transactions.length === 0) {
      await bot.sendMessage(chatId, NO_TRANSACTIONS_MESSAGE);
      return;
    }

    // Format transactions
    const formattedTransactions = transactions.map(formatTransaction).join('\n');

    // Create message
    const message = HISTORY_HEADER + formattedTransactions;

    // Create keyboard
    const keyboard = [];
    const totalPages = Math.ceil(total / TRANSACTIONS_PER_PAGE);

    // Add pagination buttons if needed
    if (totalPages > 1) {
      const paginationRow = [];
      
      if (page > 0) {
        paginationRow.push({
          text: '⬅️ Назад',
          callback_data: `history_${page - 1}`
        });
      }
      
      if (page < totalPages - 1) {
        paginationRow.push({
          text: 'Вперед ➡️',
          callback_data: `history_${page + 1}`
        });
      }

      if (paginationRow.length > 0) {
        keyboard.push(paginationRow);
      }
    }

    // Add main menu button
    keyboard.push([
      { text: '🏠 Главное меню', callback_data: 'main_menu' }
    ]);

    // Send message
    await bot.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

    logger.info('Transaction history shown', {
      userId,
      page,
      count: transactions.length,
      total
    });

  } catch (error) {
    logger.error('Error showing transaction history', {
      error,
      userId
    });

    // Get bot instance for error message
    const bot = await getBotInstance();

    // Send error message
    await bot.sendMessage(
      chatId,
      '😔 Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
    );
  }
}

/**
 * Format single transaction
 */
function formatTransaction(transaction: {
  id: number;
  amount_rub: number;
  commission_rub: number;
  steam_username: string;
  created_at: string;
  status: TransactionStatus;
}): string {
  // Format amount
  const formattedAmount = formatRussianCurrency(transaction.amount_rub + transaction.commission_rub);

  // Format date
  const formattedDate = formatMoscowTime(new Date(transaction.created_at));

  return TRANSACTION_FORMAT
    .replace('{id}', transaction.id.toString())
    .replace('{amount_rub}', formattedAmount)
    .replace('{steam_username}', transaction.steam_username)
    .replace('{date}', formattedDate)
    .replace('{status}', `${STATUS_EMOJIS[transaction.status]} ${STATUS_LABELS[transaction.status]}`);
} 