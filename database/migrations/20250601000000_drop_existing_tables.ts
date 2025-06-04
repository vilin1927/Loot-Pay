import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Drop dependent tables first (in order of dependencies)
  await knex.schema.dropTableIfExists('error_logs'); // Depends on users
  await knex.schema.dropTableIfExists('transactions'); // Depends on users
  await knex.schema.dropTableIfExists('user_responses'); // Depends on users
  await knex.schema.dropTableIfExists('user_states'); // Depends on users
  
  // Now we can safely drop the users table
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('system_settings');
}

export async function down(): Promise<void> {
  // No down migration needed as this is a cleanup step
}

