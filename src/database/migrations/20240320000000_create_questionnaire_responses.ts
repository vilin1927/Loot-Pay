import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('questionnaire_responses', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('question_number').notNullable().checkIn(['1', '2', '3']);
    table.string('answer').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Ensure one response per question per user
    table.unique(['user_id', 'question_number']);
  });

  // Add indexes
  await knex.schema.raw('CREATE INDEX idx_questionnaire_responses_user_id ON questionnaire_responses(user_id)');
  await knex.schema.raw('CREATE INDEX idx_questionnaire_responses_created_at ON questionnaire_responses(created_at)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('questionnaire_responses');
} 