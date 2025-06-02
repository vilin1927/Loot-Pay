import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../../utils/logger';
import { setState } from '../../../services/state/stateService';
import { saveResponse } from '../../../services/questionnaire/questionnaireService';

const QUESTION = `
🎮 Какие игры вы предпочитаете?

1️⃣ Шутеры (CS2, Valorant)
2️⃣ ММО (Dota 2, LoL)
3️⃣ Стратегии (Stellaris, Civ)
4️⃣ Другое
`;

const BUTTONS = [
  [
    { text: '1️⃣ Шутеры', callback_data: 'q3_1' },
    { text: '2️⃣ ММО', callback_data: 'q3_2' }
  ],
  [
    { text: '3️⃣ Стратегии', callback_data: 'q3_3' },
    { text: '4️⃣ Другое', callback_data: 'q3_4' }
  ]
];

export async function handleQuestion3(
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
    await setState(userId, 'QUESTIONNAIRE_Q3', {});

    logger.info('Question 3 sent', { userId });
  } catch (error) {
    logger.error('Error sending question 3', {
      error,
      userId
    });
    throw error;
  }
}

// Handle answer selection
export async function handleQuestion3Answer(
  chatId: number,
  userId: number,
  answer: string
) {
  try {
    // Save response
    await saveResponse(
      userId,
      3,
      QUESTION,
      answer
    );

    // Update state to complete
    await setState(userId, 'QUESTIONNAIRE', {
      completed: true,
      completed_at: new Date().toISOString()
    });

    logger.info('Saved question 3 answer', {
      userId,
      answer
    });

    // Send completion message
    await bot.sendMessage(
      chatId,
      '✅ Спасибо за ответы! Теперь вы можете пополнить свой Steam кошелек.'
    );

  } catch (error) {
    logger.error('Error handling question 3 answer', {
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