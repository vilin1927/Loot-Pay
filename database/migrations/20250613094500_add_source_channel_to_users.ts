import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add new column to store deep-link source attribution
  await knex.schema.alterTable('users', (table) => {
    table.string('source_channel', 64).nullable().index();
  });

  // Back-fill existing users with placeholder "First" so we know they joined pre-attribution
  await knex('users')
    .whereNull('source_channel')
    .update({ source_channel: 'First' });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('source_channel');
  });
} 