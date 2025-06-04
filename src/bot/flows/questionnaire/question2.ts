import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../../utils/logger';
import { setState, UserState } from '../../../services/state/stateService';
import { saveResponse, ANSWER_TEXTS } from '../../../services/questionnaire/questionnaireService';
import { handleQuestion3 } from './question3';
import { getBotInstance } from '../../../bot/botInstance';

const QUESTION = `❓ Пробовал(а) другие пополнялки?`;

const BUTTONS = [
  [{ text: '👍 Да, юзаю', callback_data: 'q2_yes' }],
  [{ text: '👌 Да, но забросил(а)', callback_data: 'q2_abandoned' }],
  [{ text: '❌ Нет', callback_data: 'q2_no' }]
];

export async function handleQuestion2(
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
    await setState(userId, 'QUESTIONNAIRE_Q2' as UserState, {});
    logger.info('Question 2 sent', { userId });
  } catch (error) {
    logger.error('Error sending question 2', { error, userId });
    throw error;
  }
}

export async function handleQuestion2Answer(
  chatId: number,
  userId: number,
  answerCode: string
) {
  try {
    const bot = await getBotInstance();
    
    // Get full answer text from callback data
    const callbackData = `q2_${answerCode}`;
    const answerText = ANSWER_TEXTS[callbackData as keyof typeof ANSWER_TEXTS];
    
    if (!answerText) {
      throw new Error(`Unknown answer code: ${callbackData}`);
    }

    // Save response with full question and answer text
    await saveResponse(userId, 2, QUESTION, answerText);
    
    await setState(userId, 'QUESTIONNAIRE_Q2' as UserState, {
      current_question: 3
    });
    logger.info('Saved question 2 answer', { userId, answerText });
    await handleQuestion3(bot, chatId, userId);
  } catch (error) {
    logger.error('Error handling question 2 answer', { error, userId, answerCode });
    const bot = await getBotInstance();
    await bot.sendMessage(
      chatId,
      '😔 Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
    );
  }
} 