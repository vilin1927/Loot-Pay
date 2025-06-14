import TelegramBot from 'node-telegram-bot-api';
import { startSurvey, saveAnswer, completeSurvey, skipSurvey } from '../../services/survey/surveyService';
import { setState } from '../../services/state/stateService';

// Questions definitions
export const SURVEY_QUESTIONS = {
  1: {
    text: '❓ Что тебя остановило? ',
    options: [
      { code: 'A', text: '💰 Высокая комиссия (10%)' },
      { code: 'B', text: '🛡 Сомнения в безопасности' },
      { code: 'C', text: '🤔 Сложно разобраться' },
      { code: 'D', text: '⏰ Передумал пополнять' },
      { code: 'E', text: '📱 Просто изучал возможности' }
    ]
  },
  2: {
    text: '❓ Пользуешься другими сервисами пополнения?',
    options: [
      { code: '1', text: '✅ Да, постоянно' },
      { code: '2', text: '🔄 Иногда пользуюсь' },
      { code: '3', text: '❌ Нет, не пользуюсь' },
      { code: '4', text: '🆕 LootPay — первый' }
    ]
  },
  3: {
    text: '❓ Что убедило бы попробовать снова?',
    options: [
      { code: 'I', text: '🔥 Скидка на комиссию (5% вместо 10%)' },
      { code: 'II', text: '🎁 Бонус за первую покупку' },
      { code: 'III', text: '👥 Отзывы пользователей' },
      { code: 'IV', text: '🛡 Гарантии безопасности' },
      { code: 'V', text: '📱 Простой интерфейс' }
    ]
  }
} as const;

type QuestionNo = 1 | 2 | 3;

export async function sendSurveyQuestion(bot: TelegramBot, chatId: number, userId: number, q: QuestionNo) {
  const question = SURVEY_QUESTIONS[q];
  const keyboard = {
    inline_keyboard: question.options.map(o => [{ text: o.text, callback_data: `s${q}_${o.code}` }])
  };
  await bot.sendMessage(chatId, question.text, { reply_markup: keyboard });
  await setState(userId, `SURVEY_Q${q}`, {});
}

export async function startGiftSurvey(bot: TelegramBot, chatId: number, userId: number) {
  await startSurvey(userId);
  await sendSurveyQuestion(bot, chatId, userId, 1);
}

export async function skipGiftSurvey(bot: TelegramBot, chatId: number, userId: number) {
  await skipSurvey(userId);
  await bot.sendMessage(chatId, 'Окей, спасибо! Если возникнут вопросы — мы на связи.');
}

export async function handleSurveyCallback(bot: TelegramBot, chatId: number, userId: number, data: string) {
  // data format: s{q}_{code}
  const parts = data.split('_');
  const qNo = Number(parts[0].substring(1)) as QuestionNo;
  const code = parts[1];

  if (qNo === 2 && code === '1') {
    // Need free text after this
    await saveAnswer(userId, 2, code);
    await bot.sendMessage(chatId, 'Напиши, каким сервисом пользуешься:');
    await setState(userId, 'SURVEY_Q2_TEXT', {});
    return;
  }

  await saveAnswer(userId, qNo, code);

  if (qNo === 1) {
    await sendSurveyQuestion(bot, chatId, userId, 2);
  } else if (qNo === 2) {
    await sendSurveyQuestion(bot, chatId, userId, 3);
  } else {
    // Completed
    await completeSurvey(userId);
    await bot.sendMessage(chatId, 'Спасибо за ответы! Выберите подарок:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '1 USD на Steam', callback_data: 'gift_steam' }],
          [{ text: '100 ₽ на СБП', callback_data: 'gift_sbp' }]
        ]
      }
    });
    await setState(userId, 'SURVEY_GIFT_CHOICE', {});
  }
} 