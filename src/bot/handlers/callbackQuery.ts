import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../utils/logger';
import { handleStartPayment, handleStartCommand } from './start';
import { handleQuestionResponse } from '../flows/questionnaire/questionnaireHandler';
import { handleError } from '../../utils/errorHandler';
import { findOrCreateUser } from '../../services/user/userService';
import { setState, getState } from '../../services/state/stateService';
import { showPaymentConfirmation } from '../flows/paymentConfirmation';
import { createPayment } from '../../services/payment/paymentService';
import { showTransactionHistory } from '../flows/transactionHistory';
import { Message } from 'node-telegram-bot-api';
import { getSystemSetting } from '../../services/settings/settingsService';
import { analyticsService } from '../../services/analytics/analyticsService';
import { registerUserActivity } from '../idleReminder';

// Helper functions
async function trackAmountButtonClick(userId: number, amount: number) {
  try {
    await analyticsService.trackEvent(userId, 'amount_button_clicked', {
      amount_usd: amount,
      selection_method: 'preset_button',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.warn('Amount button analytics failed', { error, userId, amount });
  }
}

export async function handleAmountSelected(bot: TelegramBot, chatId: number, userId: number, amount: number) {
  // Get existing state to preserve steamUsername AND transactionId
  const currentState = await getState(userId);
  const existingData = currentState?.state_data || {};
  
  // ✅ CRITICAL FIX: Preserve transactionId when storing amount
  await setState(userId, 'AMOUNT_SELECTED', { 
    ...existingData,
    amountUSD: amount 
  });
  
  logger.info('Amount selected, preserving transactionId', {
    userId,
    amount,
    transactionId: existingData.transactionId,
    steamUsername: existingData.steamUsername
  });
  
  await showPaymentConfirmation(bot, chatId, userId);
}

async function handleCustomAmountPrompt(bot: TelegramBot, chatId: number, userId: number) {
  // ✅ FIX: Preserve existing state data instead of clearing it
  const currentState = await getState(userId);
  const existingData = currentState?.state_data || {};
  
  // Get dynamic limits from database
  const minAmount = Number(await getSystemSetting('min_amount_usd')) || 1;
  const maxAmount = Number(await getSystemSetting('max_amount_usd')) || 100;
  
  await bot.sendMessage(chatId, `💰 Введите сумму в USD (от ${minAmount} до ${maxAmount}):`);
  await setState(userId, 'AWAITING_CUSTOM_AMOUNT', existingData);
  
  logger.info('Custom amount prompt shown, preserving state', {
    userId,
    preservedData: existingData
  });
}

// Handle callback queries
export async function handleCallbackQuery(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery
): Promise<void> {
  try {
    if (!query.message?.chat.id || !query.from?.id) {
      throw new Error('Missing chat or user ID in callback query');
    }

    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const data = query.data;

    if (!data) {
      throw new Error('Missing callback data');
    }

    logger.debug('Processing callback query', { telegramId, data, queryId: query.id });

    // Register user activity for inactivity tracking
    registerUserActivity(telegramId);

    // Answer callback query immediately to prevent loading state
    await bot.answerCallbackQuery(query.id);

    // Get or create user to get database user.id
    const user = await findOrCreateUser({
      id: telegramId,
      username: query.from?.username,
      first_name: query.from?.first_name,
      last_name: query.from?.last_name
    });

    const userId = user.id; // Use database user.id, not telegram_id

    // Track callback interaction for analytics
    try {
      await analyticsService.trackEvent(userId, 'callback_interaction', {
        action: data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.warn('Callback analytics failed', { error, userId, action: data });
    }

    // Handle questionnaire responses
    if (data.startsWith('q')) {
      const [questionPart, answer] = data.split('_');
      const questionNumber = parseInt(questionPart.substring(1)) as 1 | 2 | 3;
      
      await handleQuestionResponse(bot, chatId, userId, questionNumber, answer);
      logger.info('Questionnaire response handled', { telegramId, userId, questionNumber, answer });
      return;
    }

    // Handle other button clicks
    switch (data) {
      case 'start_payment':
      case 'fund_steam':
        // Track gift button click for User 22 (special analytics)
        if (userId === 22) {
          await analyticsService.trackEvent(userId, 'gift_offer_clicked', {
            messageId: query.message?.message_id,
            offerType: 'bonus_2usd_on_5usd',
            clickedAt: new Date().toISOString(),
            telegramId: telegramId,
            buttonText: '🎁 Получить подарок'
          });
          logger.info('Gift offer button clicked by User 22', { userId, telegramId });
        }
        await handleStartPayment(bot, chatId, userId);
        break;

      // Amount selection handlers
      case 'amount_5':
        await trackAmountButtonClick(userId, 5);
        await handleAmountSelected(bot, chatId, userId, 5);
        break;
      case 'amount_10':
        await trackAmountButtonClick(userId, 10);
        await handleAmountSelected(bot, chatId, userId, 10);
        break;
      case 'amount_25':
        await trackAmountButtonClick(userId, 25);
        await handleAmountSelected(bot, chatId, userId, 25);
        break;
      case 'amount_50':
        await trackAmountButtonClick(userId, 50);
        await handleAmountSelected(bot, chatId, userId, 50);
        break;
      case 'amount_custom':
        await handleCustomAmountPrompt(bot, chatId, userId);
        break;

      // Payment confirmation handlers
      case 'confirm_payment':
        await handlePaymentConfirmation(bot, chatId, userId);
        break;

      case 'steam_username':
        await bot.sendMessage(chatId, '🎮 Введите логин Steam аккаунта:');
        await setState(userId, 'STEAM_USERNAME', {});
        break;

      case 'show_history':
      case 'my_transactions':
        await showTransactionHistory(bot, chatId, userId, 0);
        break;

      case 'show_support':
      case 'support':
        await bot.sendMessage(chatId, `
🛠 Поддержка LootPay

📞 Связаться с нами:
@lootpay_support - Telegram
support@lootpay.ru - Email

⏰ Время работы: 24/7
📱 Среднее время ответа: 15 минут
        `, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📞 Написать в поддержку', url: 'https://t.me/lootpay_support' }],
              [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
            ]
          }
        });
        break;

      case 'security_faq':
        await bot.sendMessage(chatId, `🔒 Безопасность LootPay

1️⃣ Мы используем СБП (Система Быстрых Платежей) –
   официальную инфраструктуру Банка России.

2️⃣ Все платежи проходят банковскую проверку
   и шифруются по стандарту PCI-DSS.

3️⃣ Мы сотрудничаем с PayDigital.shop
   – лицензированным партнёром Steam в РФ.

4️⃣ Гарантия возврата средств при любых
   технических сбоях (24 часа).

🔎 Хотите убедиться, что мы партнёры PayDigital?
Напишите в @paydigital_support – они подтвердят.

Если остались вопросы – напишите в поддержку.`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📞 PayDigital поддержка', url: 'https://t.me/paydigital_support' }],
              [{ text: '📞 Связаться с LootPay', url: 'https://t.me/lootpay_support' }],
              [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
            ]
          }
        });
        break;

      case 'main_menu':
        // Return user to main menu - use start command for proper main menu
        await handleStartCommand({ chat: { id: chatId }, from: { id: telegramId } } as Message);
        break;

      case 'steam_login_help':
        await bot.sendMessage(chatId, `
🎮 Помощь с логином Steam

📝 Как найти свой логин Steam:

1️⃣ Через клиент Steam:
   • Откройте Steam на компьютере
   • Ваш логин указан в правом верхнем углу

2️⃣ Через браузер:
   • Зайдите на steamcommunity.com
   • Ваш логин в URL: steamcommunity.com/id/ВАШ_ЛОГИН/

3️⃣ Примеры правильных логинов:
   • nickname123
   • player_2024
   • steam_user

❌ НЕ используйте:
   • Email адрес
   • Отображаемое имя
   • Телефон

💡 Совет: Логин Steam - это уникальный идентификатор, который вы создали при регистрации
        `, {
          reply_markup: {
            inline_keyboard: [[
              { text: '🏠 Главное меню', callback_data: 'main_menu' }
            ]]
          }
        });
        break;

      case 'show_info':
      case 'about':
        await bot.sendMessage(chatId, `📄 О LootPay

LootPay - это сервис для быстрого и безопасного пополнения Steam кошелька через СБП.

🎁 РОЗЫГРЫШ АРКАНЫ для подписчиков «Крипочки Тысячного Ранга» — участие от $5 / 400 ₽!

💰 Комиссия: 10% от суммы
💳 Минимальная сумма: 1$
⚡️ Мгновенное зачисление

🛡️ Безопасность:
• Банковская защита СБП  
• Гарантия возврата  
• 100+ успешных операций  
• Партнёр PayDigital.shop (@paydigital_support)

📋 Оферта: https://telegra.ph/LootPay-05-31 
❓ FAQ: https://telegra.ph/LootPay-05-31#FAQ`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
            ]
          }
        });
        break;

      default:
        if (data.startsWith('history_page_')) {
          const page = parseInt(data.split('_')[2]);
          await showTransactionHistory(bot, chatId, userId, page);
          return;
        }
        
        // Handle dynamic amount buttons (amount_1, amount_2, amount_3, etc.)
        if (data.startsWith('amount_') && data !== 'amount_custom') {
          const amount = parseFloat(data.replace('amount_', ''));
          if (!isNaN(amount) && amount > 0) {
            await handleAmountSelected(bot, chatId, userId, amount);
            return;
          }
        }
        
        logger.warn('Unknown callback data', { data, telegramId, userId });
        break;
    }

    logger.info('Callback query handled successfully', {
      telegramId,
      userId,
      data
    });
  } catch (error) {
    logger.error('Error handling callback query', {
      error,
      query: {
        id: query.id,
        data: query.data,
        from: query.from?.id
      }
    });
    if (query.message?.chat.id) {
      await handleError(query.message.chat.id, error as Error);
    }
  }
}

