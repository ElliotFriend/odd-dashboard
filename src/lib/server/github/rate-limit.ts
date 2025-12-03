/**
 * Rate limit information from GitHub API response headers
 */
export interface RateLimitInfo {
    limit: number;
    remaining: number;
    reset: number; // Unix timestamp when the rate limit resets
}

/**
 * Extract rate limit information from GitHub API response headers
 */
export function extractRateLimit(headers: any): RateLimitInfo | null {
    const limit = headers['x-ratelimit-limit'];
    const remaining = headers['x-ratelimit-remaining'];
    const reset = headers['x-ratelimit-reset'];

    if (limit && remaining !== undefined && reset) {
        return {
            limit: parseInt(limit, 10),
            remaining: parseInt(remaining, 10),
            reset: parseInt(reset, 10),
        };
    }

    return null;
}

/**
 * Check if we've hit the rate limit
 */
export function isRateLimited(rateLimit: RateLimitInfo | null): boolean {
    if (!rateLimit) {
        return false;
    }
    return rateLimit.remaining === 0;
}

/**
 * Calculate milliseconds until rate limit resets
 */
export function getRateLimitResetDelay(rateLimit: RateLimitInfo): number {
    const now = Math.floor(Date.now() / 1000);
    const delaySeconds = Math.max(0, rateLimit.reset - now);
    return delaySeconds * 1000; // Convert to milliseconds
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry configuration
 */
export interface RetryConfig {
    maxRetries?: number; // Maximum number of retries (default: 3)
    initialDelay?: number; // Initial delay in milliseconds (default: 1000)
    maxDelay?: number; // Maximum delay in milliseconds (default: 30000)
    backoffMultiplier?: number; // Exponential backoff multiplier (default: 2)
    retryableStatusCodes?: number[]; // HTTP status codes to retry (default: [429, 500, 502, 503, 504])
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryableStatusCodes: [429, 500, 502, 503, 504],
};

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(fn: () => Promise<T>, config: RetryConfig = {}): Promise<T> {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError: any;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;

            // Check if this is a retryable error
            const statusCode = error.status || error.response?.status;
            const isRetryable = statusCode && retryConfig.retryableStatusCodes.includes(statusCode);

            // Don't retry if we've exhausted retries or error is not retryable
            if (attempt >= retryConfig.maxRetries || !isRetryable) {
                throw error;
            }

            // Calculate delay with exponential backoff
            const delay = Math.min(
                retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attempt),
                retryConfig.maxDelay,
            );

            // For rate limit errors (429), check if we have reset time info
            if (statusCode === 429) {
                const rateLimit = extractRateLimit(error.response?.headers || {});
                if (rateLimit) {
                    const resetDelay = getRateLimitResetDelay(rateLimit);
                    if (resetDelay > 0) {
                        console.log(
                            `Rate limit hit. Waiting ${Math.ceil(resetDelay / 1000)}s until reset...`,
                        );
                        await sleep(resetDelay);
                        continue;
                    }
                }
            }

            console.log(
                `Retry attempt ${attempt + 1}/${retryConfig.maxRetries} after ${delay}ms...`,
            );
            await sleep(delay);
        }
    }

    throw lastError;
}

/**
 * Request queue for throttling GitHub API requests
 */
class RequestQueue {
    private queue: Array<{
        fn: () => Promise<any>;
        resolve: (value: any) => void;
        reject: (error: any) => void;
    }> = [];
    private processing = false;
    private minDelay: number; // Minimum delay between requests in milliseconds

    constructor(minDelay: number = 100) {
        this.minDelay = minDelay;
    }

    /**
     * Add a request to the queue
     */
    async enqueue<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            this.process();
        });
    }

    /**
     * Process the queue
     */
    private async process(): Promise<void> {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;

        while (this.queue.length > 0) {
            const { fn, resolve, reject } = this.queue.shift()!;

            try {
                const result = await fn();
                resolve(result);
            } catch (error) {
                reject(error);
            }

            // Wait before processing next request
            if (this.queue.length > 0) {
                await sleep(this.minDelay);
            }
        }

        this.processing = false;
    }

    /**
     * Get queue length
     */
    get length(): number {
        return this.queue.length;
    }
}

// Global request queue instance
let globalRequestQueue: RequestQueue | null = null;

/**
 * Get or create the global request queue
 */
export function getRequestQueue(minDelay: number = 100): RequestQueue {
    if (!globalRequestQueue) {
        globalRequestQueue = new RequestQueue(minDelay);
    }
    return globalRequestQueue;
}

/**
 * Execute a function with rate limiting and retry logic
 */
export async function withRateLimitAndRetry<T>(
    fn: () => Promise<T>,
    options: {
        retryConfig?: RetryConfig;
        queue?: RequestQueue;
    } = {},
): Promise<T> {
    const queue = options.queue || getRequestQueue();

    // First, queue the request to throttle
    const queuedFn = async () => {
        return await queue.enqueue(fn);
    };

    // Then, wrap with retry logic
    return await withRetry(queuedFn, options.retryConfig);
}
