import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../../utils/logger';
import { setState, UserState } from '../../../services/state/stateService';
import { saveResponse } from '../../../services/questionnaire/questionnaireService';
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
  answer: string
) {
  try {
    const bot = await getBotInstance();
    await saveResponse(userId, 2, answer);
    await setState(userId, 'QUESTIONNAIRE_Q2' as UserState, {
      current_question: 3
    });
    logger.info('Saved question 2 answer', { userId, answer });
    await handleQuestion3(bot, chatId, userId);
  } catch (error) {
    logger.error('Error handling question 2 answer', { error, userId, answer });
    const bot = await getBotInstance();
    await bot.sendMessage(
      chatId,
      '😔 Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
    );
  }
} 