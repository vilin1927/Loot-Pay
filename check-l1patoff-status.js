require('dotenv').config();
const { db } = require('./dist/database/connection');

async function checkL1patoffStatus() {
  try {
    console.log('🔍 Checking l1patoff transaction status...\n');
    
    // Find l1patoff user
    const user = await db('users')
      .where('steam_username', 'l1patoff')
      .first();
      
    if (!user) {
      console.log('❌ User l1patoff not found');
      return;
    }
    
    console.log('👤 User found:', {
      id: user.id,
      telegram_id: user.telegram_id,
      steam_username: user.steam_username,
      created_at: user.created_at
    });
    
    // Get all transactions for this user
    const transactions = await db('transactions')
      .where('user_id', user.id)
      .orderBy('created_at', 'desc');
      
    console.log(`\n💰 Found ${transactions.length} transactions:\n`);
    
    for (const tx of transactions) {
      console.log(`Transaction ID: ${tx.id}`);
      console.log(`Order ID: ${tx.order_id}`);
      console.log(`Amount: $${tx.amount_usd} USD (${tx.amount_rub} RUB)`);
      console.log(`Status: ${tx.status}`);
      console.log(`Created: ${tx.created_at}`);
      console.log(`Updated: ${tx.updated_at}`);
      console.log(`PayDigital Data: ${tx.paydigital_response_data ? 'YES' : 'NO'}`);
      
      if (tx.paydigital_response_data) {
        try {
          const data = JSON.parse(tx.paydigital_response_data);
          console.log(`PayDigital Response:`, data);
        } catch (e) {
          console.log(`PayDigital Data (raw): ${tx.paydigital_response_data}`);
        }
      }
      
      console.log('---');
    }
    
    // Check if any failed webhook attempts might be in application logs
    console.log('\n🔍 To check for webhook attempts, review Railway logs for:');
    console.log('- "Webhook received" messages');
    console.log('- "Unauthorized webhook IP" errors'); 
    console.log('- "PayDigital webhook processing" messages');
    console.log('- Any IP addresses other than 62.76.102.182');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.destroy();
  }
}

checkL1patoffStatus(); 