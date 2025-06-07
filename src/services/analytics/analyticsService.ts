import { db } from '../../database/connection';
import { logger } from '../../utils/logger';

export interface AnalyticsEvent {
  userId: number;
  eventName: string;
  eventData?: Record<string, any>;
  createdAt?: Date;
}

export interface AnalyticsEventRow {
  id: number;
  user_id: number;
  event_name: string;
  event_data: Record<string, any>;
  created_at: Date;
}

class AnalyticsService {
  /**
   * Track an analytics event
   * This is async and non-blocking - errors won't affect user flow
   */
  async trackEvent(
    userId: number,
    eventName: string,
    eventData: Record<string, any> = {}
  ): Promise<void> {
    try {
      // Validate input
      if (!userId || !eventName) {
        logger.warn('Invalid analytics event parameters', { userId, eventName });
        return;
      }

      // Insert event into database
      await db('analytics_events').insert({
        user_id: userId,
        event_name: eventName,
        event_data: JSON.stringify(eventData),
        created_at: new Date()
      });

      logger.debug('Analytics event tracked', {
        userId,
        eventName,
        eventData
      });

    } catch (error) {
      // Log error but don't throw - analytics should never break user flow
      logger.error('Failed to track analytics event', {
        error: error instanceof Error ? error.message : error,
        userId,
        eventName,
        eventData
      });
    }
  }

  /**
   * Track bot start event
   */
  async trackBotStart(userId: number, source: string = 'telegram'): Promise<void> {
    await this.trackEvent(userId, 'bot_start', { source });
  }

  /**
   * Track questionnaire question answered
   */
  async trackQuestionnaireQuestionAnswered(
    userId: number,
    questionNumber: number,
    answer: string
  ): Promise<void> {
    await this.trackEvent(userId, 'questionnaire_question_answered', {
      questionNumber,
      answer
    });
  }

  /**
   * Track questionnaire completion
   */
  async trackQuestionnaireCompleted(
    userId: number,
    answers: Record<string, string>
  ): Promise<void> {
    await this.trackEvent(userId, 'questionnaire_completed', { answers });
  }

  /**
   * Track Steam validation attempt
   */
  async trackSteamValidationAttempted(
    userId: number,
    steamUsername: string
  ): Promise<void> {
    await this.trackEvent(userId, 'steam_validation_attempted', { steamUsername });
  }

  /**
   * Track successful Steam validation
   */
  async trackSteamValidationSuccess(
    userId: number,
    steamUsername: string,
    transactionId?: string
  ): Promise<void> {
    await this.trackEvent(userId, 'steam_validation_success', {
      steamUsername,
      transactionId
    });
  }

  /**
   * Track amount selection
   */
  async trackAmountSelected(
    userId: number,
    amountUSD: number,
    totalAmountRUB: number,
    selectionMethod: 'preset' | 'custom' = 'preset'
  ): Promise<void> {
    await this.trackEvent(userId, 'amount_selected', {
      amountUSD,
      totalAmountRUB,
      selectionMethod
    });
  }

  /**
   * Track payment link generation
   */
  async trackPaymentLinkGenerated(
    userId: number,
    amountUSD: number,
    totalAmountRUB: number,
    paymentProvider: string = 'paydigital'
  ): Promise<void> {
    await this.trackEvent(userId, 'payment_link_generated', {
      amountUSD,
      totalAmountRUB,
      paymentProvider
    });
  }

  /**
   * Track payment completion
   */
  async trackPaymentCompleted(
    userId: number,
    amountUSD: number,
    totalAmountRUB: number,
    transactionId: string
  ): Promise<void> {
    await this.trackEvent(userId, 'payment_completed', {
      amountUSD,
      totalAmountRUB,
      transactionId
    });
  }

  /**
   * Get analytics events for a user (for debugging/support)
   */
  async getUserEvents(
    userId: number,
    limit: number = 50
  ): Promise<AnalyticsEventRow[]> {
    try {
      const events = await db('analytics_events')
        .where('user_id', userId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .select('*');

      return events.map(event => ({
        ...event,
        event_data: typeof event.event_data === 'string' 
          ? JSON.parse(event.event_data) 
          : event.event_data
      }));

    } catch (error) {
      logger.error('Failed to get user analytics events', {
        error: error instanceof Error ? error.message : error,
        userId
      });
      return [];
    }
  }

  /**
   * Get event counts by name (for basic reporting)
   */
  async getEventCounts(
    startDate?: Date,
    endDate?: Date
  ): Promise<Record<string, number>> {
    try {
      let query = db('analytics_events')
        .select('event_name')
        .count('* as count')
        .groupBy('event_name');

      if (startDate) {
        query = query.where('created_at', '>=', startDate);
      }
      if (endDate) {
        query = query.where('created_at', '<=', endDate);
      }

      const results = await query;
      
      const counts: Record<string, number> = {};
      results.forEach(result => {
        counts[result.event_name] = Number(result.count);
      });

      return counts;

    } catch (error) {
      logger.error('Failed to get event counts', {
        error: error instanceof Error ? error.message : error
      });
      return {};
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService(); 