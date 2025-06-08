const axios = require('axios');
const crypto = require('crypto');

// Configuration
let WEBHOOK_URL = 'http://localhost:3000/webhook'; // Change to your Railway URL for production testing
const WEBHOOK_SECRET = 'test_secret_123'; // Use your actual PAYDIGITAL_WEBHOOK_SECRET

/**
 * Generate PayDigital webhook hash
 */
function generateWebhookHash(orderUuid, secret = WEBHOOK_SECRET) {
  return crypto
    .createHash('sha256')
    .update(orderUuid + secret)
    .digest('hex');
}

/**
 * Test PayDigital webhook with exact format from documentation
 */
async function testPayDigitalWebhook() {
  console.log('🧪 Testing PayDigital Webhook Integration\n');
  
  // Test cases based on real PayDigital documentation
  const testCases = [
    {
      name: '✅ Successful Payment (Paid)',
      payload: {
        order_uuid: "LP-26", // Using real transaction ID from database (user l1patoff)
        sbp_id: "https://qr.nspk.ru/BD20004D4M68CH0J9BSB7R73N8QDDE3R?type=02&bank=100000000013&sum=8810&cur=RUB&crc=C06D",
        amount: 88.10, // Total amount with commission for $1 USD
        status: "Paid",
        paid_date_msk: "2025-06-08T18:30:00.000Z", // Moscow time
        order_id: "LP-26"
      }
    },
    {
      name: '⏳ Pending Payment',
      payload: {
        order_uuid: "LP-26",
        sbp_id: "https://qr.nspk.ru/BD20004D4M68CH0J9BSB7R73N8QDDE3R?type=02&bank=100000000013&sum=8810&cur=RUB&crc=C06D",
        amount: 88.10,
        status: "Pending",
        order_id: "LP-26"
      }
    },
    {
      name: '❌ Failed Payment',
      payload: {
        order_uuid: "LP-26",
        sbp_id: "https://qr.nspk.ru/BD20004D4M68CH0J9BSB7R73N8QDDE3R?type=02&bank=100000000013&sum=8810&cur=RUB&crc=C06D",
        amount: 88.10,
        status: "Failed",
        order_id: "LP-26"
      }
    },
    {
      name: '🔒 Invalid Hash (Security Test)',
      payload: {
        order_uuid: "LP-26",
        amount: 88.10,
        status: "Paid",
        hash: "invalid_hash_should_fail"
      }
    },
    {
      name: '❓ Transaction Not Found',
      payload: {
        order_uuid: "LP-999999", // Non-existent transaction
        amount: 100,
        status: "Paid"
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`🧪 ${testCase.name}`);
    console.log('📤 Payload:', JSON.stringify(testCase.payload, null, 2));
    
    try {
      // Generate hash if not provided (for security test, we skip this)
      if (!testCase.payload.hash) {
        testCase.payload.hash = generateWebhookHash(testCase.payload.order_uuid);
      }
      
      // Send webhook request with PayDigital format
      const response = await axios.post(WEBHOOK_URL, testCase.payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '62.76.102.182', // Simulate PayDigital IP
          'User-Agent': 'PayDigital-Webhook/1.0'
        },
        timeout: 10000
      });
      
      console.log(`✅ Response: ${response.status} ${response.statusText}`);
      console.log('📥 Response Body:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      if (error.response) {
        console.log(`❌ Error: ${error.response.status} ${error.response.statusText}`);
        console.log('📥 Error Body:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.log(`❌ Network Error: ${error.message}`);
      }
    }
    
    console.log('─'.repeat(60));
  }
}

/**
 * Test with production Railway URL
 */
async function testProductionWebhook() {
  console.log('\n🚀 Testing Production Webhook');
  console.log('📝 Update WEBHOOK_URL to your Railway domain and run again');
  console.log('Example: https://lootpay-production-xxxx.railway.app/webhook\n');
  
  // Uncomment and update this URL for production testing:
  // const PRODUCTION_URL = 'https://your-railway-app.railway.app/webhook';
  // await testWebhookEndpoint(PRODUCTION_URL);
}

/**
 * Generate sample webhook payloads for manual testing
 */
function generateSamplePayloads() {
  console.log('\n📋 Sample PayDigital Webhook Payloads:\n');
  
  const samples = [
    {
      name: 'Successful Payment',
      payload: {
        order_uuid: "LP-26",
        sbp_id: "https://qr.nspk.ru/BD20004D4M68CH0J9BSB7R73N8QDDE3R?type=02&bank=100000000013&sum=8810&cur=RUB&crc=C06D",
        amount: 88.10,
        status: "Paid",
        paid_date_msk: new Date().toISOString(),
        hash: generateWebhookHash("LP-26"),
        order_id: "LP-26"
      }
    }
  ];
  
  samples.forEach(sample => {
    console.log(`${sample.name}:`);
    console.log('```json');
    console.log(JSON.stringify(sample.payload, null, 2));
    console.log('```\n');
  });
}

// Main execution
async function main() {
  console.log('🎯 PayDigital Webhook Testing Suite');
  console.log('====================================\n');
  
  console.log('🔧 Configuration:');
  console.log(`Webhook URL: ${WEBHOOK_URL}`);
  console.log(`Webhook Secret: ${WEBHOOK_SECRET.substring(0, 8)}...`);
  console.log(`Test Hash: ${generateWebhookHash("LP-26").substring(0, 16)}...\n`);
  
  // Test local webhook
  await testPayDigitalWebhook();
  
  // Show production testing info
  await testProductionWebhook();
  
  // Generate sample payloads
  generateSamplePayloads();
  
  console.log('✅ Testing complete!');
  console.log('\n💡 Tips:');
  console.log('1. Start your local server: npm run dev');
  console.log('2. Update WEBHOOK_URL for production testing');
  console.log('3. Check your logs for webhook processing details');
  console.log('4. Verify database updates after successful webhooks');
}

// Handle command line arguments
if (process.argv[2] === '--production') {
  const productionUrl = process.argv[3];
  if (productionUrl) {
    WEBHOOK_URL = productionUrl;
    console.log(`Testing production URL: ${productionUrl}`);
  }
}

main().catch(console.error); 