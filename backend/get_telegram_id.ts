import TelegramBot from 'node-telegram-bot-api';

// Replace with your Token
const token = '8524882455:AAGghZYyLsfMD6Xo-I2qcOxxHbgT5Ucc4Kw';

const bot = new TelegramBot(token, { polling: true });

console.log("🤖 Bot de Telegram Iniciado en modo Escucha...");
console.log("👉 Por favor, abre tu bot en Telegram (t.me/Criptodamus_bot) y envíale un mensaje (ej: 'Hola').");
console.log("⏳ Esperando mensaje para capturar tu CHAT ID...");

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from?.first_name;
    console.log(`\n✅ MENSAJE RECIBIDO DE: ${user}`);
    console.log(`🆔 TU CHAT ID ES: ${chatId}`);
    console.log(`\nCopie este ID para usarlo en la configuración.\n`);

    bot.sendMessage(chatId, `¡Conectado! Tu Chat ID es: ${chatId}. El sistema Criptodamus ahora puede enviarte alertas.`);
    process.exit(0);
});
