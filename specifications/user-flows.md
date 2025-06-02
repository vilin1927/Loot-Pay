# Complete User Flows - LootPay Telegram Bot

## Flow 1: New User Complete Journey

### Step 1: Bot Start
**Trigger**: User sends `/start` or first message  
**User Type**: New user (not in database)

**Process**:
1. Check user existence in database
2. Create new user record
3. Log analytics event: `bot_start`
4. Show welcome message with value proposition

**Text**: [See frontend-spec.md - Welcome Message]  
**Buttons**: `[💰 Пополнить Steam] [📊 История пополнений] [❓ Поддержка] [📄 О нас / Оферта/ FAQ]`

**Logic**: When user clicks [💰 Пополнить Steam] → Go to Step 2

### Step 2: Questionnaire Flow
**Trigger**: New user clicks [💰 Пополнить Steam]

#### Step 2.1: Question 1 - Steam Spending
**Process**:
1. Log analytics event: `questionnaire_start`
2. Set questionnaire_started_at timestamp
3. Show first question
4. Block other navigation during questionnaire

**Text**: [See frontend-spec.md - Question 1]  
**Buttons**: 4 spending category options  
**Data Storage**: Store answer in user_responses table  
**Logic**: After answer → Step 2.2

#### Step 2.2: Question 2 - Previous Experience
**Process**:
1. Log analytics event: `questionnaire_q1_answered`
2. Store Q1 response in database
3. Show second question

**Text**: [See frontend-spec.md - Question 2]  
**Buttons**: 3 experience options  
**Data Storage**: Store answer in user_responses table  
**Logic**: After answer → Step 2.3

#### Step 2.3: Question 3 - USD Preference
**Process**:
1. Log analytics event: `questionnaire_q2_answered`
2. Store Q2 response in database
3. Show third question

**Text**: [See frontend-spec.md - Question 3]  
**Buttons**: 3 preference options  
**Data Storage**: Store answer in user_responses table  
**Logic**: After answer → Step 3

### Step 3: Questionnaire Complete → Steam Login
**Trigger**: User answers Question 3

**Process**:
1. Log analytics event: `questionnaire_q3_answered`, `questionnaire_completed`
2. Store Q3 response in database
3. Set questionnaire_completed = TRUE, questionnaire_completed_at = NOW()
4. Show completion message and request Steam username

**Text**: [See frontend-spec.md - Questionnaire Complete (New Users)]  
**Buttons**: `[🧠 Как найти логин?] [ℹ️ Меню]`  
**Logic**: 
- [🧠 Как найти логин?] → Go to Help Page
- [ℹ️ Меню] → Return to main menu
- Text input → Process Steam username

### Step 4: Steam Username Validation
**Trigger**: User enters Steam username text

**Process**:
1. Validate input format (basic sanitization)
2. Call PayDigital API: `POST /steam/check`
3. Store API response
4. Log analytics event: `steam_username_provided`

**API Call**:
```bash
curl -X 'POST' \
'https://foreign.foreignpay.ru/steam/check' \
-H 'accept: application/json' \
-H 'Content-Type: application/json' \
-d '{"steamUsername": "user_input"}'
```

#### Success Response (200):
**Process**:
1. Log analytics event: `steam_validation_success`
2. Store steam_username in users table
3. Store transactionId for payment step
4. Show success message with amount selection

**Text**: [See frontend-spec.md - Account Found]  
**Buttons**: `[5 USD] [10 USD] [15 USD] [20 USD] [Своя сумма 🪙] [Ввести другой логин 🔄]`

#### Error Response (400):
**Process**:
1. Log analytics event: `steam_validation_failed`
2. Show error message
3. Allow retry

**Text**: [See frontend-spec.md - Account Not Found]  
**Buttons**: `[🧠 Как найти логин?]`

### Step 5: Amount Selection
**Trigger**: User clicks amount button or selects custom amount

#### Preset Amount Selection:
**Process**:
1. Store selected amount_usd
2. Get current exchange rate from database/API
3. Calculate total amounts with commission
4. Log analytics event: `amount_selected`
5. Proceed to payment confirmation

#### Custom Amount Selection:
**Process**:
1. Show custom amount input request
2. Validate against min/max limits from system_settings
3. If valid → proceed to payment confirmation
4. If invalid → show appropriate error message

**Text**: [See frontend-spec.md - Custom Amount Input]

**Validation Logic**:
```javascript
const minAmount = getSystemSetting('min_amount_usd'); // 2.00
const maxAmount = getSystemSetting('max_amount_usd'); // 100.00

if (userAmount < minAmount) {
  showError('amount_too_low');
} else if (userAmount > maxAmount) {
  showError('amount_too_high');
} else {
  proceedToPayment(userAmount);
}
```

### Step 6: Payment Confirmation
**Trigger**: Valid amount selected

**Process**:
1. Get current exchange rate
2. Calculate commission breakdown
3. Call PayDigital API: `POST /steam/pay`
4. Generate payment link
5. Show confirmation with payment details

**Commission Calculation**:
```javascript
const exchangeRate = getCurrentExchangeRate('USD_RUB');
const totalCommission = 0.10; // 10%
const baseAmountRUB = userAmountUSD * exchangeRate;
const totalAmountRUB = baseAmountRUB / (1 - totalCommission);
const netAmountRUB = baseAmountRUB;
```

**API Call**:
```bash
curl -X 'POST' \
'https://foreign.foreignpay.ru/steam/pay' \
-H 'X-Partner-ID: api_key' \
-H 'Content-Type: application/json' \
-d '{
  "steamUsername": "stored_username",
  "amount": calculated_total_rub,
  "netAmount": calculated_net_rub,
  "currency": "RUB",
  "transactionId": "stored_transaction_id",
  "orderId": "generated_order_id",
  "directSuccess": false
}'
```

#### Success Response (200):
**Process**:
1. Store payment URL and transaction details
2. Update transaction status to 'processing'
3. Log analytics event: `payment_link_generated`
4. Show payment confirmation

**Text**: [See frontend-spec.md - Payment Details Confirmation]  
**Buttons**: `[✅ Оплатить СБП [amount] ₽] [🔁 Изменить логин] [💵 Изменить сумму]`

#### Error Response (400/500):
**Process**:
1. Log analytics event: `payment_creation_failed`
2. Show error message with retry options

**Text**: [See frontend-spec.md - Payment Creation Error]

### Step 7: Payment Processing
**Trigger**: User clicks [✅ Оплатить СБП]

**Process**:
1. Open payment URL (SBP link)
2. Show processing message immediately
3. Wait for webhook notification

**Text**: [See frontend-spec.md - Payment Initiated]  
**Buttons**: `[🛠 Написать в поддержку]`

### Step 8: Webhook Processing & Completion
**Trigger**: PayDigital webhook received

**Webhook Payload**:
```json
{
  "order_uuid": "transaction_uuid",
  "amount": 123,
  "status": "Paid|Pending|Failed",
  "paid_date_msk": "2024-04-30T00:00:00.000Z",
  "hash": "verification_hash",
  "order_id": "our_order_id"
}
```

#### Status: "Paid" (Success):
**Process**:
1. Verify webhook signature
2. Update transaction: status='paid', paid_at=webhook_date
3. Update user: total_transactions++, total_volume_rub += amount
4. Log analytics event: `payment_completed`
5. Send success notification

**Text**: [See frontend-spec.md - Payment Successful]  
**Buttons**: `[🏠 Главное меню]`

#### Status: "Pending":
**Process**:
1. Update transaction status to 'pending'
2. Send pending notification

**Text**: [See frontend-spec.md - Payment Pending]

#### Status: "Failed":
**Process**:
1. Update transaction status to 'failed'
2. Send failure notification

**Text**: [See frontend-spec.md - Payment Failed]

---

## Flow 2: Returning User Journey

### Step 1: Bot Start (Returning User)
**Trigger**: Existing user sends `/start`

**Process**:
1. Recognize user from database
2. Update last_activity_at
3. Log analytics event: `bot_start`
4. Show welcome message

**Logic**: When user clicks [💰 Пополнить Steam] → Skip questionnaire, go to Step 2

### Step 2: Steam Username Input (Returning User)
**Trigger**: Existing user clicks [💰 Пополнить Steam]

**Process**:
1. Skip questionnaire (questionnaire_completed = TRUE)
2. Show Steam username request
3. Pre-fill with stored steam_username if available

**Text**: [See frontend-spec.md - Steam Login Request (Returning Users)]  
**Buttons**: `[🧠 Как найти логин?] [ℹ️ Меню]`

**Logic**: Continue with Steam validation (same as Flow 1, Step 4)

---

## Flow 3: Transaction History Flow

### Step 1: History Access
**Trigger**: User clicks [📊 История пополнений]

**Process**:
1. Query user transactions with pagination
2. Check if user has any transactions
3. Log analytics event: `transaction_history_viewed`

#### No Transactions:
**Text**: [See frontend-spec.md - No Transactions Yet]  
**Buttons**: `[💰 Пополнить сейчас] [🔄 В начало]`

#### Has Transactions:
**Process**:
1. Load 3 transactions per page
2. Calculate pagination needs
3. Show transaction list with appropriate buttons

**Query**:
```sql
SELECT * FROM transactions 
WHERE user_id = ? 
ORDER BY created_at DESC 
LIMIT 3 OFFSET ?
```

**Text**: [See frontend-spec.md - Transaction History Display]

#### Pagination Logic:
```javascript
const totalTransactions = getUserTransactionCount(userId);
const currentPage = getCurrentPage();
const totalPages = Math.ceil(totalTransactions / 3);

// Show navigation buttons based on position
const showPrevious = currentPage > 1;
const showNext = currentPage < totalPages;
```

**Buttons**:
- ≤3 total transactions: `[💰 Сделать новое пополнение] [🛡️ Поддержка]`
- >3 transactions: Add pagination buttons above

---

## Flow 4: Help and Support Flows

### Steam Username Help
**Trigger**: User clicks [🧠 Как найти логин?]

**Process**:
1. Show detailed instructions
2. Provide external links
3. Offer return to main flow

**Text**: [See frontend-spec.md - Steam Login Help Page]  
**Buttons**: `[Перейти к пополнению 🎮]`

### Support Contact
**Trigger**: User clicks support buttons

**Process**:
1. Redirect to support bot/channel
2. Log analytics event: `support_contacted`
3. Provide user context if possible

---

## Flow 5: Error Handling Flows

### API Timeout Handling
**Trigger**: PayDigital API timeout

**Process**:
1. Implement exponential backoff retry
2. After max retries, show user-friendly error
3. Provide retry and support options

### Invalid Input Handling
**Trigger**: User enters invalid data

**Process**:
1. Validate input client-side first
2. Show specific error messages
3. Guide user to correct input format

### System Error Handling
**Trigger**: Unexpected system errors

**Process**:
1. Log error details for debugging
2. Show generic error message to user
3. Provide support contact option

---

## Analytics Event Tracking

### Funnel Events (In Order):
1. `bot_start` - User initiates bot
2. `questionnaire_start` - New user begins questionnaire
3. `questionnaire_q1_answered` - First question answered
4. `questionnaire_q2_answered` - Second question answered
5. `questionnaire_q3_answered` - Third question answered
6. `questionnaire_completed` - All questions finished
7. `steam_username_provided` - User provides Steam login
8. `steam_validation_success` - Steam account validated
9. `amount_selection_viewed` - User sees amount options
10. `amount_selected` - User chooses amount
11. `payment_confirmation_viewed` - User sees payment details
12. `payment_link_generated` - Payment link created
13. `payment_completed` - Transaction successful

### Additional Events:
- `steam_validation_failed` - Invalid Steam account
- `payment_creation_failed` - Payment API error
- `transaction_history_viewed` - User checks history
- `support_contacted` - User contacts support

### Event Data Structure:
```json
{
  "user_id": 123,
  "event_type": "amount_selected",
  "event_data": {
    "amount_usd": 10.00,
    "amount_rub": 802.40,
    "exchange_rate": 80.24,
    "steam_username": "username"
  },
  "step_in_funnel": 9,
  "session_id": "uuid",
  "created_at": "2025-05-30T12:00:00Z"
}
```

---

## State Management

### User State Tracking:
```javascript
const userStates = {
  IDLE: 'idle',
  QUESTIONNAIRE_Q1: 'questionnaire_q1',
  QUESTIONNAIRE_Q2: 'questionnaire_q2', 
  QUESTIONNAIRE_Q3: 'questionnaire_q3',
  AWAITING_STEAM_USERNAME: 'awaiting_steam_username',
  AWAITING_CUSTOM_AMOUNT: 'awaiting_custom_amount',
  PAYMENT_PENDING: 'payment_pending'
};
```

### State Transitions:
- States stored in Redis with TTL
- Critical states persisted in database
- State validation on each user interaction

---

**Document Version**: 2.0  
**Last Updated**: May 30, 2025  
**Status**: Complete Implementation Guide  
**Dependencies**: frontend-spec.md, database-schema.md
