import knex from 'knex';
import { config } from '../../config';
import { logger } from '../../utils/logger';

// Initialize Knex with PostgreSQL
export const db = knex({
  client: 'pg',
  connection: config.database.url,
  pool: {
    min: 2,
    max: 10
  },
  // Enable query logging in development
  debug: config.server.nodeEnv === 'development'
});

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    // Simple query to test connection
    await db.raw('SELECT 1');
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection failed', { error });
    return false;
  }
}

// Graceful shutdown
export async function closeConnection(): Promise<void> {
  try {
    await db.destroy();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection', { error });
  }
} 