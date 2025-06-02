import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../../utils/logger';
import { setState } from '../../../services/state/stateService';
import { saveResponse } from '../../../services/questionnaire/questionnaireService';
import { showQuestion3 } from './question3';

const QUESTION = `
🎮 Какую сумму вы обычно пополняете Steam?

1️⃣ 5-10$
2️⃣ 10-20$
3️⃣ 20-50$
4️⃣ Более 50$
`;

const BUTTONS = [
  [
    { text: '1️⃣ 5-10$', callback_data: 'q2_1' },
    { text: '2️⃣ 10-20$', callback_data: 'q2_2' }
  ],
  [
    { text: '3️⃣ 20-50$', callback_data: 'q2_3' },
    { text: '4️⃣ Более 50$', callback_data: 'q2_4' }
  ]
];

export async function handleQuestion2(
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
    await setState(userId, 'QUESTIONNAIRE_Q2', {});

    logger.info('Question 2 sent', { userId });
  } catch (error) {
    logger.error('Error sending question 2', {
      error,
      userId
    });
    throw error;
  }
}

// Handle answer selection
export async function handleQuestion2Answer(
  chatId: number,
  userId: number,
  answer: string
) {
  try {
    // Save response
    await saveResponse(
      userId,
      2,
      QUESTION,
      answer
    );

    // Update state
    await setState(userId, 'QUESTIONNAIRE', {
      current_question: 3,
      question_type: 'referral'
    });

    logger.info('Saved question 2 answer', {
      userId,
      answer
    });

    // Show next question
    await showQuestion3(chatId, userId);

  } catch (error) {
    logger.error('Error handling question 2 answer', {
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