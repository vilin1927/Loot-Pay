import { logger } from '../../utils/logger';
import { setState } from '../../services/state/stateService';
import { getBotInstance } from '../botInstance';

// Amount limits
const MIN_AMOUNT = 2;
const MAX_AMOUNT = 100;

// Messages
const CUSTOM_AMOUNT_MESSAGE = `
💰 Введите сумму пополнения в долларах (USD):

Минимальная сумма: ${MIN_AMOUNT}$
Максимальная сумма: ${MAX_AMOUNT}$

Например: 25.50
`;

const TOO_SMALL_MESSAGE = `
❌ Сумма слишком маленькая.

Минимальная сумма: ${MIN_AMOUNT}$

Выберите минимальную сумму или введите другую:
`;

const TOO_LARGE_MESSAGE = `
❌ Сумма слишком большая.

Максимальная сумма: ${MAX_AMOUNT}$

Выберите максимальную сумму или введите другую:
`;

const INVALID_FORMAT_MESSAGE = `
❌ Неверный формат суммы.

Введите число от ${MIN_AMOUNT} до ${MAX_AMOUNT}$.
Например: 25.50

Попробуйте снова:
`;

// Quick-fix buttons
const MIN_AMOUNT_BUTTON = {
  text: `Минимум (${MIN_AMOUNT}$)`,
  callback_data: `amount_${MIN_AMOUNT}`
};

const MAX_AMOUNT_BUTTON = {
  text: `Максимум (${MAX_AMOUNT}$)`,
  callback_data: `amount_${MAX_AMOUNT}`
};

// Handle custom amount request
export async function handleCustomAmountRequest(
  chatId: number,
  userId: number
) {
  try {
    // Set state to amount selection
    await setState(userId, 'AMOUNT_SELECTION', {
      started_at: new Date().toISOString()
    });

    // Get bot instance and show message
    const bot = await getBotInstance();
    await bot.sendMessage(chatId, CUSTOM_AMOUNT_MESSAGE);

    logger.info('Custom amount requested', { userId });

  } catch (error) {
    logger.error('Error requesting custom amount', {
      error,
      userId
    });

    // Send error message
    const bot = await getBotInstance();
    await bot.sendMessage(
      chatId,
      '😔 Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
    );
  }
}

// Handle custom amount input
export async function handleCustomAmountInput(
  chatId: number,
  userId: number,
  input: string
) {
  try {
    const bot = await getBotInstance();

    // Parse amount
    const amount = parseFloat(input);

    // Validate format
    if (isNaN(amount)) {
      await bot.sendMessage(chatId, INVALID_FORMAT_MESSAGE);
      return;
    }

    // Validate minimum
    if (amount < MIN_AMOUNT) {
      await bot.sendMessage(chatId, TOO_SMALL_MESSAGE, {
        reply_markup: {
          inline_keyboard: [[MIN_AMOUNT_BUTTON]]
        }
      });
      return;
    }

    // Validate maximum
    if (amount > MAX_AMOUNT) {
      await bot.sendMessage(chatId, TOO_LARGE_MESSAGE, {
        reply_markup: {
          inline_keyboard: [[MAX_AMOUNT_BUTTON]]
        }
      });
      return;
    }

    // Set amount and proceed to payment confirmation
    await setState(userId, 'AMOUNT_SELECTED', { 
      amountUSD: amount,
      // TODO: Calculate total amount with commission
      totalAmountRUB: amount * 90 // Placeholder exchange rate
    });

    // Send confirmation message
    await bot.sendMessage(
      chatId, 
      `✅ Сумма ${amount} USD выбрана. Переходим к подтверждению платежа.`
    );

    logger.info('Custom amount processed', {
      userId,
      amount
    });

  } catch (error) {
    logger.error('Error processing custom amount', {
      error,
      userId,
      input
    });

    // Send error message
    const bot = await getBotInstance();
    await bot.sendMessage(
      chatId,
      '😔 Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
    );
  }
} 