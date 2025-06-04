import { db } from '../../database/connection';
import { logger } from '../../utils/logger';

// Question types
export type QuestionNumber = 1 | 2 | 3;

// Answer texts mapping for callback data
export const ANSWER_TEXTS = {
  'q1_games': '🎮 Игры — покупаю новинки и классику',
  'q1_items': '✨ Внутриигровые штуки, кейсы, боевые пропуски',
  'q1_other': '🧸 Другое — что-то ещё, не из этого',
  'q1_none': '🧘 Вообще не трачу — просто сижу, не покупаю',
  'q2_yes': '👍 Да, юзаю',
  'q2_abandoned': '👌 Да, но забросил(а)',
  'q2_no': '❌ Нет',
  'q3_yes': '✅ Да, ок',
  'q3_uk': '🇬🇧 Я из Британии',
  'q3_no': '❌ Нет, не в тему'
};

// Question data according to PRD requirements
export const QUESTIONS = {
  1: {
    text: "На что чаще всего тратишь деньги в Steam?",
    options: [
      { text: "🎮 Игры — покупаю новинки и классику", value: "games" },
      { text: "✨ Внутриигровые штуки, кейсы, боевые пропуски", value: "items" },
      { text: "🧸 Другое — что-то ещё, не из этого", value: "other" },
      { text: "🧘 Вообще не трачу — просто сижу, не покупаю", value: "none" }
    ]
  },
  2: {
    text: "Пробовал(а) другие пополнялки?",
    options: [
      { text: "👍 Да, юзаю", value: "yes" },
      { text: "👌 Да, но забросил(а)", value: "abandoned" },
      { text: "❌ Нет", value: "no" }
    ]
  },
  3: {
    text: "Мы делаем пополнение в USD для всех стран (кроме UK) — гуд?",
    options: [
      { text: "✅ Да, ок", value: "yes" },
      { text: "🇬🇧 Я из Британии", value: "uk" },
      { text: "❌ Нет, не в тему", value: "no" }
    ]
  }
} as const;

// Save user response - now accepts full question and answer text
export async function saveResponse(
  userId: number,
  questionNumber: QuestionNumber,
  questionText: string,
  answerText: string
) {
  try {
    // Upsert response
    const [response] = await db('user_responses')
      .insert({
        user_id: userId,
        question_number: questionNumber,
        question_text: questionText,
        answer_text: answerText
      })
      .onConflict(['user_id', 'question_number'])
      .merge()
      .returning('*');

    logger.info('Saved questionnaire response', {
      userId,
      questionNumber,
      answerText
    });

    return response;
  } catch (error) {
    logger.error('Error saving questionnaire response', {
      error,
      userId,
      questionNumber
    });
    throw error;
  }
}

// Get all user responses
export async function getUserResponses(userId: number) {
  try {
    const responses = await db('user_responses')
      .where({ user_id: userId })
      .orderBy('question_number', 'asc');

    logger.debug('Retrieved user responses', {
      userId,
      count: responses.length
    });

    return responses;
  } catch (error) {
    logger.error('Error getting user responses', {
      error,
      userId
    });
    throw error;
  }
}

// Check if questionnaire is complete
export async function isQuestionnaireComplete(userId: number): Promise<boolean> {
  try {
    const responses = await getUserResponses(userId);
    
    // Check if we have all 3 questions answered
    const isComplete = responses.length === 3;

    logger.debug('Checked questionnaire completion', {
      userId,
      isComplete,
      responseCount: responses.length
    });

    return isComplete;
  } catch (error) {
    logger.error('Error checking questionnaire completion', {
      error,
      userId
    });
    throw error;
  }
}

// Get next question number
export async function getNextQuestionNumber(userId: number): Promise<QuestionNumber | null> {
  try {
    const responses = await getUserResponses(userId);
    
    // If all questions answered, return null
    if (responses.length >= 3) {
      return null;
    }

    // Next question is current count + 1
    const nextQuestion = (responses.length + 1) as QuestionNumber;

    logger.debug('Got next question number', {
      userId,
      nextQuestion
    });

    return nextQuestion;
  } catch (error) {
    logger.error('Error getting next question number', {
      error,
      userId
    });
    throw error;
  }
}

interface QuestionnaireAnswers {
  q1: string;
  q2: string;
  q3: string;
}

/**
 * Save questionnaire answers
 */
export async function saveQuestionnaireAnswers(
  userId: number,
  answers: QuestionnaireAnswers
): Promise<void> {
  try {
    await db('questionnaire_answers')
      .insert({
        user_id: userId,
        q1_answer: answers.q1,
        q2_answer: answers.q2,
        q3_answer: answers.q3,
        created_at: new Date()
      });

    logger.info('Questionnaire answers saved', {
      userId,
      answers
    });
  } catch (error) {
    logger.error('Error saving questionnaire answers', {
      error,
      userId
    });
    throw error;
  }
}

/**
 * Get questionnaire answers
 */
export async function getQuestionnaireAnswers(
  userId: number
): Promise<QuestionnaireAnswers | null> {
  try {
    const answers = await db('questionnaire_answers')
      .where({ user_id: userId })
      .first();

    return answers ? {
      q1: answers.q1_answer,
      q2: answers.q2_answer,
      q3: answers.q3_answer
    } : null;
  } catch (error) {
    logger.error('Error getting questionnaire answers', {
      error,
      userId
    });
    throw error;
  }
} 