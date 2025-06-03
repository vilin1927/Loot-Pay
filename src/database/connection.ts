import knex from 'knex';
import { logger } from '../utils/logger';

// Initialize Knex with PostgreSQL
const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: {
    min: 2,
    max: 10
  }
});

// Test database connection
export async function testConnection() {
  try {
    await db.raw('SELECT 1');
    logger.info('Database connection successful');
  } catch (error) {
    logger.error('Database connection failed', { error });
    throw error;
  }
}

// Export both the db instance and knex
export { db, knex }; 