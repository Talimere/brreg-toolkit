export interface RetryOptions {
  /** Maximum number of retries (not including the initial attempt) */
  retries?: number
  /** Initial delay before first retry */
  baseDelayMs?: number
  /** Exponential multiplier */
  backoffFactor?: number
  /** Optional jitter (adds 0–baseDelayMs random ms) */
  jitter?: boolean
  /** Called before each retry */
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void
  /** Custom delay calculator; if provided, overrides baseDelay/backoff/jitter */
  getDelay?: (attempt: number) => number
  /** Custom sleeper (use a no-op in tests) */
  sleepFn?: (ms: number) => Promise<void>
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    retries = 3,
    baseDelayMs = 300,
    backoffFactor = 2,
    jitter = false,
    onRetry,
    getDelay,
    sleepFn = defaultSleep,
  } = options

  let attempt = 0
  let lastError: unknown

  while (attempt <= retries) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt === retries) break

      let delay = getDelay
        ? getDelay(attempt)
        : baseDelayMs * Math.pow(backoffFactor, attempt)

      if (jitter && !getDelay) {
        delay += Math.floor(Math.random() * baseDelayMs)
      }

      onRetry?.(attempt + 1, delay, err)
      await sleepFn(Math.max(0, delay))
      attempt++
    }
  }

  throw lastError
}

function defaultSleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
