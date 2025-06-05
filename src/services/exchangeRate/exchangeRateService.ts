import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';

// PayDigital API configuration
const API_CONFIG = {
  baseURL: 'https://foreign.foreignpay.ru',
  headers: {
    'Content-Type': 'application/json',
    'X-Partner-ID': process.env.PAYDIGITAL_API_KEY
  }
};

interface ExchangeRateResponse {
  rate: number;
  currency: string;
}

export class ExchangeRateService {
  private static instance: ExchangeRateService;
  private client: AxiosInstance;
  private fallbackRate: number = 80.0; // Emergency fallback rate
  private cachedRate: number | null = null;
  private cacheTimestamp: number = 0;
  private cacheValidityMs: number = 60000; // 1 minute cache

  private constructor() {
    this.client = axios.create(API_CONFIG);
  }

  public static getInstance(): ExchangeRateService {
    if (!ExchangeRateService.instance) {
      ExchangeRateService.instance = new ExchangeRateService();
    }
    return ExchangeRateService.instance;
  }

  /**
   * Get current USD/RUB exchange rate from PayDigital API
   * Falls back to hardcoded rate if API fails
   * @returns Current exchange rate
   */
  async getRate(): Promise<number> {
    try {
      // Check cache first
      if (this.cachedRate && (Date.now() - this.cacheTimestamp) < this.cacheValidityMs) {
        logger.info('Exchange rate requested', {
          rate: this.cachedRate,
          source: 'cache'
        });
        return this.cachedRate;
      }

      // Try to get rate from PayDigital API
      logger.debug('Fetching exchange rate from PayDigital API');
      
      const response = await this.client.post<ExchangeRateResponse>('/rates/current', {
        currency: 'USD'
      });

      if (response.data.rate && response.data.rate > 0) {
        this.cachedRate = response.data.rate;
        this.cacheTimestamp = Date.now();
        
        logger.info('Exchange rate requested', {
          rate: this.cachedRate,
          source: 'paydigital_api'
        });
        
        return this.cachedRate;
      } else {
        throw new Error('Invalid rate from PayDigital API');
      }
    } catch (error) {
      logger.warn('Failed to get exchange rate from PayDigital API, using fallback', {
        error: error instanceof Error ? error.message : error,
        fallbackRate: this.fallbackRate
      });

      // Use cached rate if available
      if (this.cachedRate) {
        logger.info('Exchange rate requested', {
          rate: this.cachedRate,
          source: 'cache_fallback'
        });
        return this.cachedRate;
      }

      // Use hardcoded fallback rate
      logger.info('Exchange rate requested', {
        rate: this.fallbackRate,
        source: 'hardcoded_fallback'
      });
      
      return this.fallbackRate;
    }
  }

  /**
   * Convert USD to RUB
   * @param usdAmount Amount in USD
   * @returns Amount in RUB
   */
  async usdToRub(usdAmount: number): Promise<number> {
    const rate = await this.getRate();
    const rubAmount = usdAmount * rate;

    logger.debug('USD to RUB conversion', {
      usdAmount,
      rate,
      rubAmount
    });

    return rubAmount;
  }
}

// Export singleton instance
export const exchangeRateService = ExchangeRateService.getInstance(); 