import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('users', (table) => {
    // Primary key
    table.increments('id').primary();

    // Telegram user info
    table.bigInteger('telegram_id').notNullable().unique();
    table.string('username').nullable();
    table.string('first_name').nullable();
    table.string('last_name').nullable();

    // Steam info
    table.string('steam_username').nullable();
    table.boolean('steam_verified').defaultTo(false);

    // User state
    table.string('current_state').nullable();
    table.jsonb('state_data').nullable();
    table.timestamp('state_expires_at').nullable();

    // Questionnaire responses
    table.string('gaming_frequency').nullable();
    table.string('payment_method').nullable();
    table.string('referral_source').nullable();

    // Timestamps
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('telegram_id');
    table.index('steam_username');
    table.index('current_state');
    table.index('state_expires_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('users');
}

