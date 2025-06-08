import { db } from '../../database/connection';
import { logger } from '../../utils/logger';



interface AlertThresholds {
  apiResponseTime: number; // 5 seconds
  errorRate: number; // 10%
  exchangeRateFailures: number; // consecutive failures
}

class PerformanceMonitor {
  private readonly alertThresholds: AlertThresholds = {
    apiResponseTime: 5000, // 5 seconds
    errorRate: 0.10, // 10%
    exchangeRateFailures: 3 // 3 consecutive failures
  };

  private tableExists: boolean | null = null;
  private tableCheckPromise: Promise<boolean> | null = null;

  /**
   * Ensure performance_metrics table exists
   */
  private async ensureTableExists(): Promise<boolean> {
    if (this.tableExists !== null) {
      return this.tableExists;
    }
    
    if (this.tableCheckPromise) {
      return await this.tableCheckPromise;
    }

    this.tableCheckPromise = this.createTableIfNotExists();
    this.tableExists = await this.tableCheckPromise;
    return this.tableExists;
  }

  private async createTableIfNotExists(): Promise<boolean> {
    try {
      // Check if table exists
      const exists = await db.schema.hasTable('performance_metrics');
      
      if (!exists) {
        logger.info('Creating performance_metrics table', { service: 'performance-monitor' });
        
        await db.schema.createTable('performance_metrics', (table) => {
          table.increments('id').primary();
          table.string('metric_name').notNullable();
          table.decimal('metric_value', 12, 4).notNullable();
          table.text('metadata'); // JSON string
          table.timestamp('created_at').defaultTo(db.fn.now());
          
          // Add indexes for common queries
          table.index('metric_name');
          table.index('created_at');
          table.index(['metric_name', 'created_at']);
        });
        
        logger.info('Performance_metrics table created successfully', { service: 'performance-monitor' });
        return true;
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to create performance_metrics table', {
        service: 'performance-monitor',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Record a performance metric
   */
  async recordMetric(metricName: string, metricValue: number, metadata: Record<string, any> = {}): Promise<void> {
    try {
      const tableReady = await this.ensureTableExists();
      if (!tableReady) {
        logger.warn('Performance metrics table not available, skipping metric recording', {
          service: 'performance-monitor',
          metricName
        });
        return;
      }

      await db('performance_metrics').insert({
        metric_name: metricName,
        metric_value: metricValue,
        metadata: JSON.stringify(metadata),
        created_at: new Date()
      });

      logger.debug('Performance metric recorded', {
        service: 'performance-monitor',
        metricName,
        metricValue,
        metadata
      });

      // Check for alerts
      await this.checkAlerts(metricName, metricValue, metadata);

    } catch (error) {
      // Don't throw errors for monitoring - log and continue
      logger.error('Failed to record performance metric', {
        service: 'performance-monitor',
        error: error instanceof Error ? error.message : 'Unknown error',
        metricName,
        metricValue,
        metadata
      });
    }
  }

  /**
   * Start a timer for measuring execution time
   */
  startTimer(metricName: string): { end: (metadata?: Record<string, any>) => void } {
    const startTime = Date.now();

    return {
      end: async (metadata: Record<string, any> = {}) => {
        const duration = Date.now() - startTime;
        await this.recordMetric(`${metricName}_duration_ms`, duration, {
          ...metadata,
          startTime: new Date(startTime).toISOString()
        });
      }
    };
  }

  /**
   * Record API response time
   */
  async recordApiResponseTime(
    endpoint: string, 
    duration: number, 
    success: boolean,
    statusCode?: number,
    provider?: string
  ): Promise<void> {
    await this.recordMetric('api_response_time_ms', duration, {
      endpoint,
      success,
      statusCode,
      provider,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Record error occurrence
   */
  async recordError(
    errorType: string,
    service: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    await this.recordMetric('error_count', 1, {
      errorType,
      service,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Record database query performance
   */
  async recordDatabaseQuery(
    operation: string,
    tableName: string,
    duration: number,
    success: boolean
  ): Promise<void> {
    await this.recordMetric('database_query_duration_ms', duration, {
      operation,
      tableName,
      success,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Record memory usage
   */
  async recordMemoryUsage(): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage();
      
      await this.recordMetric('memory_heap_used_mb', memoryUsage.heapUsed / 1024 / 1024);
      await this.recordMetric('memory_heap_total_mb', memoryUsage.heapTotal / 1024 / 1024);
      await this.recordMetric('memory_rss_mb', memoryUsage.rss / 1024 / 1024);
      
    } catch (error) {
      logger.error('Failed to record memory usage', {
        service: 'performance-monitor',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Record exchange rate fetch result
   */
  async recordExchangeRateFetch(
    provider: string,
    duration: number,
    success: boolean,
    rate?: number,
    error?: string
  ): Promise<void> {
    await this.recordMetric('exchange_rate_fetch_duration_ms', duration, {
      provider,
      success,
      rate,
      error,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Check for performance alerts
   */
  private async checkAlerts(metricName: string, metricValue: number, metadata: Record<string, any>): Promise<void> {
    try {
      // API Response Time Alert
      if (metricName.includes('api_response_time_ms') && metricValue > this.alertThresholds.apiResponseTime) {
        logger.warn('API Response Time Alert', {
          service: 'performance-monitor',
          alert: 'API_RESPONSE_TIME_HIGH',
          metricValue,
          threshold: this.alertThresholds.apiResponseTime,
          metadata
        });
      }

      // Error Rate Alert (check last 10 API calls)
      if (metricName.includes('api_response_time_ms')) {
        const recentApiCalls = await this.getRecentMetrics('api_response_time_ms', 10);
        const errorCount = recentApiCalls.filter(metric => {
          const metaData = typeof metric.metadata === 'string' ? JSON.parse(metric.metadata) : metric.metadata;
          return !metaData?.success;
        }).length;
        
        const errorRate = errorCount / recentApiCalls.length;
        if (errorRate > this.alertThresholds.errorRate) {
          logger.warn('Error Rate Alert', {
            service: 'performance-monitor',
            alert: 'ERROR_RATE_HIGH',
            errorRate,
            threshold: this.alertThresholds.errorRate,
            recentCalls: recentApiCalls.length
          });
        }
      }

      // Exchange Rate Fetch Failures Alert
      if (metricName.includes('exchange_rate_fetch') && !metadata.success) {
        const recentExchangeRateCalls = await this.getRecentMetrics('exchange_rate_fetch_duration_ms', 5);
        const consecutiveFailures = this.countConsecutiveFailures(recentExchangeRateCalls);
        
        if (consecutiveFailures >= this.alertThresholds.exchangeRateFailures) {
          logger.error('Exchange Rate Fetch Failures Alert', {
            service: 'performance-monitor',
            alert: 'EXCHANGE_RATE_FAILURES',
            consecutiveFailures,
            threshold: this.alertThresholds.exchangeRateFailures
          });
        }
      }

    } catch (error) {
      logger.error('Failed to check performance alerts', {
        service: 'performance-monitor',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get recent metrics for analysis
   */
  private async getRecentMetrics(metricName: string, limit: number): Promise<any[]> {
    try {
      const tableReady = await this.ensureTableExists();
      if (!tableReady) {
        return [];
      }

      return await db('performance_metrics')
        .where('metric_name', 'like', `%${metricName}%`)
        .orderBy('created_at', 'desc')
        .limit(limit);
    } catch (error) {
      logger.error('Failed to get recent metrics', {
        service: 'performance-monitor',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Count consecutive failures in metrics
   */
  private countConsecutiveFailures(metrics: any[]): number {
    let failures = 0;
    for (const metric of metrics) {
      const metadata = typeof metric.metadata === 'string' ? JSON.parse(metric.metadata) : metric.metadata;
      if (!metadata?.success) {
        failures++;
      } else {
        break; // Stop counting on first success
      }
    }
    return failures;
  }

  /**
   * Get performance summary
   */
  async getPerformanceSummary(hours: number = 24): Promise<Record<string, any>> {
    try {
      const tableReady = await this.ensureTableExists();
      if (!tableReady) {
        return { error: 'Performance metrics table not available' };
      }

      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const metrics = await db('performance_metrics')
        .where('created_at', '>=', since)
        .select('metric_name', 'metric_value', 'metadata', 'created_at');

      const summary = {
        timeRange: `Last ${hours} hours`,
        totalMetrics: metrics.length,
        apiCalls: metrics.filter(m => m.metric_name.includes('api_response_time')).length,
        averageApiResponseTime: 0,
        errorCount: metrics.filter(m => m.metric_name === 'error_count').length,
        exchangeRateFetches: metrics.filter(m => m.metric_name.includes('exchange_rate_fetch')).length
      };

      // Calculate average API response time
      const apiResponseTimes = metrics
        .filter(m => m.metric_name.includes('api_response_time'))
        .map(m => Number(m.metric_value));
      
      if (apiResponseTimes.length > 0) {
        summary.averageApiResponseTime = apiResponseTimes.reduce((a, b) => a + b, 0) / apiResponseTimes.length;
      }

      return summary;
    } catch (error) {
      logger.error('Failed to get performance summary', {
        service: 'performance-monitor',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { error: 'Failed to generate performance summary' };
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor(); 