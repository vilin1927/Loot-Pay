import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.timestamp('last_accessibility_check').nullable().comment('Last time user accessibility was checked');
    table.boolean('is_accessible').nullable().comment('Whether user can receive messages from bot');
    table.string('accessibility_status').nullable().comment('User accessibility status: active, blocked, chat_deleted, deactivated, unknown_error');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('last_accessibility_check');
    table.dropColumn('is_accessible');
    table.dropColumn('accessibility_status');
  });
}

