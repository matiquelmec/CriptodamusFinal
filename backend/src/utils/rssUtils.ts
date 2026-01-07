import { SmartFetch } from '../core/services/SmartFetch';

export interface FeedItem {
    title: string;
    link: string;
    pubDate: string;
    source: string;
    content?: string;
}

export const RSS_SOURCES = [
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
            // Fetch raw XML
            const xml = await SmartFetch.get<string>(source.url);
            if (!xml) return [];

            const items: FeedItem[] = [];

            // Robust Regex for basic RSS items
            // Matches <item>...</item> content
            const itemRegex = /<item(?:\s+[^>]*)?>([\s\S]*?)<\/item>/gi;
            let match;

            while ((match = itemRegex.exec(xml)) !== null) {
                const itemContent = match[1];

                // Extract fields safely
                const title = extractTag(itemContent, 'title');
                const link = extractTag(itemContent, 'link');
                const pubDate = extractTag(itemContent, 'pubDate');
                // const description = extractTag(itemContent, 'description'); // Optional

                if (title && link) {
                    items.push({
                        title: decodeHtmlEntities(title),
                        link: link,
                        pubDate: pubDate || new Date().toISOString(),
                        source: source.name,
                        content: '' // Description often has HTML, skip for now to be clean
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
function extractTag(xml: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}[^>]*>(?:\s*<!\[CDATA\[)?(.*?)(?:\]\]>\s*)?<\/${tag}>`, 'i');
    const match = regex.exec(xml);
    return match ? match[1].trim() : null;
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
