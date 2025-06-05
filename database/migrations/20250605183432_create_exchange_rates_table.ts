import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create exchange_rates table for PRD compliance
  await knex.schema.createTable('exchange_rates', (table) => {
    table.increments('id').primary();
    
    // Currency pair (e.g., 'USD_RUB')
    table.string('currency_pair', 10).notNullable();
    
    // Exchange rate value with high precision
    table.decimal('rate', 10, 4).notNullable();
    
    // Source of the rate (for audit trail)
    table.string('source', 50).notNullable(); // 'paydigital_api', 'fallback', 'manual'
    
    // Status of the rate
    table.enum('status', ['active', 'expired', 'failed']).defaultTo('active');
    
    // API response metadata (for debugging)
    table.json('api_response').nullable();
    
    // Rate change tracking
    table.decimal('previous_rate', 10, 4).nullable();
    table.decimal('rate_change', 10, 4).nullable(); // Absolute change
    table.decimal('rate_change_percent', 8, 4).nullable(); // Percentage change
    
    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at').nullable(); // For caching
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes for performance
    table.index(['currency_pair', 'created_at'], 'idx_currency_created');
    table.index(['currency_pair', 'status'], 'idx_currency_status');
    table.index('created_at', 'idx_created_at');
    table.index('expires_at', 'idx_expires_at');
  });

  // Create exchange_rate_history table for audit trail
  await knex.schema.createTable('exchange_rate_history', (table) => {
    table.increments('id').primary();
    
    // Reference to main exchange rate
    table.integer('exchange_rate_id').unsigned();
    table.foreign('exchange_rate_id').references('id').inTable('exchange_rates').onDelete('CASCADE');
    
    // Event tracking
    table.enum('event_type', ['created', 'updated', 'expired', 'failed']).notNullable();
    table.string('event_source', 50).notNullable(); // 'cron_job', 'manual', 'api_fallback'
    
    // Rate data at time of event
    table.string('currency_pair', 10).notNullable();
    table.decimal('rate', 10, 4).notNullable();
    table.string('source', 50).notNullable();
    
    // Change tracking
    table.decimal('previous_rate', 10, 4).nullable();
    table.decimal('rate_change', 10, 4).nullable();
    table.decimal('rate_change_percent', 8, 4).nullable();
    
    // Metadata
    table.json('metadata').nullable(); // API response, error details, etc.
    table.text('notes').nullable(); // Human-readable notes
    
    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['currency_pair', 'created_at'], 'idx_history_currency_created');
    table.index('event_type', 'idx_history_event_type');
    table.index('created_at', 'idx_history_created_at');
  });

  // Insert initial exchange rate (fallback) using raw SQL for PostgreSQL compatibility
  const rateInsertResult = await knex.raw(`
    INSERT INTO exchange_rates (
      currency_pair, rate, source, status, expires_at, api_response, 
      created_at, updated_at
    ) VALUES (
      'USD_RUB', 80.0000, 'initial_fallback', 'active', 
      NOW() + INTERVAL '24 hours',
      '{"note":"Initial fallback rate for MVP"}',
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) RETURNING id
  `);
  
  const rateId = rateInsertResult.rows[0].id;

  // Insert history record for initial rate
  await knex.raw(`
    INSERT INTO exchange_rate_history (
      exchange_rate_id, event_type, event_source, currency_pair, rate, 
      source, metadata, notes, created_at
    ) VALUES (
      ?, 'created', 'migration', 'USD_RUB', 80.0000, 
      'initial_fallback', 
      '{"migration":"20250605183432_create_exchange_rates_table"}',
      'Initial exchange rate created during database migration',
      CURRENT_TIMESTAMP
    )
  `, [rateId]);

  console.log('✅ Exchange rates table created with initial 80.0 USD_RUB rate');
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order (history first due to foreign key)
  await knex.schema.dropTableIfExists('exchange_rate_history');
  await knex.schema.dropTableIfExists('exchange_rates');
  
  console.log('❌ Exchange rates tables dropped');
}

