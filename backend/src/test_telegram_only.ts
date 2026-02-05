import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
dotenv.config();

const TOKEN = '8524882455:AAGghZYyLsfMD6Xo-I2qcOxxHbgT5Ucc4Kw';
const CHAT_ID = '6463158372';

console.log("--------------- TELEGRAM DEBUG ---------------");
console.log(`Token: ${TOKEN.substring(0, 10)}...`);
console.log(`Chat ID: ${CHAT_ID}`);

async function test() {
    const bot = new TelegramBot(TOKEN, { polling: false });
    try {
        console.log("Attemping to send message...");
        const res = await bot.sendMessage(CHAT_ID, "🔔 <b>TEST DE CONEXIÓN</b>\nSi lees esto, el bot funciona.", { parse_mode: 'HTML' });
        console.log("✅ Message Sent Successfully!");
        console.log("Message ID:", res.message_id);
    } catch (e: any) {
        console.error("❌ FAILED TO SEND:");
        console.error("Code:", e.code);
        console.error("Message:", e.message);
        if (e.response) {
            console.error("Response Body:", e.response.body);
        }
    }
}

test();
