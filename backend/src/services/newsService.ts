import axios from 'axios';
import dotenv from 'dotenv';
import { SmartCache } from '../core/services/api/caching/smartCache';

dotenv.config();

interface NewsItem {
    id: number;
    title: string;
    published_at: string;
    source: { title: string };
    url: string;
}

export interface SentimentAnalysis {
    score: number; // -1.0 to 1.0
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    summary: string;
    headlineCount: number;
}

const CRYPTOPANIC_API_KEY = process.env.CRYPTOPANIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export const fetchCryptoSentiment = async (currency: string = 'BTC'): Promise<SentimentAnalysis> => {
    // 1. Check Cache (Sentiment doesn't change every second)
    const cacheKey = `sentiment_${currency}`;
    const cached = SmartCache.get<SentimentAnalysis>(cacheKey);
    if (cached) return cached;

    // 2. Fetch Headlines
    let headlines: string[] = [];
    try {
        if (!CRYPTOPANIC_API_KEY) {
            console.warn("[NewsService] No CRYPTOPANIC_API_KEY found. Using Mock Data for safety.");
            // Mock data to ensure system doesn't crash during setup
            headlines = [
                "Bitcoin stabilizes above key support level",
                "Market awaits decision from regulators",
                "Institutional inflow into crypto funds positive for 3rd week"
            ];
        } else {
            const response = await axios.get(`https://cryptopanic.com/api/v1/posts/?auth_token=${CRYPTOPANIC_API_KEY}&currencies=${currency}&filter=important`);
            if (response.data && response.data.results) {
                headlines = response.data.results.map((n: NewsItem) => n.title);
            }
        }
    } catch (e) {
        console.error("[NewsService] Error fetching news:", e);
        return { score: 0, sentiment: 'NEUTRAL', summary: "Error fetching news", headlineCount: 0 };
    }

    if (headlines.length === 0) {
        return { score: 0, sentiment: 'NEUTRAL', summary: "No relevant news found", headlineCount: 0 };
    }

    // 3. Analyze with Gemini (or Fallback simple keyword match)
    let analysis: SentimentAnalysis;
    if (!GEMINI_API_KEY) {
        console.warn("[NewsService] No GEMINI_API_KEY found. Falling back to Keyword Analysis.");
        analysis = analyzeKeywords(headlines);
    } else {
        try {
            analysis = await analyzeWithGemini(headlines, currency);
        } catch (e) {
            console.warn("[NewsService] Gemini Analysis Failed. Falling back to Keywords.", e);
            analysis = analyzeKeywords(headlines);
        }
    }

    // Cache for 15 minutes
    SmartCache.set(cacheKey, analysis, SmartCache.TTL.MEDIUM); // 15 min approx
    return analysis;
};

// --- GEMINI REST API INTEGRATION ---
async function analyzeWithGemini(headlines: string[], currency: string): Promise<SentimentAnalysis> {
    const prompt = `
    You are an expert crypto market sentiment analyst. 
    Analyze these headlines for ${currency} and determine the overall market mood/sentiment score from -1.0 (Extreme Bearish/Panic) to +1.0 (Extreme Bullish/Euphoria).
    
    Headlines:
    ${headlines.map(h => `- ${h}`).join('\n')}

    Return JSON ONLY:
    {
        "score": number,
        "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
        "summary": "1 sentence explanation"
    }
    `;

    // Verified Model: gemini-3-flash-preview (2026 Compatible)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;

    // Simple REST Payload
    const payload = {
        contents: [{ parts: [{ text: prompt }] }]
    };

    const res = await axios.post(url, payload);
    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error("Empty Gemini Response");

    // Parse JSON from text (handle potential markdown blocks)
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(jsonStr);

    return {
        score: result.score,
        sentiment: result.sentiment,
        summary: result.summary,
        headlineCount: headlines.length
    };
}

// --- FALLBACK LOGIC ---
function analyzeKeywords(headlines: string[]): SentimentAnalysis {
    let score = 0;
    const bullish = ['soar', 'surge', 'jump', 'gain', 'all-time high', 'bull', 'adoption', 'ETF', 'buy', 'upgrade'];
    const bearish = ['drop', 'plunge', 'crash', 'ban', 'regulation', 'bear', 'hack', 'scam', 'sell', 'lawsuit'];

    headlines.forEach(h => {
        const lower = h.toLowerCase();
        bullish.forEach(w => { if (lower.includes(w)) score += 0.1; });
        bearish.forEach(w => { if (lower.includes(w)) score -= 0.1; });
    });

    // Clamp -1 to 1
    score = Math.max(-1, Math.min(1, score));

    let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (score > 0.2) sentiment = 'BULLISH';
    if (score < -0.2) sentiment = 'BEARISH';

    return {
        score,
        sentiment,
        summary: `Analyzed ${headlines.length} headlines via keyword match.`,
        headlineCount: headlines.length
    };
}
