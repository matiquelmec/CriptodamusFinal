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

        // 2. Rate Limiting (Domain Level)
        await this.enforceRateLimit(domain);

        try {
            const response = await axios.get<T>(url, {
                ...config,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json',
                    ...config.headers
                },
                httpsAgent: this.ipv4Agent,
                timeout: config.timeout || 10000
            });

            // Update last request time for this domain
            this.lastRequestTime.set(domain, Date.now());

            return response.data;
        } catch (error: any) {
            // 2.5 Geo-Block Evasion (451) -> Switch to Binance US
            if (error.response?.status === 451 && url.includes('api.binance.com')) {
                const newUrl = url.replace('api.binance.com', 'api.binance.us');
                console.warn(`[SmartFetch] 🌍 Geo-Blocked (451). Rerouting to Binance US: ${newUrl}`);
                return this.executeRequest<T>(newUrl, config, retriesLeft);
            }

            // 3. Retry Logic
            const shouldRetry = this.isRetryableError(error) && retriesLeft > 0;

            if (shouldRetry) {
                const attempt = 3 - retriesLeft + 1;
                const delay = 1000 * Math.pow(2, attempt); // 2s, 4s, 8s...

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
