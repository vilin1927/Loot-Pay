import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create system_settings table
  await knex.schema.createTable('system_settings', (table) => {
    // Primary key
    table.increments('id').primary();

    // Setting details
    table.string('key', 64)
      .notNullable()
      .unique()
      .index();
    table.text('value')
      .notNullable();
    table.string('type', 32)
      .notNullable()
      .defaultTo('string');
    table.string('description', 256);
    table.boolean('is_public')
      .notNullable()
      .defaultTo(false);

    // Timestamps
    table.timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  // Insert seed data
  await knex('system_settings').insert([
    {
      key: 'min_amount_usd',
      value: '5',
      type: 'number',
      description: 'Minimum payment amount in USD',
      is_public: true
    },
    {
      key: 'max_amount_usd',
      value: '100',
      type: 'number',
      description: 'Maximum payment amount in USD',
      is_public: true
    },
    {
      key: 'total_commission_rate',
      value: '0.10',
      type: 'number',
      description: 'Total commission rate (10%)',
      is_public: true
    },
    {
      key: 'lootpay_fee_rate',
      value: '0.045',
      type: 'number',
      description: 'LootPay fee rate (4.5%)',
      is_public: true
    },
    {
      key: 'paydigital_fee_rate',
      value: '0.055',
      type: 'number',
      description: 'PayDigital fee rate (5.5%)',
      is_public: true
    },
    {
      key: 'payment_expiry_minutes',
      value: '15',
      type: 'number',
      description: 'Payment link expiry time in minutes',
      is_public: true
    },
    {
      key: 'support_telegram',
      value: '@lootpay_support',
      type: 'string',
      description: 'Support Telegram username',
      is_public: true
    },
    {
      key: 'support_email',
      value: 'support@lootpay.ru',
      type: 'string',
      description: 'Support email address',
      is_public: true
    },
    {
      key: 'paydigital_api_key',
      value: '',
      type: 'string',
      description: 'PayDigital API key',
      is_public: false
    },
    {
      key: 'paydigital_webhook_secret',
      value: '',
      type: 'string',
      description: 'PayDigital webhook secret',
      is_public: false
    },
    {
      key: 'default_exchange_rate',
      value: '80.0',
      type: 'number',
      description: 'Default USD/RUB exchange rate',
      is_public: false
    }
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('system_settings');
}

