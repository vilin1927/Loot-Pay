import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../utils/logger';
import { setState } from '../../services/state/stateService';
import { calculateCommission } from '../../utils/commission';

const AMOUNT_PROMPT = `
💰 Выберите сумму пополнения:

5$ - 450₽
10$ - 900₽
15$ - 1350₽
20$ - 1800₽

Или введите другую сумму в долларах.
`;

const AMOUNT_ERROR = `
❌ Ошибка: Некорректная сумма

Минимальная сумма: 5$
Максимальная сумма: 100$

Попробуйте еще раз.
`;

const AMOUNT_BUTTONS = [
  [
    { text: '5$', callback_data: 'amount_5' },
    { text: '10$', callback_data: 'amount_10' }
  ],
  [
    { text: '15$', callback_data: 'amount_15' },
    { text: '20$', callback_data: 'amount_20' }
  ],
  [
    { text: '↩️ Назад', callback_data: 'back_to_username' }
  ]
];

export async function handleAmountSelection(
  bot: TelegramBot,
  chatId: number,
  userId: number,
  amount?: string
): Promise<void> {
  try {
    if (!amount) {
      // Initial prompt
      await bot.sendMessage(
        chatId,
        AMOUNT_PROMPT,
        {
          reply_markup: {
            inline_keyboard: AMOUNT_BUTTONS
          }
        }
      );
      await setState(userId, 'AMOUNT_SELECTION', {});
      return;
    }

    // Parse amount
    const amountUSD = parseFloat(amount);
    if (isNaN(amountUSD) || amountUSD < 5 || amountUSD > 100) {
      await bot.sendMessage(chatId, AMOUNT_ERROR);
      return;
    }

    // Calculate commission
    const { totalAmountRUB } = calculateCommission(amountUSD, 90); // TODO: Get real exchange rate

    // Store amount and move to payment confirmation
    await setState(userId, 'AMOUNT_SELECTED', {
      amountUSD,
      totalAmountRUB
    });

    // Show payment confirmation
    await bot.sendMessage(
      chatId,
      `✅ Сумма: ${amountUSD}$ (${totalAmountRUB}₽)\n\nНажмите "Оплатить" для перехода к оплате.`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '💳 Оплатить', callback_data: 'confirm_payment' }
          ]]
        }
      }
    );

    logger.info('Amount selected', {
      userId,
      amountUSD,
      totalAmountRUB
    });

  } catch (error) {
    logger.error('Error handling amount selection', {
      error,
      userId,
      amount
    });
    throw error;
  }
} 