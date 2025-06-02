# LootPay MVP Production Checklist

## 1. Environment Variables

### Required Variables
```bash
# Bot Configuration
TELEGRAM_BOT_TOKEN=         # Bot token from @BotFather
TELEGRAM_WEBHOOK_URL=       # Production webhook URL
TELEGRAM_WEBHOOK_SECRET=    # Generated secret for webhook security

# PayDigital Integration
PAYDIGITAL_API_KEY=         # Partner ID from PayDigital
PAYDIGITAL_WEBHOOK_SECRET=  # Webhook verification secret

# Database (Supabase)
DATABASE_URL=               # PostgreSQL connection string
SUPABASE_URL=              # Supabase project URL
SUPABASE_ANON_KEY=         # Supabase anon key

# Application
NODE_ENV=production        # Must be 'production'
PORT=3000                  # Express server port
LOG_LEVEL=info            # Winston log level

# Support
SUPPORT_CHAT_ID=@lootpay_support  # Support Telegram username
SUPPORT_EMAIL=support@lootpay.ru  # Support email

# Exchange Rate
EXCHANGE_RATE_API_KEY=     # Optional for fallback API
DEFAULT_USD_RUB_RATE=80.0  # Emergency fallback rate
```

## 2. Command Verification

### Required Commands
- [ ] `/start` - Shows welcome message and main menu
- [ ] `/help` - Displays help information
- [ ] `/terms` - Shows terms of service
- [ ] `/support` - Provides support contact

### Command Flow Testing
1. New User Flow:
   - [ ] /start shows welcome message
   - [ ] Main menu buttons work
   - [ ] Steam username validation
   - [ ] Amount selection
   - [ ] Payment confirmation
   - [ ] SBP payment link

2. Existing User Flow:
   - [ ] /start detects existing state
   - [ ] Continue/restart options work
   - [ ] State recovery functions
   - [ ] Transaction history accessible

## 3. Commission Calculation

### Verify Implementation
```typescript
// Must match exactly:
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

### Test Cases
- [ ] $5 payment
- [ ] $10 payment
- [ ] $15 payment
- [ ] $20 payment
- [ ] Custom amount
- [ ] Edge cases (min/max amounts)

## 4. Remaining TODOs

### Critical
- [ ] Set up production database
- [ ] Configure webhook URL
- [ ] Set up monitoring
- [ ] Test PayDigital integration
- [ ] Verify SBP payments

### Important
- [ ] Set up error logging
- [ ] Configure backup system
- [ ] Test state recovery
- [ ] Verify commission calculations
- [ ] Test all error scenarios

### Nice to Have
- [ ] Add analytics
- [ ] Improve error messages
- [ ] Add more test cases
- [ ] Document API endpoints
- [ ] Set up CI/CD

## 5. Deployment Instructions

### Prerequisites
1. Node.js 18+ installed
2. PostgreSQL database (Supabase)
3. Railway account
4. Telegram bot token
5. PayDigital API access

### Deployment Steps
1. Clone repository:
   ```bash
   git clone https://github.com/your-org/lootpay.git
   cd lootpay
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment:
   ```bash
   cp .env.example .env
   # Edit .env with production values
   ```

4. Run migrations:
   ```bash
   npm run migrate
   ```

5. Build application:
   ```bash
   npm run build
   ```

6. Deploy to Railway:
   ```bash
   railway up
   ```

7. Verify deployment:
   - Check logs
   - Test /start command
   - Verify webhook
   - Test payment flow

### Post-Deployment
1. Monitor error logs
2. Check transaction history
3. Verify commission calculations
4. Test state recovery
5. Monitor payment success rate

## 6. Success Criteria

### MVP Metrics
- [ ] Bot responds within 3 seconds
- [ ] Payment success rate >95%
- [ ] All transactions logged
- [ ] 50+ transactions in 30 days

### Technical Requirements
- [ ] All commands working
- [ ] State management reliable
- [ ] Error handling robust
- [ ] Logging complete
- [ ] Security measures in place

## 7. Support Setup

### Required Channels
- [ ] Telegram support bot
- [ ] Support email
- [ ] Error monitoring
- [ ] Transaction logs
- [ ] User feedback system

### Response Times
- [ ] Critical errors: <15 minutes
- [ ] Payment issues: <30 minutes
- [ ] General support: <2 hours
- [ ] Feature requests: <24 hours 