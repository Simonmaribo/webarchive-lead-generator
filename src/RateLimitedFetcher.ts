export interface RateLimiterConfig {
    maxRequestsPerMinute: number;
    retryAttempts: number;
    retryDelay: number;  // in milliseconds
}

export class RateLimitedFetcher {
    private requestTimestamps: number[] = [];
    private config: RateLimiterConfig;

    constructor(config?: Partial<RateLimiterConfig>) {
        this.config = {
            maxRequestsPerMinute: 15,
            retryAttempts: 3,
            retryDelay: 5000,
            ...config
        };
    }

    private async waitForRateLimit(): Promise<void> {
        // Clean up old timestamps
        const oneMinuteAgo = Date.now() - 60000;
        this.requestTimestamps = this.requestTimestamps.filter(timestamp => timestamp > oneMinuteAgo);

        // Check if we're at the rate limit
        if (this.requestTimestamps.length >= this.config.maxRequestsPerMinute) {
            const oldestTimestamp = this.requestTimestamps[0];
            const waitTime = 60000 - (Date.now() - oldestTimestamp);
            if (waitTime > 0) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    private calculateBackoff(attempt: number): number {
        return this.config.retryDelay * Math.pow(2, attempt);
    }

    private async handleRateLimitResponse(response: Response): Promise<void> {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : this.config.retryDelay;
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    async fetch(url: string, options: RequestInit = {}): Promise<Response> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
            try {
                // Wait if we're at rate limit
                await this.waitForRateLimit();

                // Add timestamp before making request
                this.requestTimestamps.push(Date.now());

                const response = await fetch(url, options);

                if (response.status === 429) {
                    await this.handleRateLimitResponse(response);
                    continue;
                }

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                return response;
            } catch (error) {
                lastError = error as Error;
                console.warn(`Attempt ${attempt + 1} failed for ${url}:`, error);

                if (attempt < this.config.retryAttempts - 1) {
                    const backoffTime = this.calculateBackoff(attempt);
                    console.info(`Waiting ${backoffTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, backoffTime));
                }
            }
        }

        throw lastError || new Error(`Failed to fetch ${url} after ${this.config.retryAttempts} attempts`);
    }

    async fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
        const response = await this.fetch(url, options);
        return response.json();
    }

    async fetchText(url: string, options: RequestInit = {}): Promise<string> {
        const response = await this.fetch(url, options);
        return response.text();
    }
}