import axios, { AxiosRequestConfig, AxiosError } from 'axios';
import https from 'https';

/**
 * SmartFetch - Centralized API Gateway for Criptodamus
 * 
 * Features:
 * 1. Request Deduplication: Prevents cache stampedes.
 * 2. Rate Limiting: Enforces minimum delay between requests.
 * 3. Auto-Retry: Exponential backoff for transient errors.
 * 4. IPv4 Force: Fixes connection issues (Render/Cloud).
 * 5. Proactive Proxy (Bifrost): Routes Binance requests through proxy.
 * 6. Circuit Breaker: Automatically disables Proxy for 5 minutes if it fails.
 */
export class SmartFetch {
    private static pendingRequests = new Map<string, Promise<any>>();
    private static lastRequestTime = new Map<string, number>();
    private static MIN_DELAY_PER_DOMAIN = 2000;



    // IPv4 Agent
    private static ipv4Agent = new https.Agent({ family: 4 });

    /**
     * Smart GET request
     */
    public static async get<T>(url: string, config: AxiosRequestConfig = {}, retries = 3): Promise<T> {
        // 1. Deduplication
        const dedupKey = `GET:${url}`;
        if (this.pendingRequests.has(dedupKey)) {
            return this.pendingRequests.get(dedupKey) as Promise<T>;
        }

        const requestPromise = this.executeRequest<T>(url, config, retries);
        this.pendingRequests.set(dedupKey, requestPromise);

        requestPromise.finally(() => {
            this.pendingRequests.delete(dedupKey);
        }).catch(() => { });

        return requestPromise;
    }

    private static async executeRequest<T>(url: string, config: AxiosRequestConfig, retriesLeft: number): Promise<T> {
        const domain = new URL(url).hostname;

        // 2. Rate Limiting
        await this.enforceRateLimit(domain);

        // --- STEALTH HEADERS ---
        const stealthHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': config.headers?.Accept || 'application/json, text/plain, */*',
            ...config.headers
        };

        try {
            const response = await axios.get<T>(url, {
                ...config,
                headers: stealthHeaders,
                httpsAgent: this.ipv4Agent,
                timeout: config.timeout || 12000
            });

            this.lastRequestTime.set(domain, Date.now());
            return response.data;
        } catch (error: any) {

            // C. General Retry Logic
            const shouldRetry = this.isRetryableError(error) && retriesLeft > 0;
            if (shouldRetry) {
                const attempt = 3 - retriesLeft + 1;
                const delay = 1000 * Math.pow(2, attempt); // Exponential Backoff
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
            await new Promise(r => setTimeout(r, this.MIN_DELAY_PER_DOMAIN - elapsed));
        }
    }

    private static isRetryableError(error: any): boolean {
        if (['ETIMEDOUT', 'ECONNABORTED', 'ENETUNREACH', 'ECONNRESET'].includes(error.code)) return true;
        if (error.response) {
            const status = error.response.status;
            return status === 429 || status >= 500;
        }
        return false;
    }
}