async function handlePaymentConfirmation(bot: TelegramBot, chatId: number, userId: number) {
  try {
    const state = await getState(userId);
    
    // ✅ CRITICAL: Check for both required parameters
    if (!state?.state_data?.amountUSD || !state?.state_data?.transactionId) {
      const missingFields = [];
      if (!state?.state_data?.amountUSD) missingFields.push('amountUSD');
      if (!state?.state_data?.transactionId) missingFields.push('transactionId');
      
      logger.error('Missing required payment data', { 
        userId, 
        missingFields,
        stateData: state?.state_data 
      });
      
      throw new Error(`Missing payment data: ${missingFields.join(', ')}`);
    }

    // Check if Steam username is set
    if (!state.state_data.steamUsername) {
      logger.info('Steam username missing in payment confirmation, redirecting to Steam username flow', { userId });
      await bot.sendMessage(chatId, '🎮 Сначала введите логин Steam аккаунта:');
      await setState(userId, 'STEAM_USERNAME', { amountUSD: state.state_data.amountUSD });
      return;
    }

    await bot.sendMessage(chatId, '⏳ Создаем платеж...');

    const { steamUsername, amountUSD, transactionId } = state.state_data;
    
    // ✅ CRITICAL FIX: Pass all required parameters including transactionId
    const payment = await createPayment(userId, steamUsername, amountUSD, transactionId);

    await bot.sendMessage(chatId, `💳 Платеж создан!

🔗 Для оплаты нажмите кнопку ниже:`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: `💳 Оплатить ${payment.totalAmountRUB}₽`, url: payment.paymentUrl }],
          [{ text: '🛠 Поддержка', callback_data: 'support' }]
        ]
      }
    });

    logger.info('Payment created successfully with required transactionId', {
      userId,
      steamUsername,
      amountUSD,
      transactionId,
      paymentUrl: payment.paymentUrl,
      databaseTransactionId: payment.transactionId
    });

  } catch (error) {
    logger.error('Error in payment confirmation', { 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      userId 
    });
    await bot.sendMessage(chatId, '❌ Ошибка создания платежа. Обратитесь в поддержку.');
  }
} 