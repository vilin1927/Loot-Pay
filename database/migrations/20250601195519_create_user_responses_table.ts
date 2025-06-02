import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('user_responses', (table) => {
    // Primary key
    table.increments('id').primary();

    // User reference
    table.integer('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');

    // Question and answer
    table.integer('question_number').notNullable();
    table.string('question_text').notNullable();
    table.string('answer_text').notNullable();

    // Timestamps
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('user_id');
    table.index(['user_id', 'question_number']);
    table.unique(['user_id', 'question_number']); // One answer per question per user
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('user_responses');
}

