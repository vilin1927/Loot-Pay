require('dotenv').config();
const { db } = require('./dist/database/connection');

async function checkTransaction27() {
  try {
    console.log('🔍 Checking Transaction ID 27...\n');
    
    // Get transaction 27 with user details
    const transaction = await db('transactions')
      .join('users', 'transactions.user_id', 'users.id')
      .select('transactions.*', 'users.steam_username', 'users.telegram_id')
      .where('transactions.id', 27)
      .first();
      
    if (!transaction) {
      console.log('❌ Transaction ID 27 not found');
      return;
    }
    
    console.log('💰 Transaction 27 Details:');
    console.log(`Order ID: ${transaction.order_id}`);
    console.log(`User ID: ${transaction.user_id}`);
    console.log(`Telegram ID: ${transaction.telegram_id}`);
    console.log(`Steam Username: ${transaction.steam_username || 'Not set'}`);
    console.log(`Amount: $${transaction.amount_usd} USD`);
    console.log(`Amount RUB: ${transaction.amount_rub} RUB`);
    console.log(`Commission: ${transaction.commission_rub} RUB`);
    console.log(`Status: ${transaction.status}`);
    console.log(`Created: ${transaction.created_at}`);
    console.log(`Updated: ${transaction.updated_at}`);
    console.log(`Payment URL: ${transaction.payment_url || 'Not set'}`);
    
    console.log('\n📋 PayDigital Data:');
    if (transaction.paydigital_response_data) {
      try {
        const data = JSON.parse(transaction.paydigital_response_data);
        console.log('✅ PayDigital Response Found:');
        console.log(JSON.stringify(data, null, 2));
      } catch (e) {
        console.log(`Raw PayDigital Data: ${transaction.paydigital_response_data}`);
      }
    } else {
      console.log('❌ No PayDigital webhook data received yet');
    }
    
    console.log('\n🔍 Analysis:');
    if (transaction.status === 'pending') {
      console.log('⏳ Transaction is still PENDING');
      console.log('   - PayDigital may still send webhook');
      console.log('   - Or webhook might have been rejected due to IP/security');
    } else if (transaction.status === 'completed') {
      console.log('✅ Transaction is COMPLETED');
      console.log('   - Webhook was successfully received and processed');
    } else if (transaction.status === 'failed') {
      console.log('❌ Transaction FAILED');
      console.log('   - Check if webhook indicated failure');
    }
    
    if (!transaction.paydigital_response_data) {
      console.log('\n🚨 POSSIBLE WEBHOOK ISSUES:');
      console.log('1. PayDigital not configured to send webhooks to our URL');
      console.log('2. Webhook sent but rejected due to IP validation (not from 62.76.102.182)');
      console.log('3. Webhook sent but hash validation failed');
      console.log('4. PayDigital webhook pending/delayed');
      console.log('\n💡 Check Railway logs for:');
      console.log(`   - "Webhook received" with order_uuid: "${transaction.order_id}"`);
      console.log('   - "Unauthorized webhook IP" errors');
      console.log('   - "Invalid webhook signature" errors');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await db.destroy();
  }
}

checkTransaction27(); 