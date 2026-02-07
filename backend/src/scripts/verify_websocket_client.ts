import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3001/ws';

console.log(`🔌 Connecting to ${WS_URL}...`);
const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('✅ Connected to Criptodamus Backend');

    // Subscribe just to trigger activity (though snapshot should come immediately)
    ws.send(JSON.stringify({ type: 'subscribe', symbols: ['BTCUSDT'] }));
});

ws.on('message', (data) => {
    try {
        const msg = JSON.parse(data.toString());
        console.log(`📩 Received Message: [${msg.type}]`);

        if (msg.type === 'ai_opportunities') {
            console.log("🚀 SUCCESS: Received AI Opportunities payload!");
            console.log(`   Count: ${msg.data.length}`);
            if (msg.data.length > 0) {
                console.log(`   First Opportunity: ${msg.data[0].symbol} (${msg.data[0].strategy})`);
            }
            process.exit(0); // Success
        } else if (msg.type === 'snapshot') {
            console.log("📸 Received Snapshot");
            if (msg.data.ai_opportunities) {
                console.log("   -> Contains AI Opportunities (cached)");
                process.exit(0);
            }
        }
    } catch (e) {
        console.error("Error parsing message", e);
    }
});

ws.on('error', (err) => {
    console.error("❌ WebSocket Error:", err);
    process.exit(1);
});

// Timeout
setTimeout(() => {
    console.log("⏱️ Timeout: No AI Data received in 60s");
    process.exit(1);
}, 60000);
