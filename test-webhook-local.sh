#!/bin/bash

echo "🚀 Starting LootPay Webhook Test Suite"
echo "======================================="

# Check if server is running
if ! curl -s http://localhost:3000/webhook > /dev/null 2>&1; then
    echo "⚠️  Server not running on port 3000"
    echo "🔧 Starting development server..."
    
    # Start server in background
    npm run dev &
    SERVER_PID=$!
    
    # Wait for server to start
    echo "⏳ Waiting for server to start..."
    sleep 5
    
    # Check if server started successfully
    if curl -s http://localhost:3000/webhook > /dev/null 2>&1; then
        echo "✅ Server started successfully!"
    else
        echo "❌ Failed to start server"
        exit 1
    fi
else
    echo "✅ Server already running on port 3000"
fi

echo ""
echo "🧪 Running webhook tests..."
echo ""

# Set environment variable for testing
export PAYDIGITAL_WEBHOOK_SECRET="test_secret_123"

# Run the webhook test
node test-paydigital-webhook.js

echo ""
echo "🏁 Test completed!"

# If we started the server, offer to stop it
if [ ! -z "$SERVER_PID" ]; then
    echo ""
    read -p "🛑 Stop the development server? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill $SERVER_PID
        echo "✅ Server stopped"
    else
        echo "ℹ️  Server still running (PID: $SERVER_PID)"
        echo "   To stop: kill $SERVER_PID"
    fi
fi 