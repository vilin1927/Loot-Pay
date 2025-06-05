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

// New interface for validation with transactionId
interface SteamValidationResult {
  isValid: boolean;
  transactionId?: string;
  message?: string;
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
   * ✅ NEW METHOD: Validate Steam username AND get transactionId
   * This replaces the old two-phase approach
   * @param username Steam username to check
   * @returns validation result with transactionId if valid
   */
  async validateSteamUsernameWithTransactionId(username: string): Promise<SteamValidationResult> {
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
        return {
          isValid: false,
          message: response.data.message
        };
      }

      // Check if response contains transactionId (success indicator)
      if (!response.data.transactionId) {
        logger.warn('Steam username validation - no transactionId in response', {
          username,
          responseData: response.data
        });
        return {
          isValid: false,
          message: 'Invalid response from PayDigital'
        };
      }

      logger.info('Steam username validation successful with transactionId', {
        username,
        transactionId: response.data.transactionId
      });

      // ✅ RETURN BOTH validation result AND transactionId
      return {
        isValid: true,
        transactionId: response.data.transactionId
      };
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
          return {
            isValid: false,
            message: 'Недействительный логин Steam'
          };
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
   * LEGACY METHOD: Phase 1: Validate Steam username (user experience)
   * This is used to show "Account found" to the user
   * @deprecated Use validateSteamUsernameWithTransactionId instead
   * @param username Steam username to check
   * @returns true if valid, false otherwise
   */
  async validateSteamUsername(username: string): Promise<boolean> {
    const result = await this.validateSteamUsernameWithTransactionId(username);
    return result.isValid;
  }

  /**
   * DEPRECATED: Phase 2: Get fresh transactionId for payment
   * This caused "Transaction already processed" errors
   * @deprecated Use stored transactionId from validateSteamUsernameWithTransactionId
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
   * ✅ UPDATED: Create Steam payment using required transactionId
   * @param username Valid Steam username
   * @param amountUSD Amount in USD
   * @param totalAmountRUB Total amount in RUB including commission (user pays)
   * @param netAmountRUB Net amount in RUB going to Steam (without commission)
   * @param orderId Unique order ID
   * @param transactionId TransactionId from validation step (REQUIRED)
   * @returns Payment URL
   */
  async createSteamPayment(
    username: string,
    amountUSD: number,
    totalAmountRUB: number,
    netAmountRUB: number,
    orderId: string,
    transactionId: string  // ✅ REQUIRED PARAMETER - NO FALLBACK
  ): Promise<string> {
    try {
      // ✅ USE REQUIRED transactionId (new approach)
      logger.info('Creating payment with required transactionId', {
        username,
        transactionId,
        orderId,
        amountUSD,
        totalAmountRUB,
        netAmountRUB
      });

      // ✅ FIXED: Send correct commission structure
      // amount: Total amount user pays (with commission)
      // netAmount: Amount that goes to Steam (without commission)
      const response = await this.client.post('/steam/pay', {
        steamUsername: username,
        amount: totalAmountRUB,     // User pays (with commission)
        netAmount: netAmountRUB,    // Steam receives (without commission)
        currency: 'RUB',
        transactionId,
        orderId,
        directSuccess: false
      });

      logger.info('Steam payment created successfully', {
        username,
        amountUSD,
        totalAmountRUB,
        netAmountRUB,
        orderId,
        transactionId,
        paymentUrl: response.data.paymentUrl
      });

      return response.data.paymentUrl;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as PayDigitalError;
        
        // Handle specific API errors
        if (apiError?.code === 'TRANSACTION_USED') {
          logger.error('TransactionId already used', {
            username,
            orderId,
            transactionId
          });
          throw new Error('Ошибка создания платежа. Пожалуйста, попробуйте снова.');
        }

        // Log the specific error for debugging
        logger.error('PayDigital API error during payment creation', {
          error: apiError,
          username,
          amountUSD,
          totalAmountRUB,
          netAmountRUB,
          orderId,
          transactionId,
          status: error.response?.status,
          data: error.response?.data
        });
      }

      logger.error('Error creating Steam payment', {
        error,
        username,
        amountUSD,
        totalAmountRUB,
        netAmountRUB,
        orderId,
        transactionId
      });
      throw new Error('Ошибка создания платежа. Пожалуйста, попробуйте позже.');
    }
  }
}

// Export singleton instance
export const payDigitalService = new PayDigitalService(); 