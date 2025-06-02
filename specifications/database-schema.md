# Database Schema - LootPay Telegram Bot

## Complete Database Structure

### Core Tables with Full Schema

#### 1. Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  steam_username VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  questionnaire_completed BOOLEAN DEFAULT FALSE,
  questionnaire_started_at TIMESTAMPTZ,
  questionnaire_completed_at TIMESTAMPTZ,
  total_transactions INTEGER DEFAULT 0,
  total_volume_rub DECIMAL(10,2) DEFAULT 0,
  last_activity_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_telegram_id ON users(telegram_id);
CREATE INDEX idx_steam_username ON users(steam_username);
CREATE INDEX idx_created_at ON users(created_at);
CREATE INDEX idx_last_activity ON users(last_activity_at);
```

#### 2. Transactions Table
```sql
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  steam_username VARCHAR(255) NOT NULL,
  amount_usd DECIMAL(10,2) NOT NULL,
  amount_rub DECIMAL(10,2) NOT NULL,
  net_amount_rub DECIMAL(10,2) NOT NULL,
  exchange_rate DECIMAL(8,4) NOT NULL,
  lootpay_fee_rub DECIMAL(10,2) NOT NULL,
  paydigital_fee_rub DECIMAL(10,2) NOT NULL,
  paydigital_transaction_id VARCHAR(255),
  paydigital_order_uuid VARCHAR(255),
  sbp_transaction_uuid VARCHAR(255),
  order_id VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(20) CHECK (status IN ('pending', 'processing', 'paid', 'failed')) DEFAULT 'pending',
  payment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMPTZ,
  webhook_data JSONB,
  
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_id ON transactions(user_id);
CREATE INDEX idx_status ON transactions(status);
CREATE INDEX idx_order_uuid ON transactions(paydigital_order_uuid);
CREATE INDEX idx_order_id ON transactions(order_id);
CREATE INDEX idx_created_at ON transactions(created_at);
CREATE INDEX idx_paid_at ON transactions(paid_at);
```

#### 3. User Responses Table (Questionnaire)
```sql
CREATE TABLE user_responses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  question_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_question ON user_responses(user_id, question_number);
CREATE INDEX idx_question_number ON user_responses(question_number);
```

#### 4. User Events Table (Analytics)
```sql
CREATE TABLE user_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB,
  step_in_funnel INTEGER,
  session_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_event ON user_events(user_id, event_type);
CREATE INDEX idx_funnel_step ON user_events(step_in_funnel);
CREATE INDEX idx_created_at ON user_events(created_at);
CREATE INDEX idx_session ON user_events(session_id);
```

#### 5. System Settings Table
```sql
CREATE TABLE system_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(255)
);

