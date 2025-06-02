#!/bin/bash

echo "🛑 Stopping all LootPay bot instances..."

# Kill all node processes
killall node 2>/dev/null
killall ts-node 2>/dev/null
killall ts-node-dev 2>/dev/null

# Kill processes on specific ports
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null

# Clear the webhook
echo "🔄 Clearing Telegram webhook..."
curl -s -F "url=" https://api.telegram.org/bot7733706741:AAF18qUbqoKWPLzWECSQXsC3XkxKjeXPz5U/setWebhook

echo "✅ All bot instances stopped and webhook cleared!"
echo "You can now start the bot with: npm run dev"
