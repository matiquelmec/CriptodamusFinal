
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

console.log("🔍 TESTING GEMINI MODELS");
console.log("========================================");

const KEY = process.env.GEMINI_API_KEY;

async function testModel(modelName: string, version: string = 'v1beta') {
    const url = `https://generativelanguage.googleapis.com/${version}/models/${modelName}:generateContent?key=${KEY}`;

    console.log(`\n Testing Model: ${modelName} (${version})`);

    try {
        const payload = {
            contents: [{ parts: [{ text: "Hello, confirm this model is working." }] }]
        };
        const res = await axios.post(url, payload);
        console.log(`✅ SUCCESS: ${res.data.candidates[0].content.parts[0].text.substring(0, 50)}...`);
        return true;
    } catch (e: any) {
        if (e.response) {
            console.log(`❌ FAILED: Status ${e.response.status}`);
            console.log(`   Error: ${JSON.stringify(e.response.data.error, null, 2)}`);
        } else {
            console.log(`❌ FAILED: ${e.message}`);
        }
        return false;
    }
}

async function run() {
    await testModel('gemini-1.5-flash', 'v1beta');
    await testModel('gemini-1.5-flash-latest', 'v1beta');
    await testModel('gemini-pro', 'v1beta');
    // Also try v1
    await testModel('gemini-pro', 'v1');
}

run();
