# LootPay MVP - Cursor IDE Configuration

## Project Context
You are working on LootPay, a Telegram bot MVP for Steam wallet funding targeting Russian gamers. This is an MVP focused on rapid market validation, not scaling.

## Core Business Logic
- Service charges 10% commission total (4.5% LootPay margin, 5.5% PayDigital fee)
- Target market: Russian gamers unable to use foreign payment methods
- Payment method: SBP (Russian instant payments)
- Steam funding via PayDigital.shop API integration
- MVP goal: Validate willingness to pay 10% for fast, reliable Steam funding

## Tech Stack (MVP-Focused)
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js (minimal setup)
- **Database**: PostgreSQL via Supabase (better than MySQL for MVP)
- **Bot Library**: node-telegram-bot-api
- **Query Builder**: Knex.js (configured for PostgreSQL)
- **Real-time**: Supabase subscriptions for payment updates
- **Validation**: Joi
- **Logging**: Winston (basic setup)
- **Hosting**: Railway platform
- **Testing**: Jest (basic coverage)

## Project Structure
```
src/
├── bot/
│   ├── handlers/          # Telegram command handlers
│   └── bot.ts            # Bot initialization
├── services/
│   ├── paydigital.ts     # PayDigital API integration
│   ├── user.ts           # User management
│   └── transaction.ts    # Transaction handling
├── database/
│   ├── connection.ts     # Knex database setup
│   └── migrations/       # Database migrations
├── utils/
│   ├── logger.ts         # Winston logging
│   └── validation.ts     # Joi schemas
└── index.ts              # Express server entry point
```

## Development Principles for MVP

### 1. MVP-First Mentality
- Prioritize working features over perfect code
- Use simple, direct implementations
- Avoid premature optimization
- Focus on core user journey validation
- Ship fast, iterate based on real user feedback

### 2. Essential Features Only
Implement ONLY these user stories:
- New user onboarding with 3-question questionnaire
- Steam username validation via PayDigital API
- Amount selection ($5, $10, $15, $20 + custom)
- SBP payment processing and notifications
- Basic transaction history (last 10 transactions)

### 3. Code Quality Guidelines
- Write TypeScript with proper types
- Use async/await for all async operations
- Handle errors gracefully with user-friendly messages
- Log all payment-related events
- Keep functions focused and testable

### 4. Database Operations
- Use Knex.js query builder, not raw SQL
- Always use transactions for financial operations
- Index frequently queried columns
- Store all user events for post-MVP analysis

### 5. API Integration Patterns
- Use axios with proper error handling
- Implement basic retry logic for critical APIs
- Validate all external API responses
- Store API response data for debugging

## Key Files to Reference

### PRD Documentation
- `prd/product-requirements.md` - Complete product requirements
- `specifications/database-schema.md` - Database structure
- `specifications/user-flows.md` - Step-by-step user journeys
- `specifications/frontend-spec.md` - Exact bot text and buttons
- `research/technical-research.md` - API specifications

### When implementing features, ALWAYS:
1. Reference the exact specifications from these files
2. Use the precise text content from frontend-spec.md
3. Follow the user flows exactly as documented
4. Implement the database schema as specified

## Commission Calculation (Critical Business Logic)
```typescript
// Always use this exact calculation
const calculateCommission = (amountUSD: number, exchangeRate: number) => {
  const totalCommissionRate = 0.10; // 10% total
  const baseAmountRUB = amountUSD * exchangeRate;
  const totalAmountRUB = baseAmountRUB / (1 - totalCommissionRate);
  const paydigitalFeeRUB = totalAmountRUB * 0.055; // 5.5%
  const lootpayFeeRUB = totalAmountRUB * 0.045;   // 4.5%
  
  return {
    baseAmountRUB,
    totalAmountRUB,
    paydigitalFeeRUB,
    lootpayFeeRUB,
    netAmountRUB: baseAmountRUB
  };
};
```

## PayDigital API Integration
Base URL: `https://foreign.foreignpay.ru`

### CRITICAL: Two-Phase Steam Validation
**Important**: TransactionId can only be used ONCE. Call /steam/check twice:
1. **Phase 1**: Username validation (user experience)
2. **Phase 2**: Payment preparation (fresh transactionId)

### Steam Check Endpoint
```typescript
POST /steam/check
Body: { "steamUsername": "string" }
Response: { "transactionId": "string" } // Success

// Usage:
// 1st call: Validate username, show "Account found", DON'T store transactionId
// 2nd call: Get fresh transactionId right before /steam/pay
```

### Steam Pay Endpoint  
```typescript
POST /steam/pay
Headers: { "X-Partner-ID": "api_key" }
Body: {
  "steamUsername": "string",
  "amount": number, // Total amount in RUB
  "netAmount": number, // Net amount in RUB  
  "currency": "RUB",
  "transactionId": "string", // MUST be fresh from 2nd /steam/check call
  "orderId": "string",
  "directSuccess": false
}
Response: { "paymentUrl": "string" }

// Error: "Транзакция с таким ID уже обработана" means transactionId was reused
```

## Error Handling Patterns
```typescript
// Always use this pattern for API calls
try {
  const response = await apiCall();
  // Handle success
} catch (error) {
  logger.error('Operation failed', { error, context });
  // Send user-friendly message from frontend-spec.md
  // Store error for debugging
}
```

## Russian Text Guidelines
- All bot messages must be in Russian
- Use exact text from specifications/frontend-spec.md
- Include dynamic variables like {amount_rub}, {steam_username}
- Maintain friendly but professional tone
- Include emoji as specified in the documentation

## Testing Requirements
- Test all commission calculations with edge cases
- Test PayDigital API integration with mock responses
- Test complete user flows end-to-end
- Test error scenarios and recovery
- Aim for >70% coverage on critical business logic

## Environment Variables Required
```bash
TELEGRAM_BOT_TOKEN=         # Bot token from @BotFather
TELEGRAM_WEBHOOK_URL=       # Webhook URL for production
PAYDIGITAL_API_KEY=         # PayDigital partner ID
DATABASE_URL=               # PostgreSQL connection string (Supabase)
SUPABASE_URL=               # Supabase project URL
SUPABASE_ANON_KEY=          # Supabase anon key
NODE_ENV=                   # development/production
PORT=                       # Express server port
LOG_LEVEL=                  # Winston log level
```

## Common Commands

### Development
- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript
- `npm run test` - Run Jest tests
- `npm run migrate` - Run database migrations

### Database
- `npm run migrate:make name` - Create new migration
- `npm run migrate:rollback` - Rollback last migration

## MVP Success Criteria
Focus on these metrics only:
- Bot responds to all commands within 3 seconds
- Payment success rate >95%
- All financial transactions logged correctly
- 50+ completed transactions in first 30 days

## What NOT to implement in MVP
- Advanced analytics dashboards
- Complex error recovery mechanisms
- Performance optimizations
- Redis caching
- Advanced monitoring
- Microservices architecture
- Multiple payment providers
- Advanced user analytics

Remember: This is an MVP for market validation. Ship fast, measure user behavior, then optimize based on real data.
