// Emergency database cleanup script
// Run this ONLY if migrations are still failing

import knex from 'knex';
import { config } from '../src/config';

const db = knex({
  client: 'pg',
  connection: config.database.url
});

async function forceCleanDatabase() {
  console.log('⚠️  Force cleaning database...');
  
  try {
    // Drop all tables in reverse order of dependencies
    const tables = [
      'user_responses',
      'user_states', 
      'transactions',
      'system_settings',
      'users',
      'knex_migrations',
      'knex_migrations_lock'
    ];
    
    for (const table of tables) {
      try {
        await db.schema.dropTableIfExists(table);
        console.log(`✅ Dropped table: ${table}`);
      } catch (error) {
        console.log(`⚠️  Could not drop ${table}:`, error.message);
      }
    }
    
    console.log('✅ Database cleaned successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cleaning database:', error);
    process.exit(1);
  }
}

forceCleanDatabase();
