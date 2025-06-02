# LootPay Telegram Bot - Master AI Prompt

## Project Overview
LootPay is a Telegram bot designed to provide safe and fast Steam account funding services for Russian gamers who cannot use traditional foreign payment methods due to current restrictions.

## Key Context
- **Target Market**: Post-Soviet Union countries, primarily Russia
- **Target Audience**: Russian gamers who play Steam games (Dota 2, CS:GO, etc.)
- **Business Model**: 10% total fee (4.5% margin after PayDigital.shop's 5.5% fee)
- **Backend Service**: PayDigital.shop API integration
- **Main Competitor**: GameKey.bot

## Core Functionality
1. Steam wallet funding via Telegram bot interface
2. Real-time exchange rate display (RUB to USD/Steam pricing)
3. Transaction status tracking
4. Secure payment processing via SBP (Fast Payment System)
5. User-friendly Russian language interface
6. New user questionnaire for ICP analysis

## Technical Stack
- **Platform**: Telegram Bot API
- **Backend**: Node.js/TypeScript
- **Payment Processing**: PayDigital.shop API
- **Database**: MySQL for user data, Redis for caching
- **Exchange Rates**: PayDigital rates API (updated every 2 hours)
- **Hosting**: Railway platform

## Critical Requirements
- **Security**: Robust fraud detection and user verification
- **Compliance**: Follow Russian payment regulations
- **Trust**: Build user confidence in a scam-prone ecosystem
- **Performance**: Fast transaction processing (under 15 minutes)
- **Support**: Russian language customer support
- **Analytics**: Complete user funnel tracking

## MVP Features (P0)
- Basic Steam wallet funding workflow
- Steam account validation
- SBP payment processing
- Transaction history with pagination
- 3-question user questionnaire
- Real-time exchange rate display
- Customer support integration
- Analytics event tracking

## User Flow Summary
1. **Bot Start** → Welcome message with value proposition
2. **New Users**: 3-question questionnaire → Steam login input
3. **Old Users**: Direct Steam login input
4. **Steam Validation** → Amount selection ($5/$10/$15/$20/custom)
5. **Payment Confirmation** → Exchange rate display → SBP payment
6. **Payment Processing** → Webhook status tracking
7. **Completion** → Success/Pending/Failed notifications

## PayDigital API Integration
- **Authentication**: X-Partner-ID header
- **Steam Check**: POST /steam/check (validate Steam username)
- **Exchange Rates**: GET /rates (USD_RUB conversion)
- **Payment**: POST /steam/pay (initiate SBP payment)
- **Webhooks**: Payment status notifications (Paid/Pending/Failed)

## Database Schema Summary
- **users**: Telegram user data, Steam usernames, questionnaire status
- **transactions**: Payment records, amounts, status, webhook data
- **user_responses**: Questionnaire answers for ICP analysis
- **user_events**: Analytics tracking for funnel optimization
- **system_settings**: Configurable limits and commission rates
- **exchange_rates**: Currency conversion data with 2-hour updates

## Commission Structure
- **User Pays**: Total amount in RUB (includes 10% fee)
- **Steam Gets**: Net amount (user's USD selection converted to RUB)
- **PayDigital Fee**: 5.5% of total transaction
- **LootPay Margin**: 4.5% of total transaction

## Key Dynamic Texts
- Min/max amounts from system_settings
- Exchange rates from database/API
- Steam usernames from validation
- Transaction amounts and dates
- Payment status updates

## Security & Compliance
- Steam username storage (permanent)
- Payment data protection (no card storage)
- Webhook verification with SHA256 hash
- Rate limiting and abuse prevention
- Daily automated backups

## Analytics Strategy
- **Funnel Tracking**: Every user action logged
- **ICP Analysis**: Questionnaire responses correlated with transaction success
- **Daily Review**: Conversion rates, drop-off points, revenue metrics
- **Optimization**: A/B testing for improved conversion

## Development Phases
1. **MVP Development**: Core bot functionality with PayDigital integration
2. **Analytics Enhancement**: Event tracking and conversion optimization
3. **Growth Features**: Advanced customer support and loyalty programs

## Key Risks
- PayDigital service reliability
- Telegram bot platform policy changes
- Competition from established players (GameKey.bot)
- Payment regulation compliance
- User trust in financial Telegram bots

## Success Metrics
- **Conversion**: >60% questionnaire to first transaction
- **Technical**: >95% payment success rate, >99% uptime
- **Business**: $500+ monthly margin by 90 days
- **User**: >40% repeat transaction rate within 30 days

---

When working on this project, always consider:
1. **Russian market context** and cultural preferences
2. **Security and trust** as top priorities for financial services
3. **Transparent pricing** as key differentiator
4. **Analytics-driven optimization** for user funnel
5. **Scalable architecture** for growth
6. **Comprehensive error handling** for robust user experience
7. **Real-time status updates** for payment transparency

## Command Quick Reference
- `/start` → Always return to main menu
- Bot supports both commands and inline button navigation
- All text content optimized for Russian users
- Dynamic content sourced from database settings
- Complete transaction history with pagination
- Comprehensive webhook handling for payment status
