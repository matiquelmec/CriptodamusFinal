import axios from 'axios';
import dotenv from 'dotenv';
import { SmartFetch } from './core/services/SmartFetch';

dotenv.config();

async function diagnoseRSSFailure() {
    console.log("🔍 Starting Deep RSS Diagnostics...");
    console.log(`BIFROST_URL: ${process.env.BIFROST_URL}`);

    // 1. Check Proxy Health
    if (process.env.BIFROST_URL) {
        try {
            console.log("\n📡 Step 1: Pinging Bifrost Proxy...");
            const res = await axios.get(`${process.env.BIFROST_URL}/health`, { timeout: 5000 });
            console.log(`✅ Proxy is ALIVE: ${res.status} ${JSON.stringify(res.data)}`);
        } catch (e: any) {
            console.error(`❌ Proxy is DEAD or UNREACHABLE: ${e.message}`);
        }
    } else {
        console.warn("⚠️ BIFROST_URL is not set in .env");
    }

    // 2. Direct vs Proxy Test for CryptoSlate
    const url = 'https://cryptoslate.com/feed/';

    console.log("\n🛡️ Step 2: Testing CryptoSlate Access...");

    try {
        // This will trigger the SmartFetch logic (Direct -> Stealth -> Proxy)
        const xml = await SmartFetch.get<string>(url);

        if (xml.includes('<!DOCTYPE html>') || xml.includes('Just a moment...')) {
            console.error("❌ FAILURE: Still receiving Cloudflare Challenge HTML.");
            // console.log("First 200 chars:", xml.slice(0, 200));
        } else {
            console.log("✅ SUCCESS: Successfully bypassed Cloudflare.");
            console.log(`Snippet: ${xml.slice(0, 100).replace(/\n/g, ' ')}...`);
        }
    } catch (e: any) {
        console.error(`❌ FATAL ERROR: ${e.message}`);
        if (e.response) {
            console.error(`Status: ${e.response.status}`);
            // console.error(`Data Snippet: ${e.response.data.slice(0, 200)}`);
        }
    }
}

diagnoseRSSFailure();
