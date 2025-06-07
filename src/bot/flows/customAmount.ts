import { logger } from '../../utils/logger';
import { setState } from '../../services/state/stateService';
import { getBotInstance } from '../botInstance';
import { getSystemSetting } from '../../services/settings/settingsService';

// Dynamic message functions
const getCustomAmountMessage = async () => {
  const minAmount = Number(await getSystemSetting('min_amount_usd')) || 1;
  const maxAmount = Number(await getSystemSetting('max_amount_usd')) || 25;

  return `💰 Введите сумму пополнения в долларах (USD):

Минимальная сумма: ${minAmount}$
Максимальная сумма: ${maxAmount}$

Например: 25.50`;
};

const getTooSmallMessage = async () => {
  const minAmount = Number(await getSystemSetting('min_amount_usd')) || 1;
  
  return `❌ Сумма слишком маленькая.

Минимальная сумма: ${minAmount}$

Выберите минимальную сумму или введите другую:`;
};

const getTooLargeMessage = async () => {
  const maxAmount = Number(await getSystemSetting('max_amount_usd')) || 25;
  
  return `❌ Сумма слишком большая.

Максимальная сумма: ${maxAmount}$

Выберите максимальную сумму или введите другую:`;
};

const getInvalidFormatMessage = async () => {
  const minAmount = Number(await getSystemSetting('min_amount_usd')) || 1;
  const maxAmount = Number(await getSystemSetting('max_amount_usd')) || 25;
  
  return `❌ Неверный формат суммы.

Введите число от ${minAmount} до ${maxAmount}$.
Например: 25.50

Попробуйте снова:`;
};

// Dynamic button functions
const getMinAmountButton = async () => {
  const minAmount = Number(await getSystemSetting('min_amount_usd')) || 1;
  return {
    text: `Минимум (${minAmount}$)`,
    callback_data: `amount_${minAmount}`
  };
};

const getMaxAmountButton = async () => {
  const maxAmount = Number(await getSystemSetting('max_amount_usd')) || 25;
  return {
    text: `Максимум (${maxAmount}$)`,
    callback_data: `amount_${maxAmount}`
  };
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
    const message = await getCustomAmountMessage();
    await bot.sendMessage(chatId, message);

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
    
    // Get dynamic limits from database
    const minAmount = Number(await getSystemSetting('min_amount_usd')) || 1;
    const maxAmount = Number(await getSystemSetting('max_amount_usd')) || 25;

    // Parse amount
    const amount = parseFloat(input);

    // Validate format
    if (isNaN(amount)) {
      const message = await getInvalidFormatMessage();
      await bot.sendMessage(chatId, message);
      return;
    }

    // Validate minimum
    if (amount < minAmount) {
      const message = await getTooSmallMessage();
      const button = await getMinAmountButton();
      
      await bot.sendMessage(chatId, message, {
        reply_markup: {
          inline_keyboard: [[button]]
        }
      });
      return;
    }

    // Validate maximum
    if (amount > maxAmount) {
      const message = await getTooLargeMessage();
      const button = await getMaxAmountButton();
      
      await bot.sendMessage(chatId, message, {
        reply_markup: {
          inline_keyboard: [[button]]
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