# LootPay Bot

Telegram bot for Steam wallet funding targeting Russian gamers. MVP focused on rapid market validation.

## Core Features

- New user onboarding with 3-question questionnaire
- Steam username validation via PayDigital API
- Amount selection ($5, $10, $15, $20 + custom)
- SBP payment processing and notifications
- Basic transaction history (last 10 transactions)
- State management for interrupted flows
- Required bot commands: /start, /help, /terms, /support

## Commission Structure

- Total commission: 10%
  - LootPay margin: 4.5%
  - PayDigital fee: 5.5%

## Tech Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js (minimal setup)
- **Database**: PostgreSQL via Supabase
- **Bot Library**: node-telegram-bot-api
- **Query Builder**: Knex.js
- **Real-time**: Supabase subscriptions
- **Validation**: Joi
- **Logging**: Winston
- **Hosting**: Railway platform

## Prerequisites

- Node.js 18 or higher
- Supabase account
- Telegram Bot Token
- PayDigital API credentials

## Environment Variables

```bash
# Telegram Configuration
TELEGRAM_BOT_TOKEN=         # Bot token from @BotFather
TELEGRAM_WEBHOOK_URL=       # Webhook URL for production
TELEGRAM_WEBHOOK_SECRET=    # Generated secret for webhook security

# Supabase Configuration
DATABASE_URL=               # PostgreSQL connection string
SUPABASE_URL=              # Supabase project URL
SUPABASE_ANON_KEY=         # Supabase anon key

# PayDigital Configuration
PAYDIGITAL_API_KEY=        # PayDigital partner ID
PAYDIGITAL_WEBHOOK_SECRET= # PayDigital webhook verification secret

# Application Configuration
NODE_ENV=                  # development/production
PORT=                      # Express server port
LOG_LEVEL=                 # Winston log level

# Support Configuration
SUPPORT_CHAT_ID=           # Support Telegram username
SUPPORT_EMAIL=             # Support email

# Exchange Rate Fallback
EXCHANGE_RATE_API_KEY=     # Optional for fallback API
DEFAULT_USD_RUB_RATE=80.0  # Emergency fallback rate
```

## Development

1. Clone the repository:
```bash
git clone https://github.com/vilin1927/Loot-Pay.git
cd Loot-Pay
```

2. Install dependencies:
```bash
npm install
```

3. Create .env file with required variables

4. Run database migrations:
```bash
npm run migrate
```

5. Start development server:
```bash
npm run dev
```

## Production Deployment

1. Push to GitHub:
```bash
git add .
git commit -m "Ready for production"
git push origin main
```

2. Deploy to Railway:
   - Connect GitHub repository
   - Set environment variables
   - Deploy

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript
- `npm start` - Start production server
- `npm run migrate` - Run database migrations
- `npm run migrate:rollback` - Rollback last migration

## Project Structure

```
src/
├── bot/
│   ├── handlers/          # Telegram command handlers
│   └── botInstance.ts     # Bot singleton instance
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

## License

MIT License - See [LICENSE](LICENSE) file for details
