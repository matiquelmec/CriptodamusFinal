import WebSocket from 'ws';

console.log('--- 🩸 LIQUIDATION STREAM DEBUGGER ---');

const ws = new WebSocket('wss://fstream.binance.com/ws');

ws.on('open', () => {
    console.log('✅ Connected to Binance Futures.');
    const subscribeMsg = {
        method: "SUBSCRIBE",
        params: ["!forceOrder@arr"],
        id: 1
    };
    ws.send(JSON.stringify(subscribeMsg));
    console.log('📡 Subscribed to !forceOrder@arr');
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.e === 'forceOrder') {
        const o = msg.o;
        console.log(`🔥 [LIQ] ${o.s} ${o.S} | Price: ${o.ap} | Qty: ${o.q} | Value: ${parseFloat(o.ap) * parseFloat(o.q)} USD`);
    } else {
        console.log('📩 Message received:', msg.result !== undefined ? 'Subscription Confirm' : msg.e || msg);
    }
});

ws.on('error', (err) => {
    console.error('❌ WebSocket Error:', err.message);
});

ws.on('close', () => {
    console.log('🔌 Connection closed.');
});

// Run for 30 seconds
setTimeout(() => {
    console.log('⏱️ Debug finished.');
    ws.close();
    process.exit(0);
}, 30000);
