import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../../utils/logger';
import { setState } from '../../../services/state/stateService';
import { saveResponse } from '../../../services/questionnaire/questionnaireService';
import { showQuestion2 } from './question2';

const QUESTION = `
🎮 Как давно вы играете в Steam?

1️⃣ Менее 6 месяцев
2️⃣ 6-12 месяцев
3️⃣ 1-2 года
4️⃣ Более 2 лет
`;

const BUTTONS = [
  [
    { text: '1️⃣ Менее 6 месяцев', callback_data: 'q1_1' },
    { text: '2️⃣ 6-12 месяцев', callback_data: 'q1_2' }
  ],
  [
    { text: '3️⃣ 1-2 года', callback_data: 'q1_3' },
    { text: '4️⃣ Более 2 лет', callback_data: 'q1_4' }
  ]
];

export async function handleQuestion1(
  bot: TelegramBot,
  chatId: number,
  userId: number
): Promise<void> {
  try {
    // Send question
    await bot.sendMessage(
      chatId,
      QUESTION,
      {
        reply_markup: {
          inline_keyboard: BUTTONS
        }
      }
    );

    // Set state
    await setState(userId, 'QUESTIONNAIRE_Q1', {});

    logger.info('Question 1 sent', { userId });
  } catch (error) {
    logger.error('Error sending question 1', {
      error,
      userId
    });
    throw error;
  }
}

// Handle answer selection
export async function handleQuestion1Answer(
  chatId: number,
  userId: number,
  answer: string
) {
  try {
    // Save response
    await saveResponse(
      userId,
      1,
      QUESTION,
      answer
    );

    // Update state
    await setState(userId, 'QUESTIONNAIRE', {
      current_question: 2,
      question_type: 'payment'
    });

    logger.info('Saved question 1 answer', {
      userId,
      answer
    });

    // Show next question
    await showQuestion2(chatId, userId);

  } catch (error) {
    logger.error('Error handling question 1 answer', {
      error,
      userId,
      answer
    });

    // Send error message
    await bot.sendMessage(
      chatId,
      '😔 Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
    );
  }
} 