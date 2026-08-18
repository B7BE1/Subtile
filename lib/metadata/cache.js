/**
 * lib/metadata/cache.js
 * Cache layer for resolved metadata records, talking to Supabase via raw
 * REST calls — same pattern already used in api/upload.js. No SDK
 * dependency, since this project has no package.json/npm install step.
 *
 * Requires the metadata_cache table — see sql/schema.sql.
 * Requires env vars SUPABASE_URL and SUPABASE_SERVICE_KEY (falls back to
 * SUPABASE_ANON_KEY, matching upload.js's fallback behavior).
 */

const SCHEMA_VERSION = 'v2';

const TTL_SECONDS = {
  airing: 6 * 3600,
  upcoming: 2 * 3600,
  released: 30 * 24 * 3600,
  ended: 30 * 24 * 3600,
  not_found: 3600,
};

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return {
    url,
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  };
}

/**
 * @param {"movie"|"tv"|"anime"} type
 * @param {string} id
 * @returns {string}
 */
export function buildKey(type, id) {
  return `${SCHEMA_VERSION}:${type}:${id}`;
}

/**
 * @param {string} contentStatus
 * @returns {number} TTL in seconds
 */
export function ttlForStatus(contentStatus) {
  return TTL_SECONDS[contentStatus] || TTL_SECONDS.ended;
}

/**
 * @param {string} key
 * @returns {Promise<{ payload: object, stale: boolean, notFound: boolean } | null>}
 */
export async function getCached(key) {
  const cfg = getSupabaseConfig();
  if (!cfg) return null; // no Supabase configured — caller falls through to live fetch

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/metadata_cache?key=eq.${encodeURIComponent(key)}&select=*`,
      { headers: cfg.headers }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const row = rows[0];
    const stale = new Date(row.expires_at).getTime() < Date.now();

    if (row.not_found) {
      return { payload: null, stale, notFound: true };
    }

    // Read-repair: if the cached payload is missing a field the current
    // normalize stage would populate, treat it as stale so a refresh is
    // triggered rather than serving a silently incomplete record forever.
    const knownFields = ['id', 'type', 'title', 'content_status', 'sources'];
    const looksIncomplete = knownFields.some((f) => !(f in (row.payload || {})));

    return { payload: row.payload, stale: stale || looksIncomplete, notFound: false };
  } catch (err) {
    console.error(JSON.stringify({ source: 'cache', error: err.message, key }));
    return null;
  }
}

/**
 * @param {string} key
 * @param {object} payload normalized record
 * @param {number} ttlSeconds
 */
export async function setCached(key, payload, ttlSeconds) {
  const cfg = getSupabaseConfig();
  if (!cfg) return; // no Supabase configured — caching is a no-op

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  try {
    await fetch(`${cfg.url}/rest/v1/metadata_cache?on_conflict=key`, {
      method: 'POST',
      headers: { ...cfg.headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        key,
        type: payload.type,
        payload,
        content_status: payload.content_status,
        fetched_at: new Date().toISOString(),
        expires_at: expiresAt,
        not_found: false,
      }),
    });
  } catch (err) {
    console.error(JSON.stringify({ source: 'cache', error: err.message, key }));
  }
}

/**
 * @param {string} key
 * @param {"movie"|"tv"|"anime"} type
 */
export async function setNotFound(key, type) {
  const cfg = getSupabaseConfig();
  if (!cfg) return;

  const expiresAt = new Date(Date.now() + TTL_SECONDS.not_found * 1000).toISOString();
  try {
    await fetch(`${cfg.url}/rest/v1/metadata_cache?on_conflict=key`, {
      method: 'POST',
      headers: { ...cfg.headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        key,
        type,
        payload: null,
        content_status: null,
        fetched_at: new Date().toISOString(),
        expires_at: expiresAt,
        not_found: true,
      }),
    });
  } catch (err) {
    console.error(JSON.stringify({ source: 'cache', error: err.message, key }));
  }
}

/**
 * Tests to add: getCached returns null for a missing key; returns
 * stale:true when expires_at is in the past; returns stale:true when a
 * required field is absent from payload (read-repair path); setCached
 * posts the correct expires_at given ttlForStatus("airing") vs "ended".
 */
