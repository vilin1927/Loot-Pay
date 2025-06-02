import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Required environment variables
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'PAYDIGITAL_API_KEY',
  'DATABASE_URL'
] as const;

// Validate required environment variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Configuration object
export const config = {
  // Telegram Bot
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN!,
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET
  },

  // PayDigital API
  paydigital: {
    apiKey: process.env.PAYDIGITAL_API_KEY!,
    webhookSecret: process.env.PAYDIGITAL_WEBHOOK_SECRET
  },

  // Database
  database: {
    url: process.env.DATABASE_URL!
  },

  // Server
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
    nodeEnv: process.env.NODE_ENV || 'development'
  },

  // Support
  support: {
    chatId: process.env.SUPPORT_CHAT_ID || '@lootpay_support',
    email: process.env.SUPPORT_EMAIL || 'support@lootpay.ru'
  }
} as const;

// Type for the config object
export type Config = typeof config; 