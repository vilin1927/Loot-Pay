const { checkMultipleUsersAccessibility, getAccessibilityStatistics } = require('../dist/services/user/accessibilityService');
const { db } = require('../dist/database/connection');

async function checkAllUsers() {
  console.log('🧪 Checking All Users Accessibility');
  console.log('===================================');
  
  try {
    console.log('🔍 Getting all users from database...');
    
    // Get all user IDs from database
    const users = await db('users').select('id', 'username', 'telegram_id').orderBy('id');
    
    if (users.length === 0) {
      console.log('📭 No users found in database');
      return;
    }
    
    console.log(`📊 Found ${users.length} users to check`);
    console.log('─────────────────────────────────');
    
    const userIds = users.map(user => user.id);
    
    console.log('🔄 Checking accessibility for all users...');
    console.log('(This may take a moment as we check each user)');
    
    const results = await checkMultipleUsersAccessibility(userIds);
    
    console.log('\n📊 Individual Results:');
    console.log('─────────────────────');
    
    for (const user of users) {
      const result = results.get(user.id);
      const statusIcon = result?.isAccessible ? '✅' : '❌';
      const statusText = result?.status || 'unknown';
      
      console.log(`User ${user.id}: ${statusIcon} ${statusText}`);
      console.log(`  Username: ${user.username || 'N/A'}`);
      console.log(`  Telegram ID: ${user.telegram_id}`);
      if (result?.errorMessage) {
        console.log(`  Error: ${result.errorMessage}`);
      }
      console.log('');
    }
    
    console.log('📈 Getting updated statistics...');
    const stats = await getAccessibilityStatistics();
    
    console.log('\n📊 Final Statistics:');
    console.log('───────────────────');
    console.log(`Total Users: ${stats.total}`);
    console.log(`✅ Active Users: ${stats.active} (${(stats.active/stats.total*100).toFixed(1)}%)`);
    console.log(`❌ Blocked Users: ${stats.blocked} (${(stats.blocked/stats.total*100).toFixed(1)}%)`);
    console.log(`📭 Chat Deleted: ${stats.chatDeleted} (${(stats.chatDeleted/stats.total*100).toFixed(1)}%)`);
    console.log(`🚫 Deactivated: ${stats.deactivated} (${(stats.deactivated/stats.total*100).toFixed(1)}%)`);
    console.log(`❓ Unknown Errors: ${stats.unknown} (${(stats.unknown/stats.total*100).toFixed(1)}%)`);
    console.log(`⚪ Never Checked: ${stats.neverChecked} (${(stats.neverChecked/stats.total*100).toFixed(1)}%)`);
    
    console.log('\n💡 Summary:');
    console.log('──────────');
    
    const accessibleCount = stats.active;
    const inaccessibleCount = stats.total - stats.active - stats.neverChecked;
    
    if (accessibleCount === stats.total) {
      console.log('🎉 All users can receive messages from the bot!');
    } else if (accessibleCount === 0) {
      console.log('⚠️  No users can currently receive messages from the bot');
    } else {
      console.log(`📊 ${accessibleCount} users can receive messages, ${inaccessibleCount} cannot`);
    }
    
    if (stats.blocked > 0) {
      console.log(`🚫 ${stats.blocked} users have blocked the bot`);
    }
    
    if (stats.chatDeleted > 0) {
      console.log(`📭 ${stats.chatDeleted} users have deleted their chat with the bot`);
    }
    
    if (stats.deactivated > 0) {
      console.log(`💤 ${stats.deactivated} users have deactivated their Telegram accounts`);
    }
    
    console.log('\n✅ All users checked successfully!');
    
  } catch (error) {
    console.error('❌ Error checking users:', error.message);
  } finally {
    // Close database connection
    await db.destroy();
  }
  
  // Force exit after completion
  console.log('\n🚪 Exiting...');
  process.exit(0);
}

// Set a timeout to force exit if test hangs (longer timeout for multiple users)
setTimeout(() => {
  console.log('\n⏰ Check timeout reached, forcing exit...');
  process.exit(1);
}, 120000); // 2 minute timeout for multiple users

checkAllUsers(); 