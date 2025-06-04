import knex from 'knex';
import { logger } from '../utils/logger';

// Calculate optimal connection pool size based on system resources
// Formula from PostgreSQL performance tuning: max(4 * CPU cores, 100) but limited for Railway
const maxConnections = Math.min(20, Math.max(8, 4 * (process.env.CPU_CORES ? parseInt(process.env.CPU_CORES) : 2)));

// Initialize Knex with PostgreSQL
const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: {
    min: 2,
    max: maxConnections,
    createTimeoutMillis: 8000,
    acquireTimeoutMillis: 8000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100,
    propagateCreateError: false
  },
  acquireConnectionTimeout: 10000
});

// Add connection pool monitoring
db.on('query', (data) => {
  logger.debug('Database query executed', {
    sql: data.sql,
    bindings: data.bindings,
    queryUid: data.__knexQueryUid
  });
});

db.on('query-error', (error, data) => {
  logger.error('Database query error', {
    error: error.message,
    sql: data.sql,
    bindings: data.bindings,
    queryUid: data.__knexQueryUid
  });
});

// Test database connection
export async function testConnection() {
  try {
    await db.raw('SELECT 1');
    logger.info('Database connection successful', {
      poolConfig: {
        min: 2,
        max: maxConnections
      }
    });
  } catch (error) {
    logger.error('Database connection failed', { error });
    throw error;
  }
}

// Get connection pool stats
export function getPoolStats() {
  const pool = (db as any).client.pool;
  return {
    used: pool.used,
    free: pool.free,
    pendingAcquires: pool.pendingAcquires.length,
    pendingCreates: pool.pendingCreates.length
  };
}

// Log pool stats periodically
setInterval(() => {
  const stats = getPoolStats();
  if (stats.used > 0 || stats.pendingAcquires > 0) {
    logger.debug('Database connection pool stats', stats);
  }
}, 30000); // Every 30 seconds

// Export both the db instance and knex
export { db, knex }; 