import { Message } from 'node-telegram-bot-api';
import bot from '../../../bot';
import { logger } from '../../../utils/logger';
import { setState } from '../../../services/state/stateService';
import { db } from '../../../services/database/connection';

// Completion message
const COMPLETION_MESSAGE = `
✅ Спасибо за ответы!

Теперь давайте пополним ваш Steam кошелек:

1. Введите ваш Steam логин
2. Выберите сумму пополнения
3. Оплатите через СБП

Начнем? Введите ваш Steam логин:
`;

// Handle questionnaire completion
export async function handleQuestionnaireCompletion(
  chatId: number,
  userId: number
) {
  try {
    // Update user record
    await db('users')
      .where({ id: userId })
      .update({
        questionnaire_completed: true,
        questionnaire_completed_at: new Date().toISOString()
      });

    // Clear questionnaire state
    await setState(userId, 'STEAM_USERNAME', {
      started_at: new Date().toISOString()
    });

    // Send completion message
    await bot.sendMessage(chatId, COMPLETION_MESSAGE);

    logger.info('Completed questionnaire', {
      userId,
      next_state: 'STEAM_USERNAME'
    });

  } catch (error) {
    logger.error('Error completing questionnaire', {
      error,
      userId
    });

    // Send error message
    await bot.sendMessage(
      chatId,
      '😔 Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
    );
  }
} 