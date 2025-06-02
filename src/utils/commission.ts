/**
 * Calculate commission for a given amount
 * @param amountUSD Amount in USD
 * @param exchangeRate Current USD/RUB exchange rate
 * @returns Commission breakdown
 */
export function calculateCommission(amountUSD: number, exchangeRate: number) {
  const totalCommissionRate = 0.10; // 10% total
  const baseAmountRUB = amountUSD * exchangeRate;
  const totalAmountRUB = baseAmountRUB / (1 - totalCommissionRate);
  const paydigitalFeeRUB = totalAmountRUB * 0.055; // 5.5%
  const lootpayFeeRUB = totalAmountRUB * 0.045;   // 4.5%
  
  return {
    baseAmountRUB,
    totalAmountRUB,
    paydigitalFeeRUB,
    lootpayFeeRUB,
    netAmountRUB: baseAmountRUB
  };
} 