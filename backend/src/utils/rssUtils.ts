import { SmartFetch } from '../core/services/SmartFetch';

export interface FeedItem {
    title: string;
    link: string;
    pubDate: string;
    source: string;
    content?: string;
}

export const RSS_SOURCES = [
    { name: 'Google News', url: 'https://news.google.com/rss/search?q=cryptocurrency+when:1d&hl=en-US&gl=US&ceid=US:en' },
    { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
    { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
    { name: 'The Block', url: 'https://www.theblock.co/rss' },
    { name: 'Decrypt', url: 'https://decrypt.co/feed' }
];

export async function fetchRSSFields(): Promise<FeedItem[]> {
    let allNews: FeedItem[] = [];

    // Process all feeds in parallel
    const feedPromises = RSS_SOURCES.map(async (source) => {
        try {
            // Fetch raw XML with browser headers to avoid 403/Cloudflare
            const xml = await SmartFetch.get<string>(source.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
                }
            });
            if (!xml) return [];

            const items: FeedItem[] = [];

            // Robust Regex for basic RSS items
            // Matches <item>...</item> content, handling newlines and attributes
            // Improved: [\s\S]*? lazy match for content
            const itemRegex = /<item[\s\S]*?>([\s\S]*?)<\/item>/gi;
            let match;

            while ((match = itemRegex.exec(xml)) !== null) {
                const itemContent = match[1];

                // Extract fields safely (Case insensitive, handles attributes)
                const title = extractTag(itemContent, 'title');
                const link = extractTag(itemContent, 'link');
                const pubDate = extractTag(itemContent, 'pubDate');

                // Google News often puts the source in <source url="...">Name</source>
                const sourceTag = extractTag(itemContent, 'source');
                const finalSource = sourceTag || source.name;

                if (title && link) {
                    items.push({
                        title: decodeHtmlEntities(title),
                        link: link,
                        pubDate: pubDate || new Date().toISOString(),
                        source: finalSource,
                        content: ''
                    });
                }
            }

            return items;
        } catch (error) {
            console.warn(`[RSS] Failed to fetch ${source.name}:`, error);
            return [];
        }
    });

    const results = await Promise.all(feedPromises);
    results.forEach(items => allNews.push(...items));

    // Sort by date result
    return allNews.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
}

// Helper to extract content between <tag>...</tag>
// Improved: Handles attributes like <link href="..."> or <title>...
function extractTag(xml: string, tag: string): string | null {
    // 1. Try standard <tag>Value</tag> (or <tag attr="...">Value</tag>)
    // Improved: [\s\S]*? matches newlines (dotAll equivalent)
    // DOUBLE ESCAPE backslashes for string constructor!
    const regex = new RegExp(`<${tag}[^>]*>(?:\\s*<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>\\s*)?<\\/${tag}>`, 'i');
    let match = regex.exec(xml);
    if (match) return match[1].trim();

    // 2. Special case for <link> in Atom or some RSS which might be self-closing <link href="..." />
    // simple extraction for href if body is empty? RSS 2.0 usually has body.
    return null;
}

function decodeHtmlEntities(text: string): string {
    return text.replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

export async function fetchRedditPosts(subreddit: string = 'CryptoCurrency'): Promise<FeedItem[]> {
    try {
        const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=10`;
        // Reddit requires a User-Agent to avoid 429
        const data = await SmartFetch.get<any>(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CriptodamusBot/1.0)' }
        });

        if (data && data.data && data.data.children) {
            return data.data.children
                .filter((post: any) => !post.data.stickied) // Skip pinned posts
                .map((post: any) => ({
                    title: `[Reddit] ${post.data.title}`,
                    link: `https://www.reddit.com${post.data.permalink}`,
                    pubDate: new Date(post.data.created_utc * 1000).toISOString(),
                    source: `r/${subreddit}`,
                    content: `Upvotes: ${post.data.ups} | Comments: ${post.data.num_comments}`
                }));
        }
    } catch (error) {
        // console.warn(`[Reddit] Failed to fetch r/${subreddit}:`, error);
        // Silent fail for reddit to avoid noise if blocked
    }
    return [];
}
