
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

console.log("🔍 LISTING AVAILABLE GEMINI MODELS");
console.log("========================================");

const KEY = process.env.GEMINI_API_KEY;
const URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${KEY}`;

async function listModels() {
    try {
        const res = await axios.get(URL);
        const models = res.data.models;

        console.log(`✅ Found ${models.length} Models:`);
        models.forEach((m: any) => {
            console.log(`   - ${m.name}`);
        });

    } catch (e: any) {
        if (e.response) {
            console.log(`❌ FAILED: Status ${e.response.status}`);
            console.log(`   Error: ${JSON.stringify(e.response.data.error, null, 2)}`);
        } else {
            console.log(`❌ FAILED: ${e.message}`);
        }
    }
}

listModels();
