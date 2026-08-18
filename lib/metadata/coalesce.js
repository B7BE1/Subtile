/**
 * lib/metadata/coalesce.js
 * Deduplicates concurrent requests for the same cache key within this
 * invocation's lifetime. If two callers ask for the same uncached id at
 * nearly the same time, the second one awaits the first's in-flight promise
 * instead of triggering a duplicate upstream call.
 */

const inFlight = new Map(); // key -> Promise

/**
 * @param {string} key
 * @param {() => Promise<any>} fetchFn
 * @returns {Promise<any>}
 */
export function coalesce(key, fetchFn) {
  if (inFlight.has(key)) {
    return inFlight.get(key);
  }
  const promise = Promise.resolve()
    .then(fetchFn)
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, promise);
  return promise;
}