CREATE INDEX idx_setting_key ON system_settings(setting_key);
```

#### 6. Exchange Rates Table
```sql
CREATE TABLE exchange_rates (
  id SERIAL PRIMARY KEY,
  from_currency VARCHAR(10) NOT NULL,
  to_currency VARCHAR(10) NOT NULL,
  rate DECIMAL(10,4) NOT NULL,
  source VARCHAR(50) DEFAULT 'paydigital_api',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_currencies ON exchange_rates(from_currency, to_currency);
CREATE INDEX idx_created_at ON exchange_rates(created_at);
```

## Initial Data Setup

### System Settings
```sql
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('min_amount_usd', '2.00', 'Minimum transaction amount in USD'),
('max_amount_usd', '100.00', 'Maximum transaction amount in USD'),
('lootpay_commission', '4.5', 'LootPay commission percentage'),
('paydigital_commission', '5.5', 'PayDigital commission percentage'),
('total_commission', '10.0', 'Total commission percentage'),
('exchange_rate_update_hours', '2', 'Hours between exchange rate updates'),
('support_response_time_minutes', '15', 'Target support response time in minutes'),
('transaction_timeout_minutes', '30', 'Payment timeout in minutes');
```

### Sample Exchange Rate
```sql
INSERT INTO exchange_rates (from_currency, to_currency, rate, source) VALUES
('USD', 'RUB', 80.2400, 'paydigital_api');
```

## Database Relationships

### Entity Relationship Diagram
```
users (1) ----< (many) transactions
users (1) ----< (many) user_responses  
users (1) ----< (many) user_events

transactions (many) >---- (1) users
user_responses (many) >---- (1) users
user_events (many) >---- (1) users
```

### Key Relationships
- **Users → Transactions**: One user can have many transactions
- **Users → User Responses**: One user can have multiple questionnaire responses
- **Users → User Events**: One user can have many analytics events
- **All foreign keys use CASCADE DELETE** for data consistency

## Performance Optimization

### Indexes Strategy
```sql
-- High-performance indexes for common queries
CREATE INDEX idx_user_active_transactions ON transactions(user_id, status, created_at);
CREATE INDEX idx_daily_transactions ON transactions(DATE_TRUNC('day', created_at), status);
CREATE INDEX idx_user_funnel_events ON user_events(user_id, step_in_funnel, created_at);
CREATE INDEX idx_recent_exchange_rates ON exchange_rates(from_currency, to_currency, created_at DESC);
```

### Partitioning Strategy (for high volume)
```sql
-- Partition transactions by month for large datasets
CREATE TABLE transactions_partitioned (
  -- Same columns as transactions table
) PARTITION BY RANGE (created_at);

-- Create partitions for each month
CREATE TABLE transactions_y2024m05 PARTITION OF transactions_partitioned
  FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');
CREATE TABLE transactions_y2024m06 PARTITION OF transactions_partitioned
  FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');
CREATE TABLE transactions_y2024m07 PARTITION OF transactions_partitioned
  FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
CREATE TABLE transactions_future PARTITION OF transactions_partitioned
  FOR VALUES FROM ('2024-08-01') TO (MAXVALUE);
```

## Common Queries

### User Analytics Queries
```sql
-- Get user funnel conversion rates
SELECT 
  step_in_funnel,
  COUNT(DISTINCT user_id) as users,
  COUNT(DISTINCT user_id) * 100.0 / LAG(COUNT(DISTINCT user_id)) OVER (ORDER BY step_in_funnel) as conversion_rate
FROM user_events 
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY step_in_funnel
ORDER BY step_in_funnel;

-- Get user transaction history with pagination
SELECT 
  t.id,
  t.amount_usd,
  t.amount_rub,
  t.status,
  t.created_at,
  t.paid_at,
  t.paydigital_order_uuid
FROM transactions t
WHERE t.user_id = $1
ORDER BY t.created_at DESC
LIMIT 3 OFFSET $2;

-- Get daily transaction metrics
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_transactions,
  COUNT(*) FILTER (WHERE status = 'paid') as successful_transactions,
  SUM(CASE WHEN status = 'paid' THEN amount_rub ELSE 0 END) as total_volume_rub,
  SUM(CASE WHEN status = 'paid' THEN lootpay_fee_rub ELSE 0 END) as total_revenue
FROM transactions
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;
```

### ICP Analysis Queries
```sql
-- Calculate ICP scores based on questionnaire responses
SELECT 
  u.id,
  u.telegram_id,
  CASE 
    WHEN q1.answer_text IN ('🎮 Игры — покупаю новинки и классику', '✨ Внутриигровые штуки, кейсы, боевые пропуски') 
    AND q2.answer_text IN ('👍 Да, юзаю', '👌 Да, но забросил(а)')
    AND q3.answer_text = '✅ Да, ок'
    THEN 'HIGH_ICP'
    WHEN q1.answer_text IN ('🎮 Игры — покупаю новинки и классику', '✨ Внутриигровые штуки, кейсы, боевые пропуски')
    THEN 'MEDIUM_ICP'
    ELSE 'LOW_ICP'
  END as icp_score,
  COUNT(t.id) as completed_transactions,
  SUM(t.amount_rub) as total_volume
FROM users u
LEFT JOIN user_responses q1 ON u.id = q1.user_id AND q1.question_number = 1
LEFT JOIN user_responses q2 ON u.id = q2.user_id AND q2.question_number = 2
LEFT JOIN user_responses q3 ON u.id = q3.user_id AND q3.question_number = 3
LEFT JOIN transactions t ON u.id = t.user_id AND t.status = 'paid'
GROUP BY u.id, u.telegram_id, q1.answer_text, q2.answer_text, q3.answer_text;
```

## Supabase Connection

### Connection String Format
```
postgresql://postgres.[project-ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

### Environment Variables
```bash
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_ANON_KEY=[anon-key]
```

### Connection Pool Settings
```typescript
{
  pool: {
    min: 1,
    max: 3,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100
  }
}
```

---

**Database Version**: 1.0  
**Last Updated**: May 30, 2025  
**Compatibility**: PostgreSQL 14+  
**Status**: Production Ready
