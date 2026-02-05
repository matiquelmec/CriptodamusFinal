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

    // CIRCUIT BREAKER STATE
    private static isBifrostHealthy = true;
    private static bifrostCooldownUntil = 0;
    private static CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000; // 5 Minutes

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
        const isBinance = domain.includes('binance.com') || domain.includes('binance.vision');
        const isForex = domain.includes('forexfactory.com');
        const isBifrostTarget = process.env.BIFROST_URL && url.includes(process.env.BIFROST_URL);

        // 2. Rate Limiting
        await this.enforceRateLimit(domain);

        // 2.5 PROACTIVE PROXY SELECTION (Smart Routing)
        // Check Circuit Breaker Status
        if (!this.isBifrostHealthy && Date.now() > this.bifrostCooldownUntil) {
            console.log(`[SmartFetch] 🔄 Circuit Breaker Cooldown Over. Retrying Bifrost...`);
            this.isBifrostHealthy = true; // Half-Open State (Try once)
        }

        const useProxy = (isBinance || isForex) &&
            process.env.BIFROST_URL &&
            !isBifrostTarget &&
            !config.headers?.['X-Bypass-Proxy'] &&
            this.isBifrostHealthy;

        if (useProxy) {
            const bifrostUrl = `${process.env.BIFROST_URL}/api?target=${encodeURIComponent(url)}`;
            return this.executeRequest<T>(bifrostUrl, config, retriesLeft);
        }

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

            // --- FAILOVER LOGIC ---

            // A. Handle Proxy Failure (Trip Circuit Breaker)
            if (isBifrostTarget) {
                const status = error.response?.status;
                if (status === 404 || status >= 500 || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                    console.warn(`[SmartFetch] 🛡️ Proxy Failed (${status || error.code}). Tripping Circuit Breaker (5m)...`);

                    // Trip the Breaker
                    this.isBifrostHealthy = false;
                    this.bifrostCooldownUntil = Date.now() + this.CIRCUIT_BREAKER_COOLDOWN_MS;

                    // Fallback to Direct Connection immediately
                    try {
                        const originalUrl = decodeURIComponent(url.split('target=')[1]);
                        return this.executeRequest<T>(originalUrl, {
                            ...config,
                            headers: { ...config.headers, 'X-Bypass-Proxy': 'true' }
                        }, retriesLeft);
                    } catch (e) { }
                }
            }

            // B. Handle 403 Forbidden (Rotate TO Proxy if healthy)
            if (error.response?.status === 403 && !isBifrostTarget && process.env.BIFROST_URL && this.isBifrostHealthy) {
                console.log(`⚠️ [SmartFetch] 403 Challenge at ${domain}. Rotating to Bifrost Proxy...`);
                const bifrostUrl = `${process.env.BIFROST_URL}/api?target=${encodeURIComponent(url)}`;
                return this.executeRequest<T>(bifrostUrl, config, retriesLeft - 1);
            }

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
