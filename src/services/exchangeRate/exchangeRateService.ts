import { logger } from '../../utils/logger';

// TODO: Replace with PayDigital rates endpoint
// POST /rates/current
// Headers: X-Partner-ID
// Response: { rate: number, currency: string }
// Will be implemented in v2

export class ExchangeRateService {
  private static instance: ExchangeRateService;
  private rate: number = 80.0; // Hardcoded for MVP

  private constructor() {}

  public static getInstance(): ExchangeRateService {
    if (!ExchangeRateService.instance) {
      ExchangeRateService.instance = new ExchangeRateService();
    }
    return ExchangeRateService.instance;
  }

  /**
   * Get current USD/RUB exchange rate
   * @returns Current exchange rate (hardcoded for MVP)
   */
  async getRate(): Promise<number> {
    logger.info('Exchange rate requested', {
      rate: this.rate,
      source: 'hardcoded'
    });

    return this.rate;
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