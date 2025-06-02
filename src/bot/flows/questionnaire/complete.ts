import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../../utils/logger';
import { setState } from '../../../services/state/stateService';
import { saveQuestionnaireAnswers } from '../../../services/questionnaire/questionnaireService';

const COMPLETION_MESSAGE = `
✅ Спасибо за ответы! Теперь вы можете пополнить свой Steam кошелек.

Нажмите кнопку ниже, чтобы начать:
`;

export async function handleQuestionnaireComplete(
  bot: TelegramBot,
  chatId: number,
  userId: number,
  answers: {
    q1: string;
    q2: string;
    q3: string;
  }
): Promise<void> {
  try {
    // Save answers
    await saveQuestionnaireAnswers(userId, answers);

    // Send completion message
    await bot.sendMessage(
      chatId,
      COMPLETION_MESSAGE,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '🎮 Пополнить Steam', callback_data: 'start_payment' }
          ]]
        }
      }
    );

    // Set state to complete
    await setState(userId, 'QUESTIONNAIRE_COMPLETE', {});

    logger.info('Questionnaire completed', {
      userId,
      answers
    });
  } catch (error) {
    logger.error('Error completing questionnaire', {
      error,
      userId
    });
    throw error;
  }
} 