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
   * Check if Steam username exists
   * @param username Steam username to check
   * @returns transactionId for future use
   */
  async checkSteam(username: string): Promise<string> {
    try {
      const response = await this.client.post<SteamCheckResponse>('/steam/check', {
        steamUsername: username
      });

      logger.info('Steam username check successful', {
        username,
        transactionId: response.data.transactionId
      });

      return response.data.transactionId;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as PayDigitalError;
        
        // Handle specific API errors
        if (apiError?.code === 'INVALID_USERNAME') {
          throw new Error('Неверный Steam логин. Пожалуйста, проверьте и попробуйте снова.');
        }

        if (apiError?.code === 'RATE_LIMIT') {
          throw new Error('Слишком много попыток. Пожалуйста, подождите немного.');
        }
      }

      // Generic error
      throw new Error('Ошибка проверки Steam логина. Пожалуйста, попробуйте позже.');
    }
  }
}

// Export singleton instance
export const payDigitalService = new PayDigitalService();

const PAYDIGITAL_API_URL = 'https://foreign.foreignpay.ru';
const PAYDIGITAL_API_KEY = process.env.PAYDIGITAL_API_KEY;

// Initialize axios instance
const api = axios.create({
  baseURL: PAYDIGITAL_API_URL,
  headers: {
    'X-Partner-ID': PAYDIGITAL_API_KEY,
    'Content-Type': 'application/json'
  }
});

/**
 * Validate Steam username
 * @param username Steam username to validate
 * @returns true if valid, false otherwise
 */
export async function validateSteamUsername(username: string): Promise<boolean> {
  try {
    const response = await api.post('/steam/check', {
      steamUsername: username
    });

    // If we get a transactionId, the username is valid
    return !!response.data.transactionId;
  } catch (error) {
    logger.error('Error validating Steam username', {
      error,
      username
    });
    return false;
  }
}

/**
 * Create Steam payment
 * @param username Valid Steam username
 * @param amountUSD Amount in USD
 * @param amountRUB Total amount in RUB including commission
 * @returns Payment URL
 */
export async function createSteamPayment(
  username: string,
  amountUSD: number,
  amountRUB: number
): Promise<string> {
  try {
    // Get fresh transactionId
    const checkResponse = await api.post('/steam/check', {
      steamUsername: username
    });

    const transactionId = checkResponse.data.transactionId;

    // Create payment
    const response = await api.post('/steam/pay', {
      steamUsername: username,
      amount: amountRUB,
      netAmount: amountRUB,
      currency: 'RUB',
      transactionId,
      orderId: `order_${Date.now()}`,
      directSuccess: false
    });

    return response.data.paymentUrl;
  } catch (error) {
    logger.error('Error creating Steam payment', {
      error,
      username,
      amountUSD,
      amountRUB
    });
    throw error;
  }
} 