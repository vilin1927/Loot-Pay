import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../utils/logger';
import { setState, getState } from '../../services/state/stateService';
import { calculateCommission } from '../../utils/commission';
import { getSystemSetting } from '../../services/settings/settingsService';
import { formatRussianCurrency } from '../../utils/locale';
import { exchangeRateService } from '../../services/exchangeRate/exchangeRateService';
import { analyticsService } from '../../services/analytics/analyticsService';

// All amounts are now dynamic from database

const AMOUNT_PROMPT = (minAmount: number, maxAmount: number) => `💰 Введите сумму пополнения, учитывая лимиты:
— Минимум: ${minAmount} USD 
— Максимум: ${maxAmount} USD`;

const AMOUNT_TOO_LOW = (minAmount: number) => `⚠️ Слишком маленькая сумма.
Минимальная сумма пополнения — ${minAmount} USD. 
Пожалуйста, введите сумму не меньше этого значения.`;

const AMOUNT_TOO_HIGH = (maxAmount: number) => `⚠️ Слишком большая сумма.
Максимальная сумма пополнения — ${maxAmount} USD. 
Пожалуйста, введите сумму в пределах лимита.`;

const PAYMENT_DETAILS = async (username: string, amountUSD: number, amountRUB: number) => {
  const commissionPercent = await getSystemSetting('commission_percent') || '10';
  return `🔎 Проверь данные перед оплатой:

🧾 Услуга: Пополнение Steam 
👤 Аккаунт: ${username}
💵 Сумма: ${amountUSD} USD (≈${formatRussianCurrency(amountRUB)}) — **комиссия ${commissionPercent}% уже включена**

❗️Пожалуйста, убедитесь, что логин и сумма указаны верно. 
В случае ошибки средства могут уйти другому пользователю.
Если всё правильно — выберите способ оплаты ниже 👇`;
};

// Dynamic preset amounts based on min/max range
function getPresetAmounts(minAmount: number, maxAmount: number): number[] {
  const presets: number[] = [];
  
  // Always include minimum amount
  presets.push(minAmount);
  
  // Add preset amounts that fit within the range
  const possiblePresets = [2, 3, 5, 10, 15, 20, 25];
  
  for (const preset of possiblePresets) {
    if (preset > minAmount && preset <= maxAmount && !presets.includes(preset)) {
      presets.push(preset);
    }
  }
  
  // Limit to 4 presets maximum
  return presets.slice(0, 4);
}

export async function handleAmountSelection(
  bot: TelegramBot,
  chatId: number,
  userId: number,
  amount?: string
): Promise<void> {
  try {
    if (!amount) {
      // Get minimum and maximum amounts from settings
      const minAmount = Number(await getSystemSetting('min_amount_usd')) || 1;
      const maxAmount = Number(await getSystemSetting('max_amount_usd')) || 25;

      // Get dynamic preset amounts
      const presetAmounts = getPresetAmounts(minAmount, maxAmount);
      
      // Build dynamic keyboard
      const keyboard: any[][] = [];
      
      // Add preset amounts in rows of 2
      for (let i = 0; i < presetAmounts.length; i += 2) {
        const row = [];
        row.push({ text: `${presetAmounts[i]} USD`, callback_data: `amount_${presetAmounts[i]}` });
        if (presetAmounts[i + 1]) {
          row.push({ text: `${presetAmounts[i + 1]} USD`, callback_data: `amount_${presetAmounts[i + 1]}` });
        }
        keyboard.push(row);
      }
      
      // Add custom amount and change login buttons
      keyboard.push([{ text: 'Своя сумма 🪙', callback_data: 'amount_custom' }]);
      keyboard.push([{ text: 'Ввести другой логин 🔄', callback_data: 'steam_username' }]);

      // Initial prompt
      await bot.sendMessage(
        chatId,
        AMOUNT_PROMPT(minAmount, maxAmount),
        {
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );
      await setState(userId, 'AMOUNT_SELECTION', {});
      return;
    }

    // Get minimum and maximum amounts from settings first
    const minAmount = Number(await getSystemSetting('min_amount_usd')) || 1;
    const maxAmount = Number(await getSystemSetting('max_amount_usd')) || 25;

    // Input sanitization and validation
    const sanitizedAmount = amount.trim().replace(/[^0-9.,]/g, ''); // Remove non-numeric chars except decimals
    const normalizedAmount = sanitizedAmount.replace(',', '.'); // Convert comma to dot for parsing
    
    // Parse amount with enhanced validation
    const amountUSD = parseFloat(normalizedAmount);
    
    if (isNaN(amountUSD) || amountUSD <= 0) {
      await analyticsService.trackEvent(userId, 'amount_validation_failed', {
        reason: 'invalid_format',
        originalInput: amount,
        sanitizedInput: sanitizedAmount,
        normalizedInput: normalizedAmount,
        parsedValue: amountUSD
      });
      
      await bot.sendMessage(chatId, `❌ Неверный формат суммы

Введите корректную сумму в USD (например: 5, 10.50, 15,25).
Используйте только цифры и точку или запятую для десятичных.`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: `Пополнить на ${minAmount} USD`, callback_data: `amount_${minAmount}` },
              { text: '💵 Изменить сумму', callback_data: 'amount_custom' }
            ]
          ]
        }
      });
      return;
    }
    
    // Check for reasonable decimal places (max 2)
    const decimalPlaces = (normalizedAmount.split('.')[1] || '').length;
    if (decimalPlaces > 2) {
      await analyticsService.trackEvent(userId, 'amount_validation_failed', {
        reason: 'too_many_decimals',
        input: normalizedAmount,
        decimalPlaces
      });
      
      await bot.sendMessage(chatId, `❌ Слишком много знаков после запятой

Максимум 2 знака после запятой (например: 10.50 USD).`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: `Пополнить на ${minAmount} USD`, callback_data: `amount_${minAmount}` },
              { text: '💵 Изменить сумму', callback_data: 'amount_custom' }
            ]
          ]
        }
      });
      return;
    }

    // Validate amount limits with enhanced analytics
    if (amountUSD < minAmount) {
      await analyticsService.trackEvent(userId, 'amount_validation_failed', { 
        reason: 'below_minimum', 
        attempted: amountUSD, 
        minimum: minAmount,
        input: normalizedAmount
      });
      
      await bot.sendMessage(chatId, AMOUNT_TOO_LOW(minAmount), {
        reply_markup: {
          inline_keyboard: [
            [
              { text: `Пополнить на ${minAmount} USD`, callback_data: `amount_${minAmount}` },
              { text: '💵 Изменить сумму', callback_data: 'amount_custom' }
            ]
          ]
        }
      });
      return;
    }

    if (amountUSD > maxAmount) {
      await analyticsService.trackEvent(userId, 'amount_validation_failed', { 
        reason: 'above_maximum', 
        attempted: amountUSD, 
        maximum: maxAmount,
        input: normalizedAmount
      });
      
      await bot.sendMessage(chatId, AMOUNT_TOO_HIGH(maxAmount), {
        reply_markup: {
          inline_keyboard: [
            [
              { text: `Пополнить на ${maxAmount} USD`, callback_data: `amount_${maxAmount}` },
              { text: '💵 Изменить сумму', callback_data: 'amount_custom' }
            ]
          ]
        }
      });
      return;
    }

    // Get current exchange rate with enhanced error handling
    let rateResult;
    try {
      rateResult = await exchangeRateService.getCurrentUSDRUBRate();
    } catch (error) {
      logger.error('Exchange rate service error', { error, userId, amountUSD });
      
      await analyticsService.trackEvent(userId, 'exchange_rate_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        amountUSD,
        timestamp: new Date().toISOString()
      });
      
      await bot.sendMessage(chatId, `❌ Временная ошибка при получении курса валют

Попробуйте через несколько секунд или обратитесь в поддержку.`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Попробовать снова', callback_data: 'amount_custom' },
              { text: '❓ Поддержка', callback_data: 'support' }
            ]
          ]
        }
      });
      return;
    }
    
    if (!rateResult.success || !rateResult.rate) {
      await analyticsService.trackEvent(userId, 'exchange_rate_unavailable', {
        rateResult,
        amountUSD,
        timestamp: new Date().toISOString()
      });
      
      await bot.sendMessage(chatId, `❌ Курс валют временно недоступен

Мы работаем над решением проблемы. Попробуйте через несколько минут.`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Попробовать снова', callback_data: 'amount_custom' },
              { text: '❓ Поддержка', callback_data: 'support' }
            ]
          ]
        }
      });
      return;
    }
    
    // Calculate commission with real-time exchange rate
    const { totalAmountRUB } = calculateCommission(amountUSD, rateResult.rate.rate);

    // Get state to access steam username
    const state = await getState(userId);
    if (!state || !state.state_data?.steamUsername) {
      throw new Error('Steam username not found in state');
    }

    // Store amount and move to payment confirmation
    await setState(userId, 'AMOUNT_SELECTED', {
      amountUSD,
      totalAmountRUB
    });

    // Track amount selection event
    await analyticsService.trackAmountSelected(
      userId, 
      amountUSD, 
      totalAmountRUB, 
      amount ? 'custom' : 'preset'
    );

    // Show payment confirmation
    const paymentDetailsText = await PAYMENT_DETAILS(state.state_data.steamUsername, amountUSD, totalAmountRUB);
    await bot.sendMessage(
      chatId,
      paymentDetailsText,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: `✅ Оплатить СБП [${formatRussianCurrency(totalAmountRUB)}]`, callback_data: 'confirm_payment' }
            ],
            [
              { text: '🔁 Изменить логин', callback_data: 'steam_username' },
              { text: '💵 Изменить сумму', callback_data: 'amount_custom' }
            ]
          ]
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