const { testUser22Accessibility, getAccessibilityStatistics } = require('../dist/services/user/accessibilityService');

async function testUser22() {
  console.log('🧪 Testing User 22 Accessibility');
  console.log('=================================');
  
  try {
    console.log('🔍 Checking User 22 accessibility...');
    
    const result = await testUser22Accessibility();
    
    console.log('\n📊 Results:');
    console.log('─────────────');
    console.log(`Status: ${result.status}`);
    console.log(`Accessible: ${result.isAccessible ? '✅ Yes' : '❌ No'}`);
    console.log(`Checked: ${result.lastChecked.toISOString()}`);
    
    if (result.errorMessage) {
      console.log(`Error: ${result.errorMessage}`);
    }
    
    // Interpretation
    console.log('\n💡 What this means:');
    console.log('─────────────────');
    
    switch (result.status) {
      case 'active':
        console.log('✅ User 22 can receive messages from the bot');
        break;
      case 'blocked':
        console.log('❌ User 22 has blocked the bot');
        break;
      case 'chat_deleted':
        console.log('❌ User 22 has deleted the chat with the bot');
        break;
      case 'deactivated':
        console.log('❌ User 22 has deactivated their Telegram account');
        break;
      case 'unknown_error':
        console.log('❓ Unknown error occurred while checking User 22');
        break;
    }
    
    console.log('\n📈 Getting overall statistics...');
    const stats = await getAccessibilityStatistics();
    
    console.log('\n📊 Overall Bot Statistics:');
    console.log('─────────────────────────');
    console.log(`Total Users: ${stats.total}`);
    console.log(`Active Users: ${stats.active} (${(stats.active/stats.total*100).toFixed(1)}%)`);
    console.log(`Blocked Users: ${stats.blocked}`);
    console.log(`Chat Deleted: ${stats.chatDeleted}`);
    console.log(`Deactivated: ${stats.deactivated}`);
    console.log(`Never Checked: ${stats.neverChecked}`);
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing User 22:', error.message);
    
    if (error.message.includes('User 22 not found')) {
      console.log('\n💡 User 22 does not exist in the database.');
      console.log('   This is normal if no user with ID 22 has used the bot yet.');
    }
  }
  
  // Force exit after completion
  console.log('\n🚪 Exiting...');
  process.exit(0);
}

// Set a timeout to force exit if test hangs
setTimeout(() => {
  console.log('\n⏰ Test timeout reached, forcing exit...');
  process.exit(1);
}, 30000); // 30 second timeout

testUser22(); 