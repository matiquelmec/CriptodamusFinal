import { SmartFetch } from './core/services/SmartFetch';
import { RSS_SOURCES } from './utils/rssUtils';

async function testRSSStealth() {
    console.log("🚀 Starting RSS Stealth Audit...");

    // Target: CryptoSlate (Known Cloudflare source)
    const target = RSS_SOURCES.find(s => s.name === 'CryptoSlate');
    if (!target) {
        console.error("❌ CryptoSlate source not found in RSS_SOURCES");
        return;
    }

    console.log(`\n--- Testing ${target.name} ---`);
    console.log(`URL: ${target.url}`);

    try {
        // Just a simple call - SmartFetch should handle everything internally
        const xml = await SmartFetch.get<string>(target.url);

        if (xml.includes('<!DOCTYPE html>') || xml.includes('Just a moment...')) {
            console.error("❌ FAILURE: Cloudflare Challenge Detected (HTML returned instead of XML)");
            // console.log("Snippet:", xml.slice(0, 500));
        } else if (xml.includes('<rss') || xml.includes('<channel')) {
            console.log("✅ SUCCESS: Valid RSS XML received!");
            console.log("Item Count:", (xml.match(/<item/g) || []).length);
        } else {
            console.warn("⚠️ UNKNOWN RESPONSE: Not HTML, but not recognized RSS either.");
            console.log("Snippet:", xml.slice(0, 200));
        }
    } catch (error: any) {
        console.error("❌ ERROR during fetch:", error.message);
    }
}

testRSSStealth();
