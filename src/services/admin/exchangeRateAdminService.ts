import { logger } from '../../utils/logger';
import { exchangeRateService } from '../exchangeRate/exchangeRateService';
import { exchangeRateJobService } from '../jobs/exchangeRateJobService';
import { db } from '../../database/connection';

/**
 * Admin Service for Exchange Rate Management
 * PRD Requirement: Rate monitoring, manual updates, and system health
 */
class ExchangeRateAdminService {

  /**
   * Get comprehensive exchange rate dashboard data
   * PRD Requirement: Rate monitoring and analytics
   */
  async getDashboardData(): Promise<any> {
    try {
      const [
        currentRate,
        rateStatistics,
        jobStatistics,
        recentHistory,
        systemHealth
      ] = await Promise.all([
        this.getCurrentRateInfo(),
        exchangeRateService.getRateStatistics(),
        exchangeRateJobService.getDetailedStatistics(),
        this.getRecentRateHistory(),
        this.getSystemHealthMetrics()
      ]);

      return {
        current_rate: currentRate,
        statistics: rateStatistics,
        job_info: jobStatistics,
        recent_history: recentHistory,
        system_health: systemHealth,
        generated_at: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to get dashboard data', { error });
      throw new Error('Dashboard data unavailable');
    }
  }

  /**
   * Get current rate information with detailed metadata
   */
  private async getCurrentRateInfo(): Promise<any> {
    try {
      const result = await exchangeRateService.getCurrentUSDRUBRate();
      
      if (!result.success || !result.rate) {
        return {
          error: result.error,
          source: result.source,
          status: 'failed'
        };
      }

      const ageHours = Math.round(
        (Date.now() - new Date(result.rate.created_at!).getTime()) / (1000 * 60 * 60)
      );

      return {
        rate: result.rate.rate,
        source: result.source,
        status: result.rate.status,
        age_hours: ageHours,
        expires_at: result.rate.expires_at,
        created_at: result.rate.created_at,
        change: result.change,
        is_fresh: ageHours < 24,
        api_response: result.rate.api_response
      };

    } catch (error) {
      logger.error('Failed to get current rate info', { error });
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get recent rate history with change analysis
   */
  async getRecentRateHistory(limit: number = 20): Promise<any[]> {
    try {
      const history = await exchangeRateService.getRateHistory(limit);
      
      return history.map(record => ({
        id: record.id,
        event_type: record.event_type,
        rate: record.rate,
        source: record.source,
        change: {
          absolute: record.rate_change,
          percentage: record.rate_change_percent
        },
        created_at: record.created_at,
        notes: record.notes
      }));

    } catch (error) {
      logger.error('Failed to get rate history', { error });
      return [];
    }
  }

  /**
   * Get system health metrics
   */
  private async getSystemHealthMetrics(): Promise<any> {
    try {
      const [apiHealth, dbHealth, jobHealth] = await Promise.all([
        this.checkAPIHealth(),
        this.checkDatabaseHealth(),
        this.checkJobHealth()
      ]);

      return {
        api: apiHealth,
        database: dbHealth,
        job: jobHealth,
        overall: this.calculateOverallHealth(apiHealth, dbHealth, jobHealth)
      };

    } catch (error) {
      logger.error('Failed to get system health', { error });
      return { error: 'Health check failed' };
    }
  }

  /**
   * Check PayDigital API health
   */
  private async checkAPIHealth(): Promise<any> {
    try {
      // Check recent API failures
      const recentFailures = await db('exchange_rate_history')
        .where('event_type', 'failed')
        .where('source', 'paydigital_api')
        .where('created_at', '>=', db.raw("NOW() - INTERVAL '24 hours'"))
        .count('* as failure_count')
        .first();

      // Check last successful API call
      const lastSuccess = await db('exchange_rate_history')
        .where('event_type', 'updated')
        .where('source', 'paydigital_api')
        .orderBy('created_at', 'desc')
        .first();

      const failureCount = Number(recentFailures?.failure_count) || 0;
      const hoursFromLastSuccess = lastSuccess 
        ? Math.round((Date.now() - new Date(lastSuccess.created_at!).getTime()) / (1000 * 60 * 60))
        : null;

      return {
        status: failureCount < 5 && hoursFromLastSuccess && hoursFromLastSuccess < 48 ? 'healthy' : 'degraded',
        recent_failures: failureCount,
        last_success: lastSuccess?.created_at,
        hours_since_success: hoursFromLastSuccess
      };

    } catch (error) {
      return { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<any> {
    try {
      // Test database connectivity and basic operations
      const testQuery = await db('exchange_rates').count('* as count').first();
      const totalRates = testQuery?.count || 0;

      // Check for recent activity
      const recentActivity = await db('exchange_rate_history')
        .where('created_at', '>=', db.raw("NOW() - INTERVAL '24 hours'"))
        .count('* as count')
        .first();

      return {
        status: Number(totalRates) > 0 ? 'healthy' : 'warning',
        total_rates: totalRates,
        recent_activity: Number(recentActivity?.count) || 0,
        connection: 'active'
      };

    } catch (error) {
      return { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Database error',
        connection: 'failed'
      };
    }
  }

  /**
   * Check job health
   */
  private async checkJobHealth(): Promise<any> {
    try {
      const jobStatus = exchangeRateJobService.getJobStatus();
      
      return {
        status: jobStatus.jobActive && jobStatus.consecutiveFailures < 3 ? 'healthy' : 'warning',
        job_active: jobStatus.jobActive,
        consecutive_failures: jobStatus.consecutiveFailures,
        last_update: jobStatus.lastUpdateTime,
        next_run: jobStatus.nextScheduledRun
      };

    } catch (error) {
      return { status: 'error', error: error instanceof Error ? error.message : 'Job check failed' };
    }
  }

  /**
   * Calculate overall system health
   */
  private calculateOverallHealth(apiHealth: any, dbHealth: any, jobHealth: any): string {
    const statuses = [apiHealth.status, dbHealth.status, jobHealth.status];
    
    if (statuses.some(s => s === 'error')) return 'critical';
    if (statuses.some(s => s === 'degraded' || s === 'warning')) return 'warning';
    return 'healthy';
  }

  /**
   * Force manual rate update
   * PRD Requirement: Manual rate update capability
   */
  async forceRateUpdate(): Promise<any> {
    try {
      logger.info('Admin triggered manual rate update');
      
      await exchangeRateJobService.forceUpdate();
      const newRate = await exchangeRateService.getCurrentUSDRUBRate();

      // Log admin action
      await db('exchange_rate_history').insert({
        exchange_rate_id: newRate.rate?.id || 0,
        event_type: 'updated',
        event_source: 'manual',
        currency_pair: 'USD_RUB',
        rate: newRate.rate?.rate || 0,
        source: 'admin_manual_update',
        metadata: {
          admin_action: 'force_update',
          timestamp: new Date().toISOString()
        },
        notes: 'Manual rate update triggered by admin',
        created_at: new Date()
      });

      return {
        success: true,
        message: 'Rate update triggered successfully',
        new_rate: newRate.rate?.rate,
        source: newRate.source
      };

    } catch (error) {
      logger.error('Admin force update failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Update failed'
      };
    }
  }

  /**
   * Set manual exchange rate
   * PRD Requirement: Manual rate override capability
   */
  async setManualRate(rate: number, reason: string): Promise<any> {
    try {
      if (!this.isValidRate(rate)) {
        throw new Error('Invalid rate value');
      }

      logger.info('Admin setting manual rate', { rate, reason });

      // Create manual rate entry
      const manualRate = await this.saveManualRate(rate, reason);

      return {
        success: true,
        message: 'Manual rate set successfully',
        rate: manualRate.rate,
        expires_at: manualRate.expires_at
      };

    } catch (error) {
      logger.error('Failed to set manual rate', { error, rate, reason });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set rate'
      };
    }
  }

  /**
   * Save manual rate to database
   */
  private async saveManualRate(rate: number, reason: string): Promise<any> {
    return await db.transaction(async (trx) => {
      // Expire current active rate
      await trx('exchange_rates')
        .where('currency_pair', 'USD_RUB')
        .where('status', 'active')
        .update({ status: 'expired', updated_at: trx.fn.now() });

      // Insert manual rate
      const [rateId] = await trx('exchange_rates').insert({
        currency_pair: 'USD_RUB',
        rate: rate,
        source: 'manual',
        status: 'active',
        api_response: { manual_override: true, reason },
        expires_at: new Date(Date.now() + (24 * 60 * 60 * 1000)), // 24 hours
        created_at: trx.fn.now(),
        updated_at: trx.fn.now()
      });

      // Create history record
      await trx('exchange_rate_history').insert({
        exchange_rate_id: rateId,
        event_type: 'created',
        event_source: 'manual',
        currency_pair: 'USD_RUB',
        rate: rate,
        source: 'manual',
        metadata: { manual_override: true, reason },
        notes: `Manual rate set by admin: ${reason}`,
        created_at: trx.fn.now()
      });

      return await trx('exchange_rates').where('id', rateId).first();
    });
  }

  /**
   * Get rate change alerts
   * PRD Requirement: Rate monitoring and alerts
   */
  async getRateAlerts(): Promise<any[]> {
    try {
      const alerts = await db('exchange_rate_history')
        .where('metadata', 'like', '%notification_type%')
        .orWhere('metadata', 'like', '%alert_type%')
        .orderBy('created_at', 'desc')
        .limit(50);

      return alerts.map(alert => ({
        id: alert.id,
        type: this.extractAlertType(alert.metadata),
        message: alert.notes,
        severity: this.extractAlertSeverity(alert.metadata),
        created_at: alert.created_at,
        metadata: alert.metadata
      }));

    } catch (error) {
      logger.error('Failed to get rate alerts', { error });
      return [];
    }
  }

  /**
   * Extract alert type from metadata
   */
  private extractAlertType(metadata: any): string {
    try {
      const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      return parsed.notification_type || parsed.alert_type || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Extract alert severity from metadata
   */
  private extractAlertSeverity(metadata: any): string {
    try {
      const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      return parsed.severity || 'medium';
    } catch {
      return 'medium';
    }
  }

  /**
   * Validate rate value
   */
  private isValidRate(rate: number): boolean {
    return typeof rate === 'number' && 
           rate > 0 && 
           rate < 1000 && 
           !isNaN(rate) && 
           isFinite(rate);
  }

  /**
   * Export rate data for analysis
   * PRD Requirement: Data export for analysis
   */
  async exportRateData(days: number = 30): Promise<any> {
    try {
      const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
      
      const rateData = await db('exchange_rate_history')
        .where('currency_pair', 'USD_RUB')
        .where('created_at', '>=', cutoffDate)
        .orderBy('created_at', 'asc')
        .select([
          'created_at',
          'event_type',
          'rate',
          'source',
          'rate_change',
          'rate_change_percent',
          'notes'
        ]);

      return {
        export_date: new Date().toISOString(),
        period_days: days,
        total_records: rateData.length,
        data: rateData
      };

    } catch (error) {
      logger.error('Failed to export rate data', { error });
      throw new Error('Export failed');
    }
  }
}

// Export singleton instance
export const exchangeRateAdminService = new ExchangeRateAdminService(); 