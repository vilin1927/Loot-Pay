import { CronJob } from 'cron';
import { logger } from '../../utils/logger';
import { exchangeRateService } from '../exchangeRate/exchangeRateService';
import { db } from '../../database/connection';

/**
 * Background Job Service for Exchange Rate Updates
 * PRD Requirement: Automated daily exchange rate updates (modified from 2-hour to 24-hour)
 */
class ExchangeRateJobService {
  private cronJob: CronJob | null = null;
  private isRunning = false;
  private lastUpdateTime: Date | null = null;
  private consecutiveFailures = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 5;

  /**
   * Start the exchange rate update job
   * Runs every day at 9:00 AM Moscow time (6:00 AM UTC)
   * PRD Requirement: Automated rate updates
   */
  startJob(): void {
    if (this.cronJob) {
      logger.warn('Exchange rate job already running');
      return;
    }

    // Modified: 24-hour schedule instead of 2-hour
    // Cron: '0 6 * * *' = Every day at 6:00 AM UTC (9:00 AM Moscow)
    this.cronJob = new CronJob(
      '0 6 * * *', // Daily at 6:00 AM UTC
      this.performRateUpdate.bind(this),
      null, // onComplete
      true, // start immediately
      'UTC' // timezone
    );

    logger.info('Exchange rate update job started', {
      schedule: 'Daily at 6:00 AM UTC (9:00 AM Moscow)',
      timezone: 'UTC'
    });
  }

  /**
   * Stop the exchange rate update job
   */
  stopJob(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Exchange rate update job stopped');
    }
  }

  /**
   * Force an immediate rate update (for manual triggers)
   * PRD Requirement: Manual rate update capability
   */
  async forceUpdate(): Promise<void> {
    logger.info('Force updating exchange rate');
    await this.performRateUpdate();
  }

  /**
   * Perform the actual rate update
   * PRD Requirement: Rate update with error handling and notifications
   */
  private async performRateUpdate(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Exchange rate update already in progress, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting scheduled exchange rate update');

      // Get previous rate for comparison (used for change tracking)
      await this.getPreviousRate();

      // Update rate using the service
      const result = await exchangeRateService.forceUpdateRate();

      if (result.success && result.rate) {
        this.consecutiveFailures = 0;
        this.lastUpdateTime = new Date();

        // Log rate change if applicable
        if (result.change) {
          const changeInfo = {
            previous: result.change.previous,
            current: result.change.current,
            absolute: result.change.absolute,
            percentage: result.change.percentage
          };

          logger.info('Exchange rate updated with change', changeInfo);

          // Check for significant changes (>5%) and log as warning
          if (Math.abs(result.change.percentage) > 5) {
            logger.warn('Significant exchange rate change detected', {
              ...changeInfo,
              threshold: '5%',
              severity: 'high'
            });

            // In production, this would trigger notifications
            await this.notifySignificantRateChange(changeInfo);
          }
        } else {
          logger.info('Exchange rate updated (no change)', {
            rate: result.rate.rate,
            source: result.source
          });
        }

        // Update job statistics
        await this.updateJobStatistics('success', startTime);

      } else {
        throw new Error(result.error || 'Rate update failed');
      }

    } catch (error) {
      this.consecutiveFailures++;
      
      logger.error('Exchange rate update failed', {
        error: error instanceof Error ? error.message : error,
        consecutiveFailures: this.consecutiveFailures,
        maxFailures: this.MAX_CONSECUTIVE_FAILURES
      });

      // Handle consecutive failures
      if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        logger.error('Maximum consecutive failures reached for exchange rate updates', {
          consecutiveFailures: this.consecutiveFailures,
          action: 'fallback_rate_activated'
        });

        // In production, this would trigger alerts
        await this.notifyConsecutiveFailures();
      }

      await this.updateJobStatistics('failure', startTime, error);

    } finally {
      this.isRunning = false;
      
      const duration = Date.now() - startTime;
      logger.info('Exchange rate update completed', {
        duration: `${duration}ms`,
        success: this.consecutiveFailures === 0
      });
    }
  }

  /**
   * Get the most recent exchange rate for comparison
   */
  private async getPreviousRate(): Promise<number | null> {
    try {
      const previousRate = await db('exchange_rates')
        .where('currency_pair', 'USD_RUB')
        .where('status', 'active')
        .orderBy('created_at', 'desc')
        .first();

      return previousRate?.rate || null;
    } catch (error) {
      logger.error('Failed to get previous rate', { error });
      return null;
    }
  }

  /**
   * Notify about significant rate changes
   * PRD Requirement: Rate change notifications
   */
  private async notifySignificantRateChange(changeInfo: any): Promise<void> {
    try {
      // Store notification in database for monitoring
      await db('exchange_rate_history').insert({
        exchange_rate_id: 0, // System notification
        event_type: 'updated',
        event_source: 'cron_job',
        currency_pair: 'USD_RUB',
        rate: changeInfo.current,
        source: 'system_notification',
        previous_rate: changeInfo.previous,
        rate_change: changeInfo.absolute,
        rate_change_percent: changeInfo.percentage,
        metadata: {
          notification_type: 'significant_change',
          threshold: '5%',
          severity: 'high'
        },
        notes: `Significant rate change: ${changeInfo.percentage.toFixed(2)}%`,
        created_at: new Date()
      });

      // In production: Send notifications via Telegram, email, etc.
      logger.info('Significant rate change notification recorded');

    } catch (error) {
      logger.error('Failed to record rate change notification', { error });
    }
  }

  /**
   * Notify about consecutive failures
   * PRD Requirement: Failure monitoring and alerts
   */
  private async notifyConsecutiveFailures(): Promise<void> {
    try {
      // Store alert in database
      await db('exchange_rate_history').insert({
        exchange_rate_id: 0, // System alert
        event_type: 'failed',
        event_source: 'cron_job',
        currency_pair: 'USD_RUB',
        rate: 0,
        source: 'system_alert',
        metadata: {
          alert_type: 'consecutive_failures',
          failure_count: this.consecutiveFailures,
          max_failures: this.MAX_CONSECUTIVE_FAILURES
        },
        notes: `${this.consecutiveFailures} consecutive rate update failures`,
        created_at: new Date()
      });

      // In production: Send critical alerts via multiple channels
      logger.error('Consecutive failures alert recorded');

    } catch (error) {
      logger.error('Failed to record consecutive failures alert', { error });
    }
  }

  /**
   * Update job execution statistics
   * PRD Requirement: Job monitoring and analytics
   */
  private async updateJobStatistics(status: 'success' | 'failure', startTime: number, error?: any): Promise<void> {
    try {
      const duration = Date.now() - startTime;
      
      await db('exchange_rate_history').insert({
        exchange_rate_id: 0, // System statistics
        event_type: status === 'success' ? 'updated' : 'failed',
        event_source: 'cron_job',
        currency_pair: 'USD_RUB',
        rate: 0,
        source: 'job_statistics',
        metadata: {
          job_status: status,
          duration_ms: duration,
          consecutive_failures: this.consecutiveFailures,
          error_message: error instanceof Error ? error.message : error
        },
        notes: `Job execution: ${status} (${duration}ms)`,
        created_at: new Date()
      });

    } catch (dbError) {
      logger.error('Failed to update job statistics', { error: dbError });
    }
  }

  /**
   * Get job status and statistics
   * PRD Requirement: Monitoring and health checks
   */
  getJobStatus(): any {
    return {
      isRunning: this.isRunning,
      jobActive: this.cronJob !== null,
      lastUpdateTime: this.lastUpdateTime,
      consecutiveFailures: this.consecutiveFailures,
      maxFailures: this.MAX_CONSECUTIVE_FAILURES,
      schedule: 'Daily at 6:00 AM UTC (9:00 AM Moscow)',
      nextScheduledRun: this.cronJob?.nextDate()?.toString() || null
    };
  }

  /**
   * Get detailed job statistics from database
   * PRD Requirement: Job performance monitoring
   */
  async getDetailedStatistics(): Promise<any> {
    try {
      const [dailyStats, weeklyStats, recentFailures] = await Promise.all([
        // Daily statistics
        db('exchange_rate_history')
          .where('event_source', 'cron_job')
          .where('created_at', '>=', db.raw("NOW() - INTERVAL '24 hours'"))
          .select(
            db.raw('COUNT(*) as total_runs'),
            db.raw("SUM(CASE WHEN event_type = 'updated' THEN 1 ELSE 0 END) as successes"),
            db.raw("SUM(CASE WHEN event_type = 'failed' THEN 1 ELSE 0 END) as failures"),
            db.raw("AVG(CAST(metadata->>'duration_ms' AS INTEGER)) as avg_duration_ms")
          )
          .first(),

        // Weekly statistics
        db('exchange_rate_history')
          .where('event_source', 'cron_job')
          .where('created_at', '>=', db.raw("NOW() - INTERVAL '7 days'"))
          .select(
            db.raw('COUNT(*) as total_runs'),
            db.raw("SUM(CASE WHEN event_type = 'updated' THEN 1 ELSE 0 END) as successes"),
            db.raw("SUM(CASE WHEN event_type = 'failed' THEN 1 ELSE 0 END) as failures")
          )
          .first(),

        // Recent failures
        db('exchange_rate_history')
          .where('event_source', 'cron_job')
          .where('event_type', 'failed')
          .orderBy('created_at', 'desc')
          .limit(10)
          .select('created_at', 'metadata', 'notes')
      ]);

      return {
        current_status: this.getJobStatus(),
        daily_stats: dailyStats,
        weekly_stats: weeklyStats,
        recent_failures: recentFailures
      };

    } catch (error) {
      logger.error('Failed to get detailed job statistics', { error });
      return null;
    }
  }
}

// Export singleton instance
export const exchangeRateJobService = new ExchangeRateJobService(); 