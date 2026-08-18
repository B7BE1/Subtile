/**
 * lib/metadata/httpUtil.js
 * Shared fetch-with-timeout helper and typed errors for source modules.
 */

export const USER_AGENT = 'Subtile/1.0 (https://b7be.site)';

export class NotFoundError extends Error {
  constructor(source, id) {
    super(`${source}: not found (id=${id})`);
    this.name = 'NotFoundError';
    this.source = source;
  }
}

export class UpstreamError extends Error {
  constructor(source, message) {
    super(`${source}: ${message}`);
    this.name = 'UpstreamError';
    this.source = source;
  }
}

/**
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {number} [timeoutMs]
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, ...(options.headers || {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

export function logSourceError(source, err, id) {
  console.error(JSON.stringify({ source, id, error: err.message }));
}
