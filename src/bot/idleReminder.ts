import { getBotInstance } from './botInstance';
import { logger } from '../utils/logger';

/**
 * Inactivity reminder helper
 * ---------------------------------
 * - Call registerUserActivity(telegramId) whenever user sends a message or presses a button
 * - If the user stays silent for INACTIVITY_DELAY_MS, a reminder is sent once
 */

const INACTIVITY_DELAY_MS = 5 * 60 * 1000; // 5 minutes

// Track timeout handles per telegramId
const timers: Map<number, NodeJS.Timeout> = new Map();

// Track which users have already received a reminder for the current idle window
const reminderSent: Set<number> = new Set();

/**
 * Register fresh activity from the user and (re)set the inactivity timer.
 */
export function registerUserActivity(telegramId: number) {
  if (!telegramId) return;

  // Clear existing timer if present
  const existing = timers.get(telegramId);
  if (existing) {
    clearTimeout(existing);
  }

  // If user is active again, allow future reminders
  reminderSent.delete(telegramId);

  // Start a new timer
  const timer = setTimeout(async () => {
    // Avoid duplicate send in edge cases
    if (reminderSent.has(telegramId)) return;

    try {
      const bot = await getBotInstance();
      await bot.sendMessage(
        telegramId,
        '👋 Мы заметили, что у вас возникли трудности с пополнением Steam через LootPay. Если нужна помощь — просто напишите нам!',
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '📞 Связаться с поддержкой',
                  url: 'https://t.me/lootpay_support'
                }
              ]
            ]
          }
        }
      );
      logger.info('Inactivity reminder sent', { telegramId });
      reminderSent.add(telegramId);
    } catch (error) {
      logger.warn('Failed to send inactivity reminder', {
        telegramId,
        error: error instanceof Error ? error.message : error
      });
    }
  }, INACTIVITY_DELAY_MS);

  timers.set(telegramId, timer);
} 