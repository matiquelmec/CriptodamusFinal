import axios, { AxiosRequestConfig, AxiosError } from 'axios';
import https from 'https';

/**
 * SmartFetch - Centralized API Gateway for Criptodamus
 * 
 * Features:
 * 1. Request Deduplication: Prevents cache stampedes by sharing in-flight promises.
 * 2. Rate Limiting: Enforces minimum delay between requests to the same domain.
 * 3. Auto-Retry: Exponential backoff for 429/5xx and network errors.
 * 4. IPv4 Force: Fixes connection issues on some cloud providers (Render).
 * 5. Proactive Proxy (Bifrost): Automatically routes Binance requests through proxy if configured.
 */
export class SmartFetch {
    private static pendingRequests = new Map<string, Promise<any>>();
    private static lastRequestTime = new Map<string, number>();
    private static MIN_DELAY_PER_DOMAIN = 2000; // 2 seconds safety buffer

    // IPv4 Agent to avoid ENETUNREACH in some environments
    private static ipv4Agent = new https.Agent({ family: 4 });

    /**
     * Smart GET request
     */
    public static async get<T>(url: string, config: AxiosRequestConfig = {}, retries = 3): Promise<T> {
        // 1. Deduplication
        const dedupKey = `GET:${url}`;
        if (this.pendingRequests.has(dedupKey)) {
            // console.log(`[SmartFetch] Deduplicating request: ${url}`);
            return this.pendingRequests.get(dedupKey) as Promise<T>;
        }

        const requestPromise = this.executeRequest<T>(url, config, retries);

        // Store the promise
        this.pendingRequests.set(dedupKey, requestPromise);

        // Cleanup after completion (success or failure)
        requestPromise.finally(() => {
            this.pendingRequests.delete(dedupKey);
        }).catch(() => { }); // Prevent "Unhandled Rejection" from the finally promise chain

        return requestPromise;
    }

    private static async executeRequest<T>(url: string, config: AxiosRequestConfig, retriesLeft: number): Promise<T> {
        const domain = new URL(url).hostname;
        const isBinance = domain.includes('binance.com') || domain.includes('binance.vision');
        const isBifrost = process.env.BIFROST_URL && url.includes(process.env.BIFROST_URL);

        // 2. Rate Limiting (Domain Level)
        await this.enforceRateLimit(domain);

        // 2.5 PROACTIVE PROXY (Institutional Grade for Binance)
        if (isBinance && process.env.BIFROST_URL && !isBifrost) {
            const bifrostUrl = `${process.env.BIFROST_URL}/api?target=${encodeURIComponent(url)}`;
            return this.executeRequest<T>(bifrostUrl, config, retriesLeft);
        }

        // --- STEALTH HEADERS (ENGAGE) ---
        // Modern browsers send Client Hints to pass Cloudflare Challenges
        const stealthHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': config.headers?.Accept || 'application/json, text/plain, */*',
            'Sec-CH-UA': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-CH-UA-Mobile': '?0',
            'Sec-CH-UA-Platform': '"Windows"',
            'Sec-CH-UA-Full-Version': '120.0.6099.130',
            'Sec-CH-UA-Bitness': '"64"',
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Dest': 'document',
            'Accept-Language': 'en-US,en;q=0.9',
            ...config.headers
        };

        try {
            const response = await axios.get<T>(url, {
                ...config,
                headers: stealthHeaders,
                httpsAgent: this.ipv4Agent,
                timeout: config.timeout || 12000 // Increased for proxy/slow feeds
            });

            this.lastRequestTime.set(domain, Date.now());

            const contentType = response.headers['content-type']?.toString().toLowerCase();
            const body = response.data?.toString() || '';

            // Handle Cloudflare challenge detection
            const isCloudflare = body.includes('Just a moment...') || body.includes('cf-challenge') || body.includes('_cf_chl_opt');

            if (isCloudflare || (contentType && (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')))) {

                // If we are NOT already using Bifrost and it's available, ROTATE TO PROXY
                if (process.env.BIFROST_URL && !isBifrost && retriesLeft > 0) {
                    console.log(`⚠️ [SmartFetch] Bot Challenge/HTML detected at ${domain}. Rotating to Bifrost Proxy...`);
                    const bifrostUrl = `${process.env.BIFROST_URL}/api?target=${encodeURIComponent(url)}`;
                    return this.executeRequest<T>(bifrostUrl, config, retriesLeft - 1);
                }

                console.warn(`❌ [SmartFetch] Persistent HTML/Challenge detected for ${domain}. Refusing to parse.`);
                throw new Error(`BotBlock: Challenge received from ${domain}`);
            }

            return response.data;
        } catch (error: any) {
            // 2.7 Handle Bot Challenges in Catch Block (403 Forbidden with HTML)
            if (error.response?.status === 403) {
                const data = error.response?.data;
                const errorBody = typeof data === 'string' ? data : JSON.stringify(data || '');
                const isChallenge = errorBody.includes('Just a moment...') || errorBody.includes('cf-challenge');

                if (isChallenge && process.env.BIFROST_URL && !isBifrost && retriesLeft > 0) {
                    console.log(`⚠️ [SmartFetch] 403 Bot Challenge detected at ${domain}. Rotating to Bifrost Proxy...`);
                    const bifrostUrl = `${process.env.BIFROST_URL}/api?target=${encodeURIComponent(url)}`;
                    return this.executeRequest<T>(bifrostUrl, config, retriesLeft - 1);
                }
            }

            // 3. Retry Logic
            const shouldRetry = this.isRetryableError(error) && retriesLeft > 0;

            if (shouldRetry) {
                const attempt = 3 - retriesLeft + 1;
                const delay = 1000 * Math.pow(2, attempt);

                console.warn(`[SmartFetch] Fetch failed for ${domain} (${error.code || error.response?.status}). Retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));

                return this.executeRequest<T>(url, config, retriesLeft - 1);
            }

            throw error;
        }
    }

    private static async enforceRateLimit(domain: string) {
        const lastTime = this.lastRequestTime.get(domain) || 0;
        const now = Date.now();
        const elapsed = now - lastTime;

        if (elapsed < this.MIN_DELAY_PER_DOMAIN) {
            const waitTime = this.MIN_DELAY_PER_DOMAIN - elapsed;
            // console.log(`[SmartFetch] Throttling ${domain} for ${waitTime}ms`);
            await new Promise(r => setTimeout(r, waitTime));
        }
    }

    private static isRetryableError(error: any): boolean {
        // Network errors
        if (['ETIMEDOUT', 'ECONNABORTED', 'ENETUNREACH', 'ECONNRESET'].includes(error.code)) {
            return true;
        }
        // HTTP Statuses likely to be temporary
        if (error.response) {
            const status = error.response.status;
            return status === 429 || status >= 500;
        }
        return false;
    }
}
