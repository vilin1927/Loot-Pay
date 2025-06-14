import { db } from '../../database/connection';
import { logger } from '../../utils/logger';

export async function startSurvey(userId: number): Promise<number> {
  const [survey] = await db('surveys')
    .insert({ user_id: userId })
    .returning('*');
  logger.info('Survey started', { userId, surveyId: survey.id });
  return survey.id;
}

export async function skipSurvey(userId: number): Promise<void> {
  await db('surveys').insert({ user_id: userId, skipped: true, completed_at: db.fn.now() });
  logger.info('Survey skipped', { userId });
}

export async function saveAnswer(
  userId: number,
  questionNo: 1 | 2 | 3,
  answerCode: string,
  freeText?: string
): Promise<void> {
  const survey = await db('surveys')
    .where({ user_id: userId, completed_at: null, skipped: false })
    .orderBy('started_at', 'desc')
    .first();
  if (!survey) {
    throw new Error('No active survey for user');
  }
  const update: any = {};
  if (questionNo === 1) update.q1_answer = answerCode;
  if (questionNo === 2) {
    update.q2_answer = answerCode;
    if (answerCode === '1' && freeText) update.q2_text = freeText;
  }
  if (questionNo === 3) update.q3_answer = answerCode;
  await db('surveys').where({ id: survey.id }).update(update);
  logger.info('Survey answer saved', { surveyId: survey.id, questionNo, answerCode });
}

export async function completeSurvey(userId: number): Promise<void> {
  await db('surveys')
    .where({ user_id: userId, completed_at: null, skipped: false })
    .orderBy('started_at', 'desc')
    .update({ completed_at: db.fn.now() });
  logger.info('Survey completed', { userId });
} 