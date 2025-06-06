import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../../utils/logger';
import { setState, UserState } from '../../../services/state/stateService';
import { saveResponse, ANSWER_TEXTS } from '../../../services/questionnaire/questionnaireService';
import { handleQuestion2 } from './question2';
import { getBotInstance } from '../../../bot/botInstance';

const QUESTION = `📋 Давайте познакомимся! Ответьте на 3 быстрых вопроса, чтобы мы могли лучше вас понимать.\n\n❓ На что чаще всего тратишь деньги в Steam?`;

const BUTTONS = [
  [{ text: '🎮 Игры — покупаю новинки и классику', callback_data: 'q1_games' }],
  [{ text: '✨ Внутриигровые штуки, кейсы, боевые пропуски', callback_data: 'q1_items' }],
  [{ text: '🧸 Другое — что-то ещё, не из этого', callback_data: 'q1_other' }],
  [{ text: '🧘 Вообще не трачу — просто сижу, не покупаю', callback_data: 'q1_none' }]
];

export async function handleQuestion1(
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
    await setState(userId, 'QUESTIONNAIRE_Q1' as UserState, {});
    logger.info('Question 1 sent', { userId });
  } catch (error) {
    logger.error('Error sending question 1', { error, userId });
    throw error;
  }
}

export async function handleQuestion1Answer(
  chatId: number,
  userId: number,
  answerCode: string
) {
  try {
    const bot = await getBotInstance();
    
    // Get full answer text from callback data
    const callbackData = `q1_${answerCode}`;
    const answerText = ANSWER_TEXTS[callbackData as keyof typeof ANSWER_TEXTS];
    
    if (!answerText) {
      throw new Error(`Unknown answer code: ${callbackData}`);
    }

    // Save response with full question and answer text
    await saveResponse(userId, 1, QUESTION, answerText);
    
    await setState(userId, 'QUESTIONNAIRE_Q1' as UserState, {
      current_question: 2
    });
    logger.info('Saved question 1 answer', { userId, answerText });
    await handleQuestion2(bot, chatId, userId);
  } catch (error) {
    logger.error('Error handling question 1 answer', { error, userId, answerCode });
    const bot = await getBotInstance();
    await bot.sendMessage(
      chatId,
      '😔 Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
    );
  }
} 