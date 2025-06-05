import axios from 'axios';
import { logger } from '../../utils/logger';
import { db } from '../../database/connection';

// Types for exchange rate system
export interface ExchangeRate {
  id?: number;
  currency_pair: string;
  rate: number;
  source: 'paydigital_api' | 'fallback' | 'manual';
  status: 'active' | 'expired' | 'failed';
  api_response?: any;
  previous_rate?: number;
  rate_change?: number;
  rate_change_percent?: number;
  created_at?: Date;
  expires_at?: Date;
  updated_at?: Date;
}

export interface ExchangeRateHistory {
  id?: number;
  exchange_rate_id: number;
  event_type: 'created' | 'updated' | 'expired' | 'failed';
  event_source: 'cron_job' | 'manual' | 'api_fallback' | 'migration';
  currency_pair: string;
  rate: number;
  source: string;
  previous_rate?: number;
  rate_change?: number;
  rate_change_percent?: number;
  metadata?: any;
  notes?: string;
  created_at?: Date;
}

export interface RateUpdateResult {
  success: boolean;
  rate?: ExchangeRate;
  error?: string;
  source: 'paydigital_api' | 'fallback' | 'database_cache';
  change?: {
    previous: number;
    current: number;
    absolute: number;
    percentage: number;
  };
}

class ExchangeRateService {
  private readonly DEFAULT_FALLBACK_RATE = 80.0;
  private readonly CACHE_DURATION_HOURS = 24; // Modified to 24 hours as requested
  private readonly API_TIMEOUT_MS = 5000;
  private readonly PAYDIGITAL_API_URL = 'https://foreign.foreignpay.ru';
  private readonly PAYDIGITAL_API_KEY = process.env.PAYDIGITAL_API_KEY!;

  /**
   * Get current USD to RUB exchange rate
   * PRD Requirement: Try PayDigital API first, fallback to database cache, then hardcoded fallback
   */
  async getCurrentUSDRUBRate(): Promise<RateUpdateResult> {
    try {
      logger.info('Getting current USD_RUB exchange rate');

      // Step 1: Try to get fresh rate from PayDigital API
      const apiResult = await this.fetchFromPayDigitalAPI();
      if (apiResult.success && apiResult.rate) {
        logger.info('Successfully fetched rate from PayDigital API', { 
          rate: apiResult.rate.rate,
          source: apiResult.source 
        });
        return apiResult;
      }

      // Step 2: Fallback to database cache if API fails
      const cacheResult = await this.getFromDatabaseCache();
      if (cacheResult.success && cacheResult.rate) {
        logger.info('Using cached rate from database', { 
          rate: cacheResult.rate.rate,
          age_hours: this.getAgeInHours(cacheResult.rate.created_at!)
        });
        return cacheResult;
      }

      // Step 3: Final fallback to hardcoded rate
      const fallbackResult = await this.createFallbackRate();
      logger.warn('Using hardcoded fallback rate', { 
        rate: fallbackResult.rate?.rate,
        reason: 'API and cache both failed'
      });
      return fallbackResult;

    } catch (error) {
      logger.error('Critical error in getCurrentUSDRUBRate', { error });
      
      // Emergency fallback
      return {
        success: false,
        error: 'Critical exchange rate service failure',
        source: 'fallback'
      };
    }
  }

  /**
   * Fetch exchange rate from PayDigital API
   * PRD Requirement: Primary source for exchange rates
   */
  private async fetchFromPayDigitalAPI(): Promise<RateUpdateResult> {
    try {
      logger.info('Fetching exchange rate from PayDigital API');

      const response = await axios.get(
        `${this.PAYDIGITAL_API_URL}/rates`,
        {
          headers: {
            'X-Partner-ID': this.PAYDIGITAL_API_KEY,
            'Content-Type': 'application/json'
          },
          timeout: this.API_TIMEOUT_MS
        }
      );

      if (response.status === 200 && response.data.USD_RUB) {
        const rate = parseFloat(response.data.USD_RUB);
        
        if (this.isValidRate(rate)) {
          // Save to database and create history
          const savedRate = await this.saveRateToDatabase({
            currency_pair: 'USD_RUB',
            rate: rate,
            source: 'paydigital_api',
            status: 'active',
            api_response: response.data,
            expires_at: new Date(Date.now() + (this.CACHE_DURATION_HOURS * 60 * 60 * 1000))
          });

          return {
            success: true,
            rate: savedRate,
            source: 'paydigital_api',
            change: savedRate.rate_change ? {
              previous: savedRate.previous_rate!,
              current: savedRate.rate,
              absolute: savedRate.rate_change,
              percentage: savedRate.rate_change_percent!
            } : undefined
          };
        } else {
          throw new Error(`Invalid rate received: ${rate}`);
        }
      } else {
        throw new Error(`API returned status ${response.status}`);
      }

    } catch (error) {
      logger.error('PayDigital API request failed', { 
        error: error instanceof Error ? error.message : error 
      });

      // Mark API as failed for monitoring
      await this.recordFailedAPIAttempt(error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown API error',
        source: 'paydigital_api'
      };
    }
  }

  /**
   * Get cached exchange rate from database
   * PRD Requirement: Database caching for reliability
   */
  private async getFromDatabaseCache(): Promise<RateUpdateResult> {
    try {
      const cachedRate = await db('exchange_rates')
        .where('currency_pair', 'USD_RUB')
        .where('status', 'active')
        .where('expires_at', '>', db.fn.now())
        .orderBy('created_at', 'desc')
        .first();

      if (cachedRate && this.isValidRate(cachedRate.rate)) {
        return {
          success: true,
          rate: cachedRate,
          source: 'database_cache'
        };
      }

      // Check for any rate (even expired) as emergency fallback
      const anyRate = await db('exchange_rates')
        .where('currency_pair', 'USD_RUB')
        .orderBy('created_at', 'desc')
        .first();

      if (anyRate && this.isValidRate(anyRate.rate)) {
        logger.warn('Using expired cached rate as fallback', { 
          rate: anyRate.rate,
          age_hours: this.getAgeInHours(anyRate.created_at)
        });

        return {
          success: true,
          rate: anyRate,
          source: 'database_cache'
        };
      }

      return {
        success: false,
        error: 'No valid cached rates found',
        source: 'database_cache'
      };

    } catch (error) {
      logger.error('Database cache lookup failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Database error',
        source: 'database_cache'
      };
    }
  }

  /**
   * Create fallback rate when all else fails
   * PRD Requirement: Always have a working rate
   */
  private async createFallbackRate(): Promise<RateUpdateResult> {
    try {
      const fallbackRate = await this.saveRateToDatabase({
        currency_pair: 'USD_RUB',
        rate: this.DEFAULT_FALLBACK_RATE,
        source: 'fallback',
        status: 'active',
        api_response: { 
          note: 'Emergency fallback rate',
          timestamp: new Date().toISOString()
        },
        expires_at: new Date(Date.now() + (this.CACHE_DURATION_HOURS * 60 * 60 * 1000))
      });

      return {
        success: true,
        rate: fallbackRate,
        source: 'fallback'
      };

    } catch (error) {
      logger.error('Failed to create fallback rate', { error });
      
      // Return in-memory fallback as last resort
      return {
        success: true,
        rate: {
          currency_pair: 'USD_RUB',
          rate: this.DEFAULT_FALLBACK_RATE,
          source: 'fallback',
          status: 'active',
          created_at: new Date()
        },
        source: 'fallback'
      };
    }
  }

  /**
   * Save exchange rate to database with change tracking
   * PRD Requirement: Store all rates with history
   */
  private async saveRateToDatabase(rateData: Partial<ExchangeRate>): Promise<ExchangeRate> {
    return await db.transaction(async (trx) => {
      try {
        // Get previous rate for change calculation
        const previousRate = await trx('exchange_rates')
          .where('currency_pair', rateData.currency_pair)
          .where('status', 'active')
          .orderBy('created_at', 'desc')
          .first();

        // Calculate rate changes
        let rateChange = 0;
        let rateChangePercent = 0;
        
        if (previousRate && previousRate.rate !== rateData.rate) {
          rateChange = rateData.rate! - previousRate.rate;
          rateChangePercent = (rateChange / previousRate.rate) * 100;
          
          // Expire previous rate
          await trx('exchange_rates')
            .where('id', previousRate.id)
            .update({ status: 'expired', updated_at: trx.fn.now() });
        }

        // Insert new rate
        const newRateData = {
          ...rateData,
          previous_rate: previousRate?.rate || null,
          rate_change: rateChange,
          rate_change_percent: rateChangePercent,
          created_at: trx.fn.now(),
          updated_at: trx.fn.now()
        };

        const [rateId] = await trx('exchange_rates').insert(newRateData);
        const savedRate = await trx('exchange_rates').where('id', rateId).first();

        // Create history record
        await this.createHistoryRecord(trx, {
          exchange_rate_id: rateId,
          event_type: previousRate ? 'updated' : 'created',
          event_source: 'cron_job', // Will be overridden by caller context
          currency_pair: rateData.currency_pair!,
          rate: rateData.rate!,
          source: rateData.source!,
          previous_rate: previousRate?.rate || null,
          rate_change: rateChange,
          rate_change_percent: rateChangePercent,
          metadata: {
            api_response: rateData.api_response,
            expires_at: rateData.expires_at
          }
        });

        logger.info('Exchange rate saved to database', {
          rate: savedRate.rate,
          source: savedRate.source,
          change: rateChange,
          change_percent: rateChangePercent
        });

        return savedRate;

      } catch (error) {
        logger.error('Failed to save rate to database', { error, rateData });
        throw error;
      }
    });
  }

  /**
   * Create history record for rate changes
   * PRD Requirement: Audit trail for all rate changes
   */
  private async createHistoryRecord(trx: any, historyData: Partial<ExchangeRateHistory>): Promise<void> {
    await trx('exchange_rate_history').insert({
      ...historyData,
      created_at: trx.fn.now()
    });
  }

  /**
   * Record failed API attempts for monitoring
   * PRD Requirement: Track API failures for reliability monitoring
   */
  private async recordFailedAPIAttempt(error: any): Promise<void> {
    try {
      await this.createHistoryRecord(db, {
        exchange_rate_id: 0, // No associated rate
        event_type: 'failed',
        event_source: 'cron_job',
        currency_pair: 'USD_RUB',
        rate: 0,
        source: 'paydigital_api',
        metadata: {
          error_message: error instanceof Error ? error.message : error,
          timestamp: new Date().toISOString()
        },
        notes: 'PayDigital API request failed'
      });
    } catch (historyError) {
      logger.error('Failed to record API failure in history', { historyError });
    }
  }

  /**
   * Force update exchange rate (for manual updates)
   * PRD Requirement: Manual rate updates capability
   */
  async forceUpdateRate(): Promise<RateUpdateResult> {
    logger.info('Force updating exchange rate');
    return await this.fetchFromPayDigitalAPI();
  }

  /**
   * Get exchange rate history for monitoring
   * PRD Requirement: Rate change tracking and monitoring
   */
  async getRateHistory(limit: number = 50): Promise<ExchangeRateHistory[]> {
    try {
      return await db('exchange_rate_history')
        .where('currency_pair', 'USD_RUB')
        .orderBy('created_at', 'desc')
        .limit(limit);
    } catch (error) {
      logger.error('Failed to get rate history', { error });
      return [];
    }
  }

  /**
   * Get rate statistics for monitoring
   * PRD Requirement: Rate monitoring and analytics
   */
  async getRateStatistics(): Promise<any> {
    try {
      const [current, daily, weekly] = await Promise.all([
        // Current rate
        db('exchange_rates')
          .where('currency_pair', 'USD_RUB')
          .where('status', 'active')
          .orderBy('created_at', 'desc')
          .first(),
        
                // Daily statistics
        db('exchange_rate_history')
          .where('currency_pair', 'USD_RUB')
          .where('created_at', '>=', db.raw("NOW() - INTERVAL '24 hours'"))
          .select(
            db.raw('MIN(rate) as min_rate'),
            db.raw('MAX(rate) as max_rate'),
            db.raw('AVG(rate) as avg_rate'),
            db.raw('COUNT(*) as update_count')
          )
          .first(),

        // Weekly trend
        db('exchange_rate_history')
          .where('currency_pair', 'USD_RUB')
          .where('created_at', '>=', db.raw("NOW() - INTERVAL '7 days'"))
          .select(
            db.raw('MIN(rate) as min_rate'),
            db.raw('MAX(rate) as max_rate'),
            db.raw('AVG(rate) as avg_rate'),
            db.raw('COUNT(*) as update_count')
          )
          .first()
      ]);

      return {
        current: current?.rate || 0,
        source: current?.source || 'unknown',
        last_updated: current?.created_at,
        daily: daily,
        weekly: weekly
      };

    } catch (error) {
      logger.error('Failed to get rate statistics', { error });
      return null;
    }
  }

  /**
   * Utility functions
   */
  private isValidRate(rate: number): boolean {
    return typeof rate === 'number' && 
           rate > 0 && 
           rate < 1000 && // Reasonable upper bound for USD_RUB
           !isNaN(rate) && 
           isFinite(rate);
  }

  private getAgeInHours(date: Date): number {
    return Math.round((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60));
  }
}

// Export singleton instance
export const exchangeRateService = new ExchangeRateService(); 