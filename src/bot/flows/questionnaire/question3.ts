import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../../utils/logger';
import { setState, UserState } from '../../../services/state/stateService';
import { saveResponse } from '../../../services/questionnaire/questionnaireService';
import { getBotInstance } from '../../../bot/botInstance';

const QUESTION = `❓ Мы делаем пополнение в USD для всех стран (кроме UK) — гуд?`;

const BUTTONS = [
  [{ text: '✅ Да, ок', callback_data: 'q3_yes' }],
  [{ text: '🇬🇧 Я из Британии', callback_data: 'q3_uk' }],
  [{ text: '❌ Нет, не в тему', callback_data: 'q3_no' }]
];

export async function handleQuestion3(
  bot: TelegramBot,
  chatId: number,
  userId: number
): Promise<void> {
  try {
    await bot.sendMessage(
      chatId,
      QUESTION,
      {
        reply_markup: {
          inline_keyboard: BUTTONS
        }
      }
    );
    await setState(userId, 'QUESTIONNAIRE_Q3' as UserState, {});
    logger.info('Question 3 sent', { userId });
  } catch (error) {
    logger.error('Error sending question 3', { error, userId });
    throw error;
  }
}

export async function handleQuestion3Answer(
  chatId: number,
  userId: number,
  answer: string
) {
  try {
    const bot = await getBotInstance();
    await saveResponse(userId, 3, answer);
    await setState(userId, 'QUESTIONNAIRE_COMPLETE' as UserState, {
      completed: true,
      completed_at: new Date().toISOString()
    });
    logger.info('Saved question 3 answer', { userId, answer });
    await bot.sendMessage(
      chatId,
      '🎉 Готово! Ты прошёл опрос — красавчик! Спасибо, что поделился своими предпочтениями 🙌 \nЭто поможет нам сделать LootPay ещё удобнее и полезнее для тебя.\n🔻 Теперь введи логин аккаунта Steam, который будем пополнять.\n⚠️ *Внимание!* Пожалуйста, убедитесь, что логин введён правильно.',
      {
        reply_markup: {
          inline_keyboard: [
            [ { text: '🧠 Как найти логин?', callback_data: 'steam_login_help' }, { text: 'ℹ️ Меню', callback_data: 'main_menu' } ]
          ]
        },
        parse_mode: 'Markdown'
      }
    );
  } catch (error) {
    logger.error('Error handling question 3 answer', { error, userId, answer });
    const bot = await getBotInstance();
    await bot.sendMessage(
      chatId,
      '😔 Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
    );
  }
} 