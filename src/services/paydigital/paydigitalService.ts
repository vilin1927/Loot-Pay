import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';

// API configuration
const API_CONFIG = {
  baseURL: 'https://foreign.foreignpay.ru',
  headers: {
    'Content-Type': 'application/json',
    'X-Partner-ID': process.env.PAYDIGITAL_API_KEY
  }
};

// Response types
interface SteamCheckResponse {
  transactionId: string;
}

interface PayDigitalError {
  message: string;
  code: string;
}

export class PayDigitalService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create(API_CONFIG);

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('PayDigital API response', {
          url: response.config.url,
          method: response.config.method,
          status: response.status,
          data: response.data
        });
        return response;
      },
      (error) => {
        logger.error('PayDigital API error', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        return Promise.reject(error);
      }
    );

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('PayDigital API request', {
          url: config.url,
          method: config.method,
          data: config.data
        });
        return config;
      },
      (error) => {
        logger.error('PayDigital API request error', {
          error: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Phase 1: Validate Steam username (user experience)
   * This is used to show "Account found" to the user
   * @param username Steam username to check
   * @returns true if valid, false otherwise
   */
  async validateSteamUsername(username: string): Promise<boolean> {
    try {
      const response = await this.client.post<any>('/steam/check', {
        steamUsername: username
      });

      // Check if PayDigital returned an error status
      if (response.data.status === 'error') {
        logger.info('Steam username validation failed - account not found', {
          username,
          message: response.data.message
        });
        return false;
      }

      // Check if response contains transactionId (success indicator)
      if (!response.data.transactionId) {
        logger.warn('Steam username validation - no transactionId in response', {
          username,
          responseData: response.data
        });
        return false;
      }

      logger.info('Steam username validation successful', {
        username,
        transactionId: response.data.transactionId
      });

      // We don't store the transactionId from this call (Phase 1)
      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as PayDigitalError;
        
        logger.error('Steam username validation API error', {
          username,
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        
        // Handle specific API errors
        if (apiError?.code === 'INVALID_USERNAME') {
          return false;
        }

        if (apiError?.code === 'RATE_LIMIT') {
          throw new Error('Слишком много попыток. Пожалуйста, подождите немного.');
        }
      }

      // For network errors or unknown API errors, throw exception
      logger.error('Steam username validation network/unknown error', {
        username,
        error: error instanceof Error ? error.message : error
      });
      throw new Error('Ошибка проверки Steam логина. Пожалуйста, попробуйте позже.');
    }
  }

  /**
   * Phase 2: Get fresh transactionId for payment
   * This is called right before creating the payment
   * @param username Valid Steam username
   * @returns transactionId for payment
   */
  async getPaymentTransactionId(username: string): Promise<string> {
    try {
      const response = await this.client.post<SteamCheckResponse>('/steam/check', {
        steamUsername: username
      });

      logger.info('Got fresh transaction ID for payment', {
        username,
        transactionId: response.data.transactionId
      });

      return response.data.transactionId;
    } catch (error) {
      logger.error('Error getting payment transaction ID', {
        error,
        username
      });
      throw new Error('Ошибка подготовки платежа. Пожалуйста, попробуйте позже.');
    }
  }

  /**
   * Create Steam payment
   * @param username Valid Steam username
   * @param amountUSD Amount in USD
   * @param amountRUB Total amount in RUB including commission
   * @param orderId Unique order ID
   * @returns Payment URL
   */
  async createSteamPayment(
    username: string,
    amountUSD: number,
    amountRUB: number,
    orderId: string
  ): Promise<string> {
    try {
      // Phase 2: Get fresh transactionId right before payment
      const transactionId = await this.getPaymentTransactionId(username);

      // Create payment
      const response = await this.client.post('/steam/pay', {
        steamUsername: username,
        amount: amountRUB,
        netAmount: amountRUB,
        currency: 'RUB',
        transactionId,
        orderId,
        directSuccess: false
      });

      logger.info('Steam payment created', {
        username,
        amountUSD,
        amountRUB,
        orderId,
        transactionId
      });

      return response.data.paymentUrl;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as PayDigitalError;
        
        // Handle specific API errors
        if (apiError?.code === 'TRANSACTION_USED') {
          throw new Error('Ошибка создания платежа. Пожалуйста, попробуйте снова.');
        }
      }

      logger.error('Error creating Steam payment', {
        error,
        username,
        amountUSD,
        amountRUB,
        orderId
      });
      throw new Error('Ошибка создания платежа. Пожалуйста, попробуйте позже.');
    }
  }
}

// Export singleton instance
export const payDigitalService = new PayDigitalService(); 