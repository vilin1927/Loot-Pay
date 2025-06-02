import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Drop existing tables if they exist
  await knex.schema.dropTableIfExists('transactions');
  await knex.schema.dropTableIfExists('user_responses');
  await knex.schema.dropTableIfExists('user_states');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('system_settings');
}

export async function down(): Promise<void> {
  // No down migration needed as this is a cleanup step
}

