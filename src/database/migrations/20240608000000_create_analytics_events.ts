import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('analytics_events', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users');
    table.string('event_name').notNullable();
    table.text('event_data').notNullable(); // JSON string
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Add indexes for common queries
    table.index('user_id');
    table.index('event_name');
    table.index('created_at');
    table.index(['user_id', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('analytics_events');
} 