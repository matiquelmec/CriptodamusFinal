import axios from 'axios';
import dotenv from 'dotenv';
import { SmartCache } from '../core/services/api/caching/smartCache';
import { SmartFetch } from '../core/services/SmartFetch';
import { fetchRSSFields, fetchRedditPosts, FeedItem } from '../utils/rssUtils';

dotenv.config();

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

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export const fetchCryptoSentiment = async (currency: string = 'BTC'): Promise<SentimentAnalysis> => {
    // 1. Check Cache
    const cacheKey = `sentiment_hybrid_${currency}`;
    const cached = SmartCache.get<SentimentAnalysis>(cacheKey);
    if (cached) return cached;

    // 2. Fetch Hybrid Data (RSS + Reddit)
    let headlines: string[] = [];

    try {
        const [rssNews, redditPosts] = await Promise.all([
            fetchRSSFields(),
            fetchRedditPosts('CryptoCurrency')
        ]);

        // Combine and filter relevant headlines
        const combined = [...rssNews, ...redditPosts];

        // Simple keyword filter for specific currency if not BTC (which is general market)
        const relevant = currency === 'BTC'
            ? combined
            : combined.filter(item =>
                item.title.toLowerCase().includes(currency.toLowerCase()) ||
                item.content?.toLowerCase().includes(currency.toLowerCase())
            );

        headlines = relevant.slice(0, 15).map(n => n.title); // Analyze top 15
        console.log(`[NewsEngine] Analyzed ${headlines.length} items for ${currency} sentiment.`);

    } catch (e) {
        console.error("[NewsEngine] Failed to aggregate data:", e);
    }

    if (headlines.length === 0) {
        // Fallback to fear and greed if absolutely no data (network down)
        try {
            return await fetchFearAndGreedIndex();
        } catch {
            return { score: 0, sentiment: 'NEUTRAL', summary: "Market data unavailable.", headlineCount: 0 };
        }
    }

    // 3. Analyze with Gemini
    if (GEMINI_API_KEY) {
        try {
            const analysis = await analyzeWithGemini(headlines, currency);
            // Cache result for 15 minutes
            SmartCache.set(cacheKey, analysis, 60 * 15);
            return analysis;
        } catch (e) {
            console.warn("[NewsEngine] Gemini Analysis Failed.", e);
        }
    }

    // Fallback to F&G
    return await fetchFearAndGreedIndex();
};

export const fetchMarketNews = async (currency: string = 'BTC'): Promise<NewsItem[]> => {
    const cacheKey = `hybrid_news_${currency}`;
    const cached = SmartCache.get<NewsItem[]>(cacheKey);
    if (cached) return cached;

    try {
        const rssNews = await fetchRSSFields();
        const redditPosts = await fetchRedditPosts('CryptoCurrency');

        // Transform to standard NewsItem format
        let allItems: NewsItem[] = [...rssNews, ...redditPosts].map((item, index) => ({
            id: Date.now() + index,
            title: item.title,
            published_at: item.pubDate,
            source: { title: item.source },
            url: item.link,
            currencies: [] // We don't have explicit tags from RSS, but that's okay
        }));

        // Filter
        if (currency !== 'ALL' && currency !== 'BTC') {
            allItems = allItems.filter(item =>
                item.title.toLowerCase().includes(currency.toLowerCase())
            );
        }

        // Sort by newest
        allItems.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

        // Cache for 5 minutes
        SmartCache.set(cacheKey, allItems, 300);
        return allItems;

    } catch (e: any) {
        console.error(`[NewsEngine] Error fetching news: ${e.message}`);
        return [];
    }
};

// --- HELPERS ---

async function fetchFearAndGreedIndex(): Promise<SentimentAnalysis> {
    try {
        const url = 'https://api.alternative.me/fng/?limit=1';
        const data = await SmartFetch.get<any>(url);

        if (data && data.data && data.data.length > 0) {
            const value = parseInt(data.data[0].value);
            const classification = data.data[0].value_classification;
            const normalizedScore = (value - 50) / 50;

            let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
            if (value > 60) sentiment = 'BULLISH';
            if (value < 40) sentiment = 'BEARISH';

            return {
                score: normalizedScore,
                sentiment: sentiment,
                summary: `Fear & Greed Index: ${value} (${classification})`,
                headlineCount: 0
            };
        }
    } catch (e) {
        console.error("[NewsService] F&G Fetch Failed", e);
    }
    return { score: 0, sentiment: 'NEUTRAL', summary: "Unavailable", headlineCount: 0 };
}

async function analyzeWithGemini(headlines: string[], currency: string): Promise<SentimentAnalysis> {
    const prompt = `
    You are an expert crypto market sentiment analyst. 
    Analyze these latest headlines/posts for ${currency} and determine the overall market mood.
    
    Data Source:
    ${headlines.map(h => `- ${h}`).join('\n')}

    Return JSON ONLY:
    {
        "score": number, // -1.0 (Panic) to 1.0 (Euphoria)
        "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
        "summary": "Concise 1-sentence market summary based on these specific headlines."
    }
    `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;

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
