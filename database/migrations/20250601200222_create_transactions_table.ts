import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('transactions', (table) => {
    // Primary key
    table.increments('id').primary();

    // User reference
    table.integer('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');

    // Steam details
    table.string('steam_username', 32)
      .notNullable()
      .index();

    // Amount details
    table.decimal('amount_usd', 10, 2)
      .notNullable();
    table.decimal('amount_rub', 10, 2)
      .notNullable();
    table.decimal('commission_rub', 10, 2)
      .notNullable();
    table.decimal('exchange_rate', 10, 4)
      .notNullable();

    // Payment details
    table.string('sbp_payment_id', 64)
      .unique()
      .index();
    table.string('sbp_payment_url', 512);
    table.string('sbp_payment_status', 32)
      .defaultTo('pending')
      .index();
    table.timestamp('sbp_payment_expires_at')
      .notNullable();

    // PayDigital details
    table.string('paydigital_transaction_id', 64)
      .unique()
      .index();
    table.string('paydigital_order_id', 64)
      .unique()
      .index();
    table.string('paydigital_status', 32)
      .defaultTo('pending')
      .index();
    table.jsonb('paydigital_response')
      .defaultTo('{}');

    // Status tracking
    table.string('status', 32)
      .notNullable()
      .defaultTo('pending')
      .index();
    table.string('error_code', 32);
    table.text('error_message');

    // Timestamps
    table.timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.timestamp('completed_at', { useTz: true });

    // Indexes
    table.index(['user_id', 'created_at']);
    table.index(['status', 'created_at']);
    table.index(['sbp_payment_status', 'created_at']);
    table.index(['paydigital_status', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('transactions');
}

