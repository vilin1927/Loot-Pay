# User Stories - LootPay Telegram Bot

## Epic 1: User Onboarding and Registration

### Story 1.1: New User Welcome
**As a** Russian gamer discovering LootPay  
**I want to** understand the value proposition immediately  
**So that** I can decide if this service meets my Steam funding needs  

**Acceptance Criteria:**
- Welcome message displays service benefits clearly
- Pricing transparency (10% commission) is prominently featured
- Process explanation shows 3 simple steps
- Dynamic minimum amount shows both RUB and USD
- Call-to-action buttons are clear and prominent

**Definition of Done:**
- Welcome text renders with dynamic currency amounts
- All buttons navigate to correct flows
- New user flag triggers questionnaire
- Analytics event "bot_start" logged

### Story 1.2: User Questionnaire for ICP Analysis
**As a** business owner  
**I want to** understand user preferences and behavior  
**So that** I can optimize the service and identify ideal customers  

**Acceptance Criteria:**
- 3 questions cover spending habits, previous experience, and USD preference
- Questions cannot be skipped (mandatory flow)
- Responses are stored for analytics and ICP scoring
- User cannot navigate away during questionnaire
- Completion triggers success message and next step

**Definition of Done:**
- All 3 questions display with proper buttons
- Responses stored in user_responses table
- questionnaire_completed flag set to TRUE
- Analytics events track each question completion
- ICP scoring algorithm can process responses

### Story 1.3: Steam Username Collection
**As a** user wanting to fund my Steam account  
**I want to** provide my Steam username safely  
**So that** funds go to the correct account  

**Acceptance Criteria:**
- Clear instructions on finding Steam username
- Help system with detailed guidance
- Warning about accuracy and consequences of mistakes
- Different messaging for new vs returning users
- Steam username stored permanently for future use

**Definition of Done:**
- Text input accepts Steam username
- Help button shows detailed instructions
- Username validation through PayDigital API
- Steam username stored in users table
- Error handling for invalid usernames

## Epic 2: Steam Account Validation and Amount Selection

### Story 2.1: Steam Account Verification
**As a** user  
**I want to** verify my Steam account exists  
**So that** I can be confident funds will reach the right account  

**Acceptance Criteria:**
- API call to PayDigital /steam/check endpoint
- Success shows account found with username confirmation
- Failure shows clear error message and retry options
- Transaction ID stored for next payment step
- Clear guidance for resolving validation issues

**Definition of Done:**
- PayDigital API integration working correctly
- Success response shows validated username
- Error handling with user-friendly messages
- Transaction record created with validation data
- Analytics events track validation success/failure

### Story 2.2: Amount Selection with Presets
**As a** user  
**I want to** select from common funding amounts quickly  
**So that** I can choose my preferred amount without typing  

**Acceptance Criteria:**
- Preset buttons for $5, $10, $15, $20 USD
- Custom amount option for other values
- Dynamic min/max limits from system settings
- Clear display of current exchange rate
- Option to change Steam username or amount

**Definition of Done:**
- All preset amount buttons functional
- Custom amount input with validation
- Min/max limits enforced with clear error messages
- Exchange rate displayed accurately
- Navigation options to previous steps work

### Story 2.3: Custom Amount Validation
**As a** user entering a custom amount  
**I want to** receive clear feedback on amount limits  
**So that** I can choose a valid amount for funding  

**Acceptance Criteria:**
- Amounts below minimum show error with suggestion
- Amounts above maximum show error with suggestion
- Valid amounts proceed to payment confirmation
- Quick-fix buttons for min/max amounts
- Clear explanation of limit reasons

**Definition of Done:**
- Input validation works for all edge cases
- Error messages reference dynamic limits from database
- Quick-fix buttons use current system settings
- User can easily correct invalid amounts
- Validation prevents invalid payment attempts

## Epic 3: Payment Processing and Confirmation

### Story 3.1: Payment Confirmation Display
**As a** user ready to pay  
**I want to** review all payment details clearly  
**So that** I can confirm everything is correct before paying  

**Acceptance Criteria:**
- Steam username, amount, and total cost displayed
- Exchange rate and commission clearly shown
- Warning about accuracy and irreversibility
- SBP payment button with exact amount in rubles
- Options to modify username or amount

**Definition of Done:**
- All payment details calculated correctly
- Commission calculation includes both PayDigital and LootPay fees
- Exchange rate reflects current database value
- Payment button shows exact amount user will pay
- Modification options navigate to correct steps

### Story 3.2: SBP Payment Processing
**As a** user  
**I want to** complete payment through SBP quickly  
**So that** I can fund my Steam account with minimal friction  

**Acceptance Criteria:**
- PayDigital API call creates payment successfully
- SBP payment link opens in appropriate app
- Immediate confirmation message shows payment is processing
- Clear instruction that updates will come automatically
- Support contact option available during waiting

**Definition of Done:**
- PayDigital /steam/pay API integration complete
- Payment URL opens correctly on mobile devices
- Transaction status updated to 'processing'
- User receives immediate processing confirmation
- Analytics event "payment_link_generated" logged

### Story 3.3: Payment Status Tracking
**As a** user who has initiated payment  
**I want to** receive real-time updates on payment status  
**So that** I know when my Steam account has been funded  

**Acceptance Criteria:**
- Webhook processes payment status updates correctly
- Success message shows completion with transaction details
- Pending message explains potential delays
- Failed message provides support contact information
- All status updates include transaction reference

**Definition of Done:**
- Webhook endpoint validates PayDigital signatures
- All payment statuses (Paid/Pending/Failed) handled correctly
- User notifications sent immediately upon status change
- Transaction records updated with webhook data
- Analytics events track final payment outcomes

## Epic 4: Transaction History and User Management

### Story 4.1: Transaction History Display
**As a** user with previous transactions  
**I want to** view my funding history  
**So that** I can track my Steam spending and verify transactions  

**Acceptance Criteria:**
- Transaction history shows 3 transactions per page
- Each transaction displays date, time, amount, and status
- Pagination works correctly with navigation validation
- Empty state shows helpful message for new users
- Quick access to new transaction and support

**Definition of Done:**
- Transaction query with proper pagination
- Transaction display formatting matches specifications
- Pagination buttons only show when appropriate
- Empty state directs users to funding flow
- Performance optimized for users with many transactions

### Story 4.2: Returning User Experience
**As a** returning user  
**I want to** fund my Steam account quickly  
**So that** I can skip the onboarding and use my saved information  

**Acceptance Criteria:**
- Questionnaire is skipped for existing users
- Saved Steam username is used by default
- Transaction history is accessible from main menu
- Previous transaction patterns could inform suggestions
- Same security warnings and confirmations apply

**Definition of Done:**
- User status correctly identified (new vs returning)
- Questionnaire bypass logic works correctly
- Steam username retrieved from database
- All security measures maintained for returning users
- User experience optimized for speed and familiarity

## Epic 5: Support and Help System

### Story 5.1: In-Bot Help System
**As a** user needing assistance  
**I want to** access help information within the bot  
**So that** I can resolve issues without leaving Telegram  

**Acceptance Criteria:**
- Steam username help with step-by-step instructions
- Links to official Steam account pages
- Clear navigation back to main functionality
- FAQ integration for common questions
- Support contact information readily available

**Definition of Done:**
- Help content displays correctly with formatting
- External links work properly on mobile devices
- Navigation maintains user context and state
- FAQ covers most common user questions
- Support escalation path is clear and functional

### Story 5.2: Customer Support Integration
**As a** user with a payment issue  
**I want to** contact support easily  
**So that** I can resolve problems and get assistance quickly  

**Acceptance Criteria:**
- Support contact accessible from all error states
- Transaction details automatically included in support requests
- Clear escalation path for different issue types
- Support team can access relevant user and transaction data
- Response time expectations clearly communicated

**Definition of Done:**
- Support contact mechanism implemented
- User context and transaction data available to support
- Support team procedures documented
- Response time targets defined and monitored
- Issue tracking and resolution process established

## Epic 6: Analytics and Optimization

### Story 6.1: User Behavior Tracking
**As a** product manager  
**I want to** track user behavior through the funnel  
**So that** I can identify optimization opportunities  

**Acceptance Criteria:**
- All major user actions generate analytics events
- Funnel conversion rates calculated daily
- Drop-off points identified and measured
- User segmentation based on questionnaire responses
- ICP scoring correlated with transaction success

**Definition of Done:**
- Comprehensive event tracking implemented
- Analytics dashboard shows key metrics
- Funnel analysis identifies optimization opportunities
- ICP scoring algorithm working correctly
- Daily reports generated automatically

### Story 6.2: Performance Monitoring
**As a** technical team member  
**I want to** monitor system performance and reliability  
**So that** I can ensure excellent user experience  

**Acceptance Criteria:**
- API response times monitored and alerted
- Database performance tracked and optimized
- Payment success rates measured and reported
- Error rates monitored with automatic alerts
- System uptime meets reliability targets

**Definition of Done:**
- Monitoring system implemented and configured
- Alert thresholds set for all critical metrics
- Performance baselines established
- Regular performance reports generated
- Incident response procedures documented

## Epic 7: System Administration and Configuration

### Story 7.1: Dynamic System Settings
**As a** business administrator  
**I want to** modify transaction limits and rates  
**So that** I can adapt to market conditions without code changes  

**Acceptance Criteria:**
- Transaction limits configurable through database
- Commission rates adjustable via system settings
- Exchange rate update frequency configurable
- Changes take effect immediately across all users
- Audit trail for all setting modifications

**Definition of Done:**
- System settings table implemented correctly
- Settings update mechanism working
- All dynamic text reflects current settings
- Change audit and approval process established
- Emergency override procedures documented

### Story 7.2: Exchange Rate Management
**As a** system administrator  
**I want to** ensure accurate and current exchange rates  
**So that** users see correct pricing information  

**Acceptance Criteria:**
- Exchange rates updated every 2 hours automatically
- Fallback to real-time API if cached rate is stale
- Rate history maintained for audit and analysis
- Multiple currency pairs supported for future expansion
- Rate change notifications for significant fluctuations

**Definition of Done:**
- Automated rate update job implemented
- Fallback mechanism working correctly
- Rate history stored and accessible
- Currency conversion calculations accurate
- Alert system for rate update failures

## Epic 8: Security and Compliance

### Story 8.1: Data Protection and Privacy
**As a** user providing personal information  
**I want to** know my data is protected and used responsibly  
**So that** I can trust the service with my information  

**Acceptance Criteria:**
- All sensitive data encrypted at rest
- Secure transmission for all API communications
- User data retention policies clearly defined
- Data deletion capabilities for user requests
- Privacy policy accessible and understandable

**Definition of Done:**
- Encryption implemented for sensitive data fields
- HTTPS enforced for all external communications
- Data retention policies implemented in code
- User data export and deletion functions working
- Privacy documentation complete and accessible

### Story 8.2: Payment Security and Fraud Prevention
**As a** business owner  
**I want to** prevent fraudulent transactions  
**So that** I can protect the business and legitimate users  

**Acceptance Criteria:**
- Webhook signature verification for all payment updates
- Rate limiting to prevent abuse and spam
- Transaction pattern monitoring for suspicious activity
- User verification for high-value transactions
- Clear terms of service and enforcement procedures

**Definition of Done:**
- Webhook security verification implemented
- Rate limiting configured appropriately
- Basic fraud detection patterns implemented
- Terms of service documented and enforced
- Security incident response procedures established

## Non-Functional Requirements

### Performance Requirements
- **Response Time**: All user interactions complete within 2 seconds
- **Throughput**: System handles 100 concurrent users without degradation
- **Availability**: 99.9% uptime excluding planned maintenance
- **Scalability**: Architecture supports 10x user growth without major changes

### Security Requirements
- **Data Encryption**: AES-256 encryption for sensitive data at rest
- **Transmission Security**: TLS 1.3 for all external communications
- **Authentication**: Secure API key management and rotation
- **Audit Logging**: Complete audit trail for all financial transactions

### Usability Requirements
- **Language**: Native Russian language interface and support
- **Mobile Optimization**: Optimized for Telegram mobile experience
- **Accessibility**: Clear navigation and error messages
- **Learning Curve**: New users can complete first transaction within 10 minutes

### Reliability Requirements
- **Error Handling**: Graceful degradation for all failure scenarios
- **Data Integrity**: Transaction data consistency across all operations
- **Backup and Recovery**: Daily backups with tested recovery procedures
- **Monitoring**: Comprehensive monitoring with proactive alerting

---

**Document Version**: 2.0  
**Last Updated**: May 30, 2025  
**Status**: Complete and Ready for Implementation
