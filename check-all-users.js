require('dotenv').config();
const { db } = require('./dist/database/connection');

async function checkAllUsers() {
  try {
    console.log('🔍 Checking all users and recent transactions...\n');
    
    // Get all users
    const users = await db('users')
      .orderBy('created_at', 'desc')
      .limit(10);
      
    console.log(`👥 Found ${users.length} recent users:\n`);
    
    for (const user of users) {
      console.log(`User ID: ${user.id}`);
      console.log(`Telegram ID: ${user.telegram_id}`);
      console.log(`Steam Username: ${user.steam_username || 'Not set'}`);
      console.log(`Created: ${user.created_at}`);
      console.log('---');
    }
    
    // Get recent transactions
    console.log('\n💰 Recent transactions:\n');
    const transactions = await db('transactions')
      .join('users', 'transactions.user_id', 'users.id')
      .select('transactions.*', 'users.steam_username', 'users.telegram_id')
      .orderBy('transactions.created_at', 'desc')
      .limit(10);
      
    for (const tx of transactions) {
      console.log(`Transaction ID: ${tx.id}`);
      console.log(`Order ID: ${tx.order_id}`);
      console.log(`Steam Username: ${tx.steam_username || 'Not set'}`);
      console.log(`Telegram ID: ${tx.telegram_id}`);
      console.log(`Amount: $${tx.amount_usd} USD (${tx.amount_rub} RUB)`);
      console.log(`Status: ${tx.status}`);
      console.log(`Created: ${tx.created_at}`);
      console.log(`PayDigital Data: ${tx.paydigital_response_data ? 'YES' : 'NO'}`);
      console.log('---');
    }
    
    // Look for any users with 'l1patoff' or similar
    const similarUsers = await db('users')
      .whereRaw("steam_username ILIKE '%l1patoff%' OR steam_username ILIKE '%patoff%'");
      
    if (similarUsers.length > 0) {
      console.log('\n🔍 Found users with similar steam usernames:');
      similarUsers.forEach(user => {
        console.log(`- ID ${user.id}: ${user.steam_username} (TG: ${user.telegram_id})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.destroy();
  }
}

checkAllUsers(); 