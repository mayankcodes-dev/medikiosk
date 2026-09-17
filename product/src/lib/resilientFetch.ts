/**
 * Resilient fetch wrapper with retry, timeout, and exponential backoff.
 * Designed for unreliable hospital WiFi / mobile data conditions.
 */
export async function resilientFetch(
  url: string,
  options: RequestInit,
  { retries = 2, timeoutMs = 20000, backoffMs = 1500 } = {}
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Retry on 5xx server errors or 429 rate limit
      if ((res.status >= 500 || res.status === 429) && attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
        continue;
      }

      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on user abort
      if (lastError.name === "AbortError" && options.signal?.aborted) throw lastError;

      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
      }
    }
  }

  throw lastError ?? new Error("Network request failed");
}
