import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../../utils/logger';
import { setState } from '../../../services/state/stateService';
import { saveResponse, isQuestionnaireComplete, QUESTIONS } from '../../../services/questionnaire/questionnaireService';
import { handleError } from '../../../utils/errorHandler';

// Completion message
const COMPLETION_MESSAGE = `
✅ Спасибо за ответы! Теперь вы можете пополнить свой Steam кошелек.

Нажмите кнопку ниже, чтобы начать:
`;

// Send question to user
export async function sendQuestion(
  bot: TelegramBot,
  chatId: number,
  userId: number,
  questionNumber: 1 | 2 | 3
): Promise<void> {
  try {
    const question = QUESTIONS[questionNumber];

    // Create inline keyboard with options
    const keyboard = {
      inline_keyboard: question.options.map(option => [{
        text: option.text,
        callback_data: `q${questionNumber}_${option.value}`
      }])
    };

    // Send question
    await bot.sendMessage(chatId, question.text, {
      reply_markup: keyboard
    });

    // Set state
    await setState(userId, `QUESTIONNAIRE_Q${questionNumber}`, {});

    logger.info('Question sent', {
      userId,
      questionNumber
    });
  } catch (error) {
    logger.error('Error sending question', {
      error,
      userId,
      questionNumber
    });
    await handleError(chatId, error as Error);
  }
}

// Handle question response
export async function handleQuestionResponse(
  bot: TelegramBot,
  chatId: number,
  userId: number,
  questionNumber: 1 | 2 | 3,
  answer: string
): Promise<void> {
  try {
    // Save response
    await saveResponse(userId, questionNumber, answer);

    // Check if questionnaire is complete
    const isComplete = await isQuestionnaireComplete(userId);

    if (isComplete) {
      // Send completion message
      await bot.sendMessage(chatId, COMPLETION_MESSAGE, {
        reply_markup: {
          inline_keyboard: [[
            { text: '🎮 Пополнить Steam', callback_data: 'start_payment' }
          ]]
        }
      });

      // Set state to complete
      await setState(userId, 'QUESTIONNAIRE_COMPLETE', {});

      logger.info('Questionnaire completed', {
        userId
      });
    } else {
      // Send next question
      const nextQuestion = (questionNumber + 1) as 1 | 2 | 3;
      await sendQuestion(bot, chatId, userId, nextQuestion);

      logger.info('Next question sent', {
        userId,
        questionNumber: nextQuestion
      });
    }
  } catch (error) {
    logger.error('Error handling question response', {
      error,
      userId,
      questionNumber
    });
    await handleError(chatId, error as Error);
  }
} 