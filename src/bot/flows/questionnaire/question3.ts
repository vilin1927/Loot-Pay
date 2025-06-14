import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../../utils/logger';
import { setState, UserState } from '../../../services/state/stateService';
import { saveResponse, ANSWER_TEXTS } from '../../../services/questionnaire/questionnaireService';
import { getBotInstance } from '../../../bot/botInstance';
import { db } from '../../../database/connection';

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
  answerCode: string
) {
  try {
    const bot = await getBotInstance();
    
    // Get full answer text from callback data
    const callbackData = `q3_${answerCode}`;
    const answerText = ANSWER_TEXTS[callbackData as keyof typeof ANSWER_TEXTS];
    
    if (!answerText) {
      throw new Error(`Unknown answer code: ${callbackData}`);
    }

    // Save response with full question and answer text
    await saveResponse(userId, 3, QUESTION, answerText);
    
    // Update users table to mark questionnaire as completed
    await db('users')
      .where('id', userId)
      .update({
        questionnaire_completed: true,
        questionnaire_completed_at: new Date()
      });
    
    await setState(userId, 'QUESTIONNAIRE_COMPLETE' as UserState, {
      completed: true,
      completed_at: new Date().toISOString()
    });
    
    logger.info('Saved question 3 answer and completed questionnaire', { userId, answerText });
    
    // Send completion message according to PRD
    await bot.sendMessage(
      chatId,
      '🎉 Готово! Ты прошёл опрос — красавчик! Спасибо, что поделился своими предпочтениями 🙌 \nЭто поможет нам сделать LootPay ещё удобнее и полезнее для тебя.\n\n🧩 Введите логин аккаунта Steam:\n\n📖 Нужна помощь? Нажмите "Как найти логин"\n\n🎯 Для успешного пополнения:\n✅ Скопируйте точный логин\n✅ Проверьте дважды\n✅ Убедитесь в правильности\n\n💡 Правильный логин = быстрое зачисление',
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
    logger.error('Error handling question 3 answer', { error, userId, answerCode });
    const bot = await getBotInstance();
    await bot.sendMessage(
      chatId,
      '😔 Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
    );
  }
} 