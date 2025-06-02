import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

// Validate required environment variable
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

// Common configuration
const commonConfig = {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  migrations: {
    directory: path.join(__dirname, 'database/migrations'),
    extension: 'ts'
  },
  seeds: {
    directory: path.join(__dirname, 'database/seeds'),
    extension: 'ts'
  },
  pool: {
    min: 2,
    max: 10
  }
};

// Export configurations for different environments
export default {
  development: {
    ...commonConfig,
    debug: true
  },
  production: {
    ...commonConfig,
    debug: false
  }
}; 