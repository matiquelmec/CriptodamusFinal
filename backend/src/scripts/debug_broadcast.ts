import TelegramBot from 'node-telegram-bot-api';

// HARDCODED CREDENTIALS FROM CONFIG (Verification Purpose Only)
const TOKEN = '8524882455:AAGghZYyLsfMD6Xo-I2qcOxxHbgT5Ucc4Kw';
const CHAT_ID = '6463158372';

async function runDirectDrill() {
    console.log("📢 [Broadcast Drill] Testing Raw Telegram Credentials...");
    console.log(`   - Token: ${TOKEN.substring(0, 10)}...`);
    console.log(`   - Chat ID: ${CHAT_ID}`);

    const bot = new TelegramBot(TOKEN, { polling: false });

    try {
        console.log("🚀 Sending Test Message...");
        await bot.sendMessage(CHAT_ID, "🧪 <b>TEST: Criptodamus Broadcast System Check</b>\n\nSi lees esto, las credenciales son VÁLIDAS.", { parse_mode: 'HTML' });
        console.log("✅ Message SENT successfully. Credentials are valid.");
    } catch (error: any) {
        console.error("❌ Message FAILED:", error.message);
        if (error.response) {
            console.error("   Response Body:", error.response.body);
        }
    }
}

runDirectDrill();
