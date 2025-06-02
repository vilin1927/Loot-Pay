import { logger } from '../../utils/logger';

// Commission rates
const TOTAL_COMMISSION_RATE = 0.10; // 10% total
const LOOTPAY_FEE_RATE = 0.045;    // 4.5% LootPay margin
const PAYDIGITAL_FEE_RATE = 0.055; // 5.5% PayDigital fee

// Commission calculation result
interface CommissionResult {
  baseAmountRUB: number;    // Original amount in RUB
  totalAmountRUB: number;   // Amount with commission
  paydigitalFeeRUB: number; // PayDigital fee
  lootpayFeeRUB: number;    // LootPay fee
  netAmountRUB: number;     // Net amount after fees
}

/**
 * Calculate commission and fees for a given amount
 * 
 * @param amountUSD Amount in USD
 * @param exchangeRate Current USD/RUB rate
 * @returns Commission calculation result
 * 
 * @example
 * // Test case 1: $10 USD at rate 80
 * const result = calculateCommission(10, 80);
 * // result = {
 * //   baseAmountRUB: 800,      // 10 * 80
 * //   totalAmountRUB: 888.89,  // 800 / (1 - 0.10)
 * //   paydigitalFeeRUB: 48.89, // 888.89 * 0.055
 * //   lootpayFeeRUB: 40.00,    // 888.89 * 0.045
 * //   netAmountRUB: 800        // Original amount
 * // }
 * 
 * @example
 * // Test case 2: $5 USD at rate 80
 * const result = calculateCommission(5, 80);
 * // result = {
 * //   baseAmountRUB: 400,      // 5 * 80
 * //   totalAmountRUB: 444.44,  // 400 / (1 - 0.10)
 * //   paydigitalFeeRUB: 24.44, // 444.44 * 0.055
 * //   lootpayFeeRUB: 20.00,    // 444.44 * 0.045
 * //   netAmountRUB: 400        // Original amount
 * // }
 */
export function calculateCommission(
  amountUSD: number,
  exchangeRate: number
): CommissionResult {
  // Calculate base amount in RUB
  const baseAmountRUB = amountUSD * exchangeRate;

  // Calculate total amount with commission
  const totalAmountRUB = baseAmountRUB / (1 - TOTAL_COMMISSION_RATE);

  // Calculate fees
  const paydigitalFeeRUB = totalAmountRUB * PAYDIGITAL_FEE_RATE;
  const lootpayFeeRUB = totalAmountRUB * LOOTPAY_FEE_RATE;

  // Log calculation
  logger.debug('Commission calculation', {
    amountUSD,
    exchangeRate,
    baseAmountRUB,
    totalAmountRUB,
    paydigitalFeeRUB,
    lootpayFeeRUB
  });

  return {
    baseAmountRUB,
    totalAmountRUB,
    paydigitalFeeRUB,
    lootpayFeeRUB,
    netAmountRUB: baseAmountRUB
  };
} 