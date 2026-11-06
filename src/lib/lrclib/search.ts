import type { LyricResult, TrackSummary } from '../types.ts';

export const DEFAULT_USER_AGENT = 'LRCLIBpub v1.0.0 (https://github.com/amrkmn/lrclibpub)';

export const DEFAULT_LRCLIB_INSTANCE = 'https://lrclib.net';

export const SEARCH_V2_PATH = '/api/v2/search';

export const SEARCH_V1_PATH = '/api/search';

export const GET_PATH = '/api/get';

export interface SearchQuery {
    q?: string | null;
    track_name?: string | null;
    artist_name?: string | null;
    album_name?: string | null;
}

export interface LegacySearchItem {
    id: number;
    name?: string | null;
    trackName?: string | null;
    artistName?: string | null;
    albumName?: string | null;
    duration?: number | null;
    instrumental?: boolean;
    hasWordSync?: boolean;
    plainLyrics?: string | null;
    syncedLyrics?: string | null;
    lyricsfile?: string | null;
}

export interface V2SearchItem {
    id: number;
    trackName?: string | null;
    artistName?: string | null;
    albumName?: string | null;
    duration?: number | null;
    instrumental?: boolean;
    hasWordSync?: boolean;
    hasPlainLyrics?: boolean;
    hasSyncedLyrics?: boolean;
    hasLyricsfile?: boolean;
}

export interface SearchOptions {
    instance?: string;
    fetchFn?: typeof fetch;
    clientUserAgent?: string;
}

/**
 * Returns true if the string has non-whitespace content.
 */
export function hasContent(value?: string | null): boolean {
    return Boolean(value?.trim());
}

/**
 * Build URLSearchParams matching LRCGET's param logic:
 * - When `q` is non-empty, it is trimmed and sent alone (taking precedence).
 * - Otherwise, `track_name` is sent with trimmed `artist_name` and `album_name`.
 * - If neither `q` nor `track_name` is present, returns empty params.
 */
export function buildSearchParams(query: SearchQuery): URLSearchParams {
    const params = new URLSearchParams();

    const q = (query.q ?? '').trim();

    if (q) {
        params.append('q', q);

        return params;
    }

    const trackName = (query.track_name ?? '').trim();

    if (!trackName) {
        return params;
    }

    params.append('track_name', trackName);

    const artistName = (query.artist_name ?? '').trim();

    if (artistName) {
        params.append('artist_name', artistName);
    }

    const albumName = (query.album_name ?? '').trim();

    if (albumName) {
        params.append('album_name', albumName);
    }

    return params;
}

/**
 * Maps a v1 /api/search response item to TrackSummary.
 */
export function legacyItemToSummary(item: LegacySearchItem): TrackSummary {
    return {
        id: item.id,
        trackName: item.trackName || item.name || '',
        artistName: item.artistName || '',
        albumName: item.albumName ?? null,
        duration: item.duration ?? null,
        instrumental: Boolean(item.instrumental),
        hasWordSync: Boolean(item.hasWordSync),
        hasPlainLyrics: hasContent(item.plainLyrics),
        hasSyncedLyrics: hasContent(item.syncedLyrics),
        hasLyricsfile: hasContent(item.lyricsfile),
        plainLyrics: item.plainLyrics ?? null,
        syncedLyrics: item.syncedLyrics ?? null,
        lyricsfile: item.lyricsfile ?? null
    };
}

/**
 * Maps a v2 /api/v2/search response item to TrackSummary.
 */
export function v2ItemToSummary(item: V2SearchItem): TrackSummary {
    return {
        id: item.id,
        trackName: item.trackName || '',
        artistName: item.artistName || '',
        albumName: item.albumName ?? null,
        duration: item.duration ?? null,
        instrumental: Boolean(item.instrumental),
        hasWordSync: Boolean(item.hasWordSync),
        hasPlainLyrics: Boolean(item.hasPlainLyrics),
        hasSyncedLyrics: Boolean(item.hasSyncedLyrics),
        hasLyricsfile: Boolean(item.hasLyricsfile)
    };
}

/**
 * A v2 request is only worth retrying against v1 when the instance does not
 * serve the v2 route at all (e.g. 404, 405, 501, or invalid response).
 * Rate limits, overloads, validation, and network failures should surface to the caller
 * instead of doubling server load.
 */
export function isV2Unsupported(status: number, isInvalidResponse: boolean = false): boolean {
    if (isInvalidResponse) {
        return true;
    }

    return status === 404 || status === 405 || status === 501;
}

/**
 * Search for tracks using LRCLIB's v2 search endpoint, with v1 as fallback.
 */
export async function searchLyrics(
    query: SearchQuery,
    options: SearchOptions = {}
): Promise<TrackSummary[]> {
    const {
        instance = DEFAULT_LRCLIB_INSTANCE,
        fetchFn = fetch,
        clientUserAgent = DEFAULT_USER_AGENT
    } = options;

    const params = buildSearchParams(query);

    if (!params.toString()) {
        return [];
    }

    const headers = {
        'Lrclib-Client': clientUserAgent
    };

    let shouldFallbackToV1 = false;

    // Try v2 search first
    const v2Url = `${instance}${SEARCH_V2_PATH}?${params.toString()}`;

    try {
        const response = await fetchFn(v2Url, {
            method: 'GET',
            headers
        });

        if (response.ok) {
            try {
                const data = await response.json();

                if (Array.isArray(data)) {
                    return data.map(v2ItemToSummary);
                }

                shouldFallbackToV1 = true;
            } catch {
                shouldFallbackToV1 = true;
            }
        } else if (isV2Unsupported(response.status)) {
            shouldFallbackToV1 = true;
        } else {
            // Definite error from server (400, 429, 500, 503, etc.) - do not retry on v1
            const errorData = await response
                .json()
                .catch(() => ({ message: `Search failed: ${response.status}` }));

            throw new Error(errorData.message || `Search failed: ${response.status}`);
        }
    } catch (err) {
        if (!shouldFallbackToV1) {
            throw err;
        }
    }

    if (shouldFallbackToV1) {
        const v1Url = `${instance}${SEARCH_V1_PATH}?${params.toString()}`;

        const response = await fetchFn(v1Url, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            const errorData = await response
                .json()
                .catch(() => ({ message: `Search failed: ${response.status}` }));

            throw new Error(errorData.message || `Search failed: ${response.status}`);
        }

        const data: LegacySearchItem[] = await response.json();

        return Array.isArray(data) ? data.map(legacyItemToSummary) : [];
    }

    return [];
}

/**
 * Retrieve full lyrics record for a track by its LRCLIB ID.
 */
export async function getLyricsById(id: number, options: SearchOptions = {}): Promise<LyricResult> {
    const {
        instance = DEFAULT_LRCLIB_INSTANCE,
        fetchFn = fetch,
        clientUserAgent = DEFAULT_USER_AGENT
    } = options;

    const response = await fetchFn(`${instance}${GET_PATH}/${id}`, {
        method: 'GET',
        headers: {
            'Lrclib-Client': clientUserAgent
        }
    });

    if (!response.ok) {
        const errorData = await response
            .json()
            .catch(() => ({ message: `Failed to fetch lyrics: ${response.status}` }));

        throw new Error(errorData.message || `Failed to fetch lyrics: ${response.status}`);
    }

    return response.json();
}
