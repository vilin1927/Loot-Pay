import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('questionnaire_answers', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().unique();
    table.string('q1_answer').notNullable();
    table.string('q2_answer').notNullable();
    table.string('q3_answer').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    
    // Foreign key
    table.foreign('user_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('questionnaire_answers');
} 