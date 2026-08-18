/**
 * lib/metadata/resolve.js
 * Validates and normalizes an incoming { id, type } request before any
 * upstream call is made. Never guesses type from id shape — type is required.
 */

export class InvalidRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidRequestError';
    this.status = 400;
  }
}

const VALID_TYPES = new Set(['movie', 'tv', 'anime']);
const IMDB_ID_RE = /^tt\d+$/;
const NUMERIC_RE = /^\d+$/;

/**
 * @param {{ id: string, type: string }} params
 * @returns {{ id: string, type: string }} normalized request
 * @throws {InvalidRequestError}
 */
export function resolveRequest({ id, type }) {
  if (!id || typeof id !== 'string') {
    throw new InvalidRequestError('id is required');
  }
  if (!type || !VALID_TYPES.has(type)) {
    throw new InvalidRequestError('type must be one of "movie", "tv", "anime"');
  }

  if (type === 'movie' || type === 'tv') {
    if (!IMDB_ID_RE.test(id)) {
      throw new InvalidRequestError(`id "${id}" is not a valid IMDb id for type "${type}"`);
    }
    return { id, type };
  }

  // type === 'anime'
  const stripped = id.startsWith('anime-') ? id.slice('anime-'.length) : id;
  if (!NUMERIC_RE.test(stripped)) {
    throw new InvalidRequestError(`id "${id}" is not a valid MAL/AniList id for type "anime"`);
  }
  return { id: stripped, type: 'anime' };
}
