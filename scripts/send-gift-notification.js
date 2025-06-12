const { getBotInstance } = require('../dist/bot/botInstance');
const { db } = require('../dist/database/connection');
const { analyticsService } = require('../dist/services/analytics/analyticsService');

async function sendGiftNotification() {
  console.log('🎁 Sending Gift Notification to User 22');
  console.log('======================================');
  
  try {
    // Get User 22 data
    console.log('🔍 Getting User 22 data...');
    const user22 = await db('users').where('id', 22).first();
    
    if (!user22) {
      console.log('❌ User 22 not found in database');
      return;
    }
    
    console.log(`📱 Found user: ${user22.username} (${user22.telegram_id})`);
    
    // Get bot instance
    const bot = await getBotInstance();
    
    // Promotional message text
    const giftMessage = `🎁 СПЕЦИАЛЬНОЕ ПРЕДЛОЖЕНИЕ!

💰 При пополнении от $5 USD вы получите дополнительно +$2 USD БОНУС!

⚡ Это ограниченное предложение - успейте воспользоваться!

🎮 Итого: заплатите $5, получите $7 на Steam кошелек!

⏰ Предложение действует ограниченное время!`;

    // Send message with CTA button that uses existing Steam top-up flow
    const messageOptions = {
      reply_markup: {
        inline_keyboard: [[
          { 
            text: '🎁 Получить подарок', 
            callback_data: 'fund_steam' // Use existing callback data for Steam funding
          }
        ]]
      }
    };
    
    console.log('📤 Sending promotional message...');
    
    const sentMessage = await bot.sendMessage(user22.telegram_id, giftMessage, messageOptions);
    
    console.log('✅ Message sent successfully!');
    console.log(`📨 Message ID: ${sentMessage.message_id}`);
    
    // Track analytics - gift notification sent
    await analyticsService.trackEvent(22, 'gift_notification_sent', {
      messageId: sentMessage.message_id,
      offerType: 'bonus_2usd_on_5usd',
      bonusAmount: 2,
      minimumPayment: 5,
      telegramId: user22.telegram_id,
      username: user22.username,
      buttonAction: 'fund_steam'
    });
    
    console.log('📊 Analytics tracked: gift_notification_sent');
    console.log('💡 When user clicks "Получить подарок", it will trigger existing Steam top-up flow');
    console.log('📊 Button clicks will be tracked by existing callback handlers');
    
  } catch (error) {
    console.error('❌ Error sending gift notification:', error.message);
  } finally {
    // Close database connection
    await db.destroy();
  }
  
  // Force exit after completion
  console.log('\n🚪 Exiting...');
  process.exit(0);
}

// Set a timeout to force exit if script hangs
setTimeout(() => {
  console.log('\n⏰ Script timeout reached, forcing exit...');
  process.exit(1);
}, 30000); // 30 second timeout

sendGiftNotification(); 