import { db } from '../../database/connection';
import { logger } from '../../utils/logger';

// Question types
export type QuestionNumber = 1 | 2 | 3;

// Question data
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
    text: "Как давно ты пользуешься Steam?",
    options: [
      { text: "🆕 Меньше года", value: "less_than_year" },
      { text: "⏳ 1-3 года", value: "1_to_3_years" },
      { text: "⏳ Больше 3 лет", value: "more_than_3_years" },
      { text: "❓ Не помню", value: "dont_remember" }
    ]
  },
  3: {
    text: "Как часто ты пополняешь Steam?",
    options: [
      { text: "💰 Раз в неделю или чаще", value: "weekly" },
      { text: "📅 Раз в месяц", value: "monthly" },
      { text: "⏳ Раз в несколько месяцев", value: "few_months" },
      { text: "❌ Никогда не пополнял", value: "never" }
    ]
  }
} as const;

// Save user response
export async function saveResponse(
  userId: number,
  questionNumber: QuestionNumber,
  answer: string
) {
  try {
    // Upsert response
    const [response] = await db('user_responses')
      .insert({
        user_id: userId,
        question_number: questionNumber,
        question_text: QUESTIONS[questionNumber].text,
        answer_text: answer
      })
      .onConflict(['user_id', 'question_number'])
      .merge()
      .returning('*');

    logger.info('Saved questionnaire response', {
      userId,
      questionNumber,
      answer
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