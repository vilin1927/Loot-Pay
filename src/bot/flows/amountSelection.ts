import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../utils/logger';
import { setState, getState } from '../../services/state/stateService';
import { calculateCommission } from '../../utils/commission';
import { getSystemSetting } from '../../services/settings/settingsService';
import { formatRussianCurrency } from '../../utils/locale';

const MIN_AMOUNT_USD = 5;
const MAX_AMOUNT_USD = 100;

const AMOUNT_PROMPT = (minAmount: number, maxAmount: number) => `💰 Введите сумму пополнения, учитывая лимиты:
— Минимум: ${minAmount} USD 
— Максимум: ${maxAmount} USD`;

const AMOUNT_TOO_LOW = (minAmount: number) => `⚠️ Слишком маленькая сумма.
Минимальная сумма пополнения — ${minAmount} USD. 
Пожалуйста, введите сумму не меньше этого значения.`;

const AMOUNT_TOO_HIGH = (maxAmount: number) => `⚠️ Слишком большая сумма.
Максимальная сумма пополнения — ${maxAmount} USD. 
Пожалуйста, введите сумму в пределах лимита.`;

const PAYMENT_DETAILS = (username: string, amountUSD: number, amountRUB: number) => `🔎 Проверь данные перед оплатой:

🧾 Услуга: Пополнение Steam 
👤 Аккаунт: ${username}
💵 Сумма: ${amountUSD} USD (≈${formatRussianCurrency(amountRUB)}) — **комиссия 10% уже включена**

❗️Пожалуйста, убедитесь, что логин и сумма указаны верно. 
В случае ошибки средства могут уйти другому пользователю.
Если всё правильно — выберите способ оплаты ниже 👇`;

export async function handleAmountSelection(
  bot: TelegramBot,
  chatId: number,
  userId: number,
  amount?: string
): Promise<void> {
  try {
    if (!amount) {
      // Get minimum and maximum amounts from settings
      const minAmount = await getSystemSetting('min_amount_usd') || MIN_AMOUNT_USD;
      const maxAmount = await getSystemSetting('max_amount_usd') || MAX_AMOUNT_USD;

      // Initial prompt
      await bot.sendMessage(
        chatId,
        AMOUNT_PROMPT(Number(minAmount), Number(maxAmount)),
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '5 USD', callback_data: 'amount_5' },
                { text: '10 USD', callback_data: 'amount_10' }
              ],
              [
                { text: '15 USD', callback_data: 'amount_15' },
                { text: '20 USD', callback_data: 'amount_20' }
              ],
              [
                { text: 'Своя сумма 🪙', callback_data: 'amount_custom' }
              ],
              [
                { text: 'Ввести другой логин 🔄', callback_data: 'steam_username' }
              ]
            ]
          }
        }
      );
      await setState(userId, 'AMOUNT_SELECTION', {});
      return;
    }

    // Parse amount
    const amountUSD = parseFloat(amount);
    if (isNaN(amountUSD)) {
      await bot.sendMessage(chatId, AMOUNT_TOO_LOW(MIN_AMOUNT_USD), {
        reply_markup: {
          inline_keyboard: [
            [
              { text: `Пополнить на ${MIN_AMOUNT_USD} USD`, callback_data: `amount_${MIN_AMOUNT_USD}` },
              { text: '💵 Изменить сумму', callback_data: 'amount_custom' }
            ]
          ]
        }
      });
      return;
    }

    // Get minimum and maximum amounts from settings
    const minAmount = await getSystemSetting('min_amount_usd') || MIN_AMOUNT_USD;
    const maxAmount = await getSystemSetting('max_amount_usd') || MAX_AMOUNT_USD;

    // Validate amount limits
    if (amountUSD < Number(minAmount)) {
      await bot.sendMessage(chatId, AMOUNT_TOO_LOW(Number(minAmount)), {
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

    if (amountUSD > Number(maxAmount)) {
      await bot.sendMessage(chatId, AMOUNT_TOO_HIGH(Number(maxAmount)), {
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

    // Calculate commission
    const { totalAmountRUB } = calculateCommission(amountUSD, 90); // TODO: Get real exchange rate

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

    // Show payment confirmation
    await bot.sendMessage(
      chatId,
      PAYMENT_DETAILS(state.state_data.steamUsername, amountUSD, totalAmountRUB),
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