/**
 * lib/metadata/breaker.js
 * Per-source circuit breaker + a token-bucket rate limiter for Jikan.
 * State lives in module scope, so it only persists for the life of a single
 * serverless invocation/container reuse — a best-effort guard against
 * cascading failures within a burst, not a durable store.
 */

const FAILURE_THRESHOLD = 5;
const WINDOW_MS = 2 * 60 * 1000; // 2 minutes
const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes once tripped

const state = new Map(); // source -> { failures: number[], trippedUntil: number|null }

function getState(source) {
  if (!state.has(source)) {
    state.set(source, { failures: [], trippedUntil: null });
  }
  return state.get(source);
}

/**
 * @param {string} source
 * @returns {boolean} true if the breaker is currently open (skip this source)
 */
export function isOpen(source) {
  const s = getState(source);
  if (s.trippedUntil && Date.now() < s.trippedUntil) {
    return true;
  }
  if (s.trippedUntil && Date.now() >= s.trippedUntil) {
    s.trippedUntil = null;
    s.failures = [];
  }
  return false;
}

export function recordSuccess(source) {
  const s = getState(source);
  s.failures = [];
  s.trippedUntil = null;
}

export function recordFailure(source) {
  const s = getState(source);
  const now = Date.now();
  s.failures = s.failures.filter((t) => now - t < WINDOW_MS);
  s.failures.push(now);
  if (s.failures.length >= FAILURE_THRESHOLD) {
    s.trippedUntil = now + COOLDOWN_MS;
  }
}

/**
 * Simple token-bucket limiter: max `ratePerSec` tokens/sec, capped burst of
 * `maxPerMin` per rolling minute. acquire() resolves once a slot frees up.
 */
function createLimiter({ ratePerSec, maxPerMin }) {
  let tokens = ratePerSec;
  const minuteWindow = [];

  const refillTimer = setInterval(() => {
    tokens = Math.min(ratePerSec, tokens + ratePerSec);
  }, 1000);
  refillTimer.unref?.();

  async function acquire() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const now = Date.now();
      while (minuteWindow.length && now - minuteWindow[0] > 60000) {
        minuteWindow.shift();
      }
      if (tokens > 0 && minuteWindow.length < maxPerMin) {
        tokens -= 1;
        minuteWindow.push(now);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return { acquire };
}

export const jikanLimiter = createLimiter({ ratePerSec: 3, maxPerMin: 60 });

export class CircuitOpenError extends Error {
  constructor(source) {
    super(`Circuit breaker open for source: ${source}`);
    this.name = 'CircuitOpenError';
    this.source = source;
  }
}
