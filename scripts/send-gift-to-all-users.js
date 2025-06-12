const { getBotInstance } = require('../dist/bot/botInstance');
const { db } = require('../dist/database/connection');
const { analyticsService } = require('../dist/services/analytics/analyticsService');

async function sendGiftToAllUsers() {
  console.log('🎁 Sending Gift Notification to All Users');
  console.log('==========================================');
  
  try {
    // Get all users from database
    console.log('🔍 Getting all users from database...');
    const users = await db('users').select('id', 'username', 'telegram_id').orderBy('id');
    
    if (users.length === 0) {
      console.log('📭 No users found in database');
      return;
    }
    
    console.log(`📊 Found ${users.length} users to send gift notification`);
    console.log('─────────────────────────────────────────────────');
    
    // Get bot instance
    const bot = await getBotInstance();
    
    // Promotional message text
    const giftMessage = `🎁 СПЕЦИАЛЬНОЕ ПРЕДЛОЖЕНИЕ!

💰 При пополнении от $5 USD вы получите дополнительно +$2 USD БОНУС!

⚡ Это ограниченное предложение - успейте воспользоваться!

🎮 Итого: заплатите $5, получите $7 на Steam кошелек!

⏰ Предложение действует ограниченное время!`;

    // Send message with CTA button
    const messageOptions = {
      reply_markup: {
        inline_keyboard: [[
          { 
            text: '🎁 Получить подарок', 
            callback_data: 'fund_steam'
          }
        ]]
      }
    };
    
    const results = {
      successful: [],
      failed: []
    };
    
    console.log('📤 Sending messages to all users...\n');
    
    for (const user of users) {
      try {
        console.log(`📨 Sending to User ${user.id} (${user.username})...`);
        
        const sentMessage = await bot.sendMessage(user.telegram_id, giftMessage, messageOptions);
        
        console.log(`✅ SUCCESS - Message ID: ${sentMessage.message_id}`);
        
        results.successful.push({
          userId: user.id,
          username: user.username,
          telegramId: user.telegram_id,
          messageId: sentMessage.message_id
        });
        
        // Track analytics for successful send
        await analyticsService.trackEvent(user.id, 'gift_notification_sent', {
          messageId: sentMessage.message_id,
          offerType: 'bonus_2usd_on_5usd',
          bonusAmount: 2,
          minimumPayment: 5,
          telegramId: user.telegram_id,
          username: user.username,
          buttonAction: 'fund_steam',
          batchSend: true
        });
        
      } catch (error) {
        console.log(`❌ FAILED - Error: ${error.message}`);
        
        results.failed.push({
          userId: user.id,
          username: user.username,
          telegramId: user.telegram_id,
          error: error.message,
          errorCode: error.code
        });
        
        // Track analytics for failed send
        await analyticsService.trackEvent(user.id, 'gift_notification_failed', {
          error: error.message,
          errorCode: error.code,
          telegramId: user.telegram_id,
          username: user.username,
          batchSend: true
        });
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('');
    }
    
    console.log('📊 FINAL RESULTS:');
    console.log('═════════════════');
    
    console.log(`\n✅ SUCCESSFUL SENDS (${results.successful.length}):`);
    results.successful.forEach(result => {
      console.log(`  User ${result.userId}: ${result.username} - Message ID: ${result.messageId}`);
    });
    
    console.log(`\n❌ FAILED SENDS (${results.failed.length}):`);
    results.failed.forEach(result => {
      console.log(`  User ${result.userId}: ${result.username} - ${result.error}`);
    });
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`  Total Users: ${users.length}`);
    console.log(`  Successful: ${results.successful.length} (${(results.successful.length/users.length*100).toFixed(1)}%)`);
    console.log(`  Failed: ${results.failed.length} (${(results.failed.length/users.length*100).toFixed(1)}%)`);
    
    // Analyze blocked users
    const blockedUsers = results.failed.filter(result => 
      result.error.includes('bot was blocked') || 
      result.error.includes('Forbidden')
    );
    
    if (blockedUsers.length > 0) {
      console.log(`\n🚫 BLOCKED USERS (${blockedUsers.length}):`);
      blockedUsers.forEach(result => {
        console.log(`  User ${result.userId}: ${result.username} - Bot was blocked`);
      });
      console.log('\n💡 PROOF: Blocked users cannot receive messages (403 Forbidden errors)');
    }
    
    console.log('\n✅ Gift notification batch send completed!');
    
  } catch (error) {
    console.error('❌ Error in batch send:', error.message);
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
}, 60000); // 1 minute timeout

sendGiftToAllUsers(); 