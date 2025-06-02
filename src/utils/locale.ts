/**
 * Format number as Russian currency
 * 
 * @example
 * formatRussianCurrency(802.40) // "802,40 ₽"
 * formatRussianCurrency(1000) // "1 000,00 ₽"
 * formatRussianCurrency(1234567.89) // "1 234 567,89 ₽"
 */
export function formatRussianCurrency(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2
  }).format(amount);
}

/**
 * Format date in Moscow timezone
 * 
 * @example
 * formatMoscowTime(new Date()) // "01.06.2025, 15:30"
 * formatMoscowTime(new Date('2024-03-20T12:00:00Z')) // "20.03.2024, 15:00"
 */
export function formatMoscowTime(date: Date): string {
  return date.toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
} 