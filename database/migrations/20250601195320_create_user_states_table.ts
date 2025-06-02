import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('user_states', (table) => {
    // Primary key
    table.increments('id').primary();

    // User reference
    table.integer('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');

    // State management
    table.string('current_state').notNullable();
    table.jsonb('state_data').nullable();
    table.timestamp('expires_at').nullable();

    // Timestamps
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('user_id');
    table.index('current_state');
    table.index('expires_at');
    table.unique(['user_id']); // One state per user
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('user_states');
}

