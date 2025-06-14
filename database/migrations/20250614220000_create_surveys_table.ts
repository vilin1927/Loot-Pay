import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('surveys', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('started_at').defaultTo(knex.fn.now());
    table.timestamp('completed_at').nullable();
    table.boolean('skipped').defaultTo(false);

    // answers
    table.string('q1_answer', 2).nullable(); // A, Б, В, Г, Д
    table.string('q2_answer', 2).nullable(); // 1, 2, 3, 4
    table.string('q2_text', 255).nullable(); // free text for option 1
    table.string('q3_answer', 3).nullable(); // I, II, III, IV, V

    // indexes for fast analytics
    table.index(['user_id']);
    table.index(['q1_answer']);
    table.index(['q2_answer']);
    table.index(['q3_answer']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('surveys');
} 