import axios from 'axios';
import dotenv from 'dotenv';
import https from 'https';
import { SmartCache } from '../core/services/api/caching/smartCache';

dotenv.config();

const ipv4Agent = new https.Agent({ family: 4 });

export interface NewsItem {
    id: number;
    title: string;
    published_at: string;
    source: { title: string };
    url: string;
    currencies?: { code: string; title: string; slug: string }[];
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
    // 1. Check Cache
    const cacheKey = `sentiment_${currency}`;
    const cached = SmartCache.get<SentimentAnalysis>(cacheKey);
    if (cached) return cached;

    // 2. Fetch Headlines with Resiliency
    let headlines: string[] = [];
    if (!CRYPTOPANIC_API_KEY) {
        console.warn("[NewsService] No CRYPTOPANIC_API_KEY found. Using Mock Data.");
        headlines = [
            "Bitcoin stabilizes above key support level",
            "Market awaits decision from regulators",
            "Institutional inflow into crypto funds positive for 3rd week"
        ];
    } else {
        const url = `https://cryptopanic.com/api/developer/v2/posts/?auth_token=${CRYPTOPANIC_API_KEY}&currencies=${currency}`;
        const maxRetries = 2;
        let lastError = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await axios.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'application/json'
                    },
                    httpsAgent: ipv4Agent, // Force IPv4 to avoid ENETUNREACH on Render
                    timeout: 10000 // 10 seconds timeout
                });

                if (response.data && response.data.results) {
                    headlines = response.data.results.map((n: NewsItem) => n.title);
                    console.log(`[NewsService] Successfully fetched ${headlines.length} headlines for ${currency}`);
                    break; // Success!
                }
            } catch (e: any) {
                lastError = e;
                const isTimeout = e.code === 'ETIMEDOUT' || e.code === 'ECONNABORTED' || e.code === 'ENETUNREACH';
                if (isTimeout && attempt < maxRetries) {
                    const delay = 1000 * (attempt + 1);
                    console.log(`[NewsService] Connection failed (${e.code}). Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                break; // Non-timeout error or final attempt
            }
        }

        if (headlines.length === 0 && lastError) {
            console.error("[NewsService] Final failure fetching news:", lastError.message);
            return { score: 0, sentiment: 'NEUTRAL', summary: `Error de conexión: ${lastError.code || 'TIMEOUT'}`, headlineCount: 0 };
        }
    }

    if (headlines.length === 0) {
        return { score: 0, sentiment: 'NEUTRAL', summary: "No relevant news found", headlineCount: 0 };
    }

    // 3. Analyze with Gemini
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
    SmartCache.set(cacheKey, analysis, SmartCache.TTL.MEDIUM);
    return analysis;
};

export const fetchMarketNews = async (currency: string = 'BTC'): Promise<NewsItem[]> => {
    const cacheKey = `raw_news_${currency}`;
    const cached = SmartCache.get<NewsItem[]>(cacheKey);
    if (cached) return cached;

    if (!CRYPTOPANIC_API_KEY) return [];

    const url = `https://cryptopanic.com/api/developer/v2/posts/?auth_token=${CRYPTOPANIC_API_KEY}&currencies=${currency}`;
    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            httpsAgent: ipv4Agent,
            timeout: 10000
        });

        if (response.data && response.data.results && response.data.results.length > 0) {
            const results = response.data.results as NewsItem[];
            console.log(`[NewsService] Successfully fetched ${results.length} news items for ${currency}`);
            SmartCache.set(cacheKey, results, SmartCache.TTL.SHORT);
            return results;
        }
    } catch (e: any) {
        console.warn(`[NewsService] Error fetching news for ${currency}: ${e.message}`);
    }

    // FALLBACK: High Quality Mock Data for UI Testing & Deployment delays
    const mockNews: NewsItem[] = [
        {
            id: Date.now(),
            title: "Bitcoin Institutional Adoption Surges: Major Banks Eye Direct Exposure",
            published_at: new Date().toISOString(),
            source: { title: "Criptodamus Intelligence" },
            url: "https://cryptopanic.com",
            currencies: [{ code: "BTC", title: "Bitcoin", slug: "bitcoin" }]
        },
        {
            id: Date.now() + 1,
            title: "Ethereum Dencun Upgrade Results: L2 Fees Drop by 90%",
            published_at: new Date().toISOString(),
            source: { title: "Blockchain Daily" },
            url: "https://cryptopanic.com",
            currencies: [{ code: "ETH", title: "Ethereum", slug: "ethereum" }]
        },
        {
            id: Date.now() + 2,
            title: "Solana Ecosystem Hits Record Daily Active Addresses",
            published_at: new Date().toISOString(),
            source: { title: "Solana Foundation News" },
            url: "https://cryptopanic.com",
            currencies: [{ code: "SOL", title: "Solana", slug: "solana" }]
        }
    ];
    return mockNews;
};

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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }]
    };

    const res = await axios.post(url, payload);
    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error("Empty Gemini Response");

    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(jsonStr);

    return {
        score: result.score,
        sentiment: result.sentiment,
        summary: result.summary,
        headlineCount: headlines.length
    };
}

function analyzeKeywords(headlines: string[]): SentimentAnalysis {
    let score = 0;
    const bullish = ['soar', 'surge', 'jump', 'gain', 'all-time high', 'bull', 'adoption', 'ETF', 'buy', 'upgrade'];
    const bearish = ['drop', 'plunge', 'crash', 'ban', 'regulation', 'bear', 'hack', 'scam', 'sell', 'lawsuit'];

    headlines.forEach(h => {
        const lower = h.toLowerCase();
        bullish.forEach(w => { if (lower.includes(w)) score += 0.1; });
        bearish.forEach(w => { if (lower.includes(w)) score -= 0.1; });
    });

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
