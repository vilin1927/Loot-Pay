const { db } = require('./dist/database/connection.js');

async function checkTransactions() {
  try {
    console.log('🔍 Checking transaction statuses...');
    
    // Check user l1patoff (telegram_id: 6142891306)
    const user = await db('users').where('telegram_id', '6142891306').first();
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log(`✅ User found: ID ${user.id}, Username: ${user.telegram_username}`);
    
    // Get ALL transactions for this user (not just completed)
    const allTransactions = await db('transactions')
      .where('user_id', user.id)
      .orderBy('created_at', 'desc');
    
    console.log(`📊 Total transactions: ${allTransactions.length}`);
    
    allTransactions.forEach((tx, i) => {
      console.log(`${i+1}. ID: ${tx.id}, Status: ${tx.status}, Amount: ${tx.amount_usd} USD, Steam: ${tx.steam_username}, Created: ${tx.created_at}`);
    });
    
    // Test the getUserTransactions function (only completed)
    const completedTxs = await db('transactions')
      .where('user_id', user.id)
      .where('status', 'completed')
      .orderBy('created_at', 'desc');
    
    console.log(`\n✅ Completed transactions: ${completedTxs.length}`);
    completedTxs.forEach((tx, i) => {
      console.log(`${i+1}. ID: ${tx.id}, Status: ${tx.status}, Amount: ${tx.amount_usd} USD`);
    });
    
    // Check what the function would return
    if (completedTxs.length === 0) {
      console.log('\n❌ ISSUE FOUND: No completed transactions found!');
      console.log('This is why "история пополнений" shows "Failed to load" message');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkTransactions(); 