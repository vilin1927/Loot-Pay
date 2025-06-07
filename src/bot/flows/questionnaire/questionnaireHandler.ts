import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../../utils/logger';
import { setState } from '../../../services/state/stateService';
import { saveResponse, isQuestionnaireComplete, QUESTIONS, ANSWER_TEXTS } from '../../../services/questionnaire/questionnaireService';
import { handleError } from '../../../utils/errorHandler';
import { db } from '../../../database/connection';
import { analyticsService } from '../../../services/analytics/analyticsService';

// Completion message according to PRD
const COMPLETION_MESSAGE = `🎉 Готово! Ты прошёл опрос — красавчик! Спасибо, что поделился своими предпочтениями 🙌 
Это поможет нам сделать LootPay ещё удобнее и полезнее для тебя.
🔻 Теперь введи логин аккаунта Steam, который будем пополнять.
⚠️ *Внимание!* Пожалуйста, убедитесь, что логин введён правильно.`;

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
  answerCode: string
): Promise<void> {
  try {
    // Get full answer text from callback data
    const callbackData = `q${questionNumber}_${answerCode}`;
    const answerText = ANSWER_TEXTS[callbackData as keyof typeof ANSWER_TEXTS];
    
    if (!answerText) {
      throw new Error(`Unknown answer code: ${callbackData}`);
    }

    // Get question text
    const questionText = QUESTIONS[questionNumber].text;

    // Save response with full text
    await saveResponse(userId, questionNumber, questionText, answerText);

    // Track question answered event
    await analyticsService.trackQuestionnaireQuestionAnswered(userId, questionNumber, answerText);

    // Check if questionnaire is complete
    const isComplete = await isQuestionnaireComplete(userId);

    if (isComplete) {
      // Update users table to mark questionnaire as completed
      await db('users')
        .where('id', userId)
        .update({
          questionnaire_completed: true,
          questionnaire_completed_at: new Date()
        });

      // Track questionnaire completion
      const allResponses = await db('questionnaire_responses')
        .where('user_id', userId)
        .select('question_number', 'answer_text');
      
      const answersMap: Record<string, string> = {};
      allResponses.forEach(response => {
        answersMap[`question_${response.question_number}`] = response.answer_text;
      });
      
      await analyticsService.trackQuestionnaireCompleted(userId, answersMap);

      // Send completion message according to PRD
      await bot.sendMessage(chatId, COMPLETION_MESSAGE, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🧠 Как найти логин?', callback_data: 'steam_login_help' },
              { text: 'ℹ️ Меню', callback_data: 'main_menu' }
            ]
          ]
        },
        parse_mode: 'Markdown'
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
      questionNumber,
      answerCode
    });
    await handleError(chatId, error as Error);
  }
} 