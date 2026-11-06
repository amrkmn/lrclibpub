import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    buildSearchParams,
    getLyricsById,
    hasContent,
    isV2Unsupported,
    legacyItemToSummary,
    searchLyrics,
    v2ItemToSummary
} from '../src/lib/lrclib/search.ts';

describe('buildSearchParams', () => {
    it('q takes precedence over structured fields and trims whitespace', () => {
        const params = buildSearchParams({
            q: '  still alive  ',
            track_name: 'Song',
            artist_name: 'Artist',
            album_name: 'Album'
        });

        assert.equal(params.toString(), 'q=still+alive');
    });

    it('structured search sets track_name and optional fields with trimming', () => {
        const params = buildSearchParams({
            q: '   ',
            track_name: '  Song  ',
            artist_name: '  Artist  ',
            album_name: '  Album  '
        });

        assert.equal(params.get('track_name'), 'Song');
        assert.equal(params.get('artist_name'), 'Artist');
        assert.equal(params.get('album_name'), 'Album');
        assert.equal(params.has('q'), false);
    });

    it('structured search omits empty optional fields', () => {
        const params = buildSearchParams({
            track_name: 'Song',
            artist_name: '',
            album_name: '   '
        });

        assert.equal(params.get('track_name'), 'Song');
        assert.equal(params.has('artist_name'), false);
        assert.equal(params.has('album_name'), false);
    });

    it('empty search builds no params', () => {
        const params1 = buildSearchParams({});
        assert.equal(params1.toString(), '');

        const params2 = buildSearchParams({
            q: '   ',
            track_name: '   ',
            artist_name: 'Artist',
            album_name: 'Album'
        });

        assert.equal(params2.toString(), '');
    });
});

describe('hasContent', () => {
    it('checks for non-whitespace string', () => {
        assert.equal(hasContent('hello'), true);
        assert.equal(hasContent('   '), false);
        assert.equal(hasContent(''), false);
        assert.equal(hasContent(null), false);
        assert.equal(hasContent(undefined), false);
    });
});

describe('legacyItemToSummary', () => {
    it('maps legacy v1 search item to TrackSummary', () => {
        const item = {
            id: 7,
            name: 'Legacy Song',
            trackName: 'Legacy Song',
            artistName: 'Artist',
            albumName: 'Album',
            duration: 180,
            instrumental: false,
            hasWordSync: true,
            plainLyrics: 'line one\nline two',
            syncedLyrics: '[00:01.00] line one',
            lyricsfile: "version: '1.0'"
        };

        const summary = legacyItemToSummary(item);

        assert.deepEqual(summary, {
            id: 7,
            trackName: 'Legacy Song',
            artistName: 'Artist',
            albumName: 'Album',
            duration: 180,
            instrumental: false,
            hasWordSync: true,
            hasPlainLyrics: true,
            hasSyncedLyrics: true,
            hasLyricsfile: true,
            plainLyrics: 'line one\nline two',
            syncedLyrics: '[00:01.00] line one',
            lyricsfile: "version: '1.0'"
        });
    });

    it('uses name if trackName is missing and ignores empty lyrics', () => {
        const item = {
            id: 8,
            name: 'Name Only',
            artistName: 'Artist',
            albumName: 'Album',
            duration: 120,
            instrumental: false,
            plainLyrics: '   ',
            syncedLyrics: '',
            lyricsfile: null
        };

        const summary = legacyItemToSummary(item);

        assert.equal(summary.trackName, 'Name Only');
        assert.equal(summary.hasPlainLyrics, false);
        assert.equal(summary.hasSyncedLyrics, false);
        assert.equal(summary.hasLyricsfile, false);
        assert.equal(summary.plainLyrics, '   ');
        assert.equal(summary.syncedLyrics, '');
        assert.equal(summary.lyricsfile, null);
    });
});

describe('v2ItemToSummary', () => {
    it('maps v2 search item to TrackSummary', () => {
        const item = {
            id: 42,
            trackName: 'V2 Song',
            artistName: 'V2 Artist',
            albumName: 'V2 Album',
            duration: 200,
            instrumental: false,
            hasWordSync: true,
            hasPlainLyrics: true,
            hasSyncedLyrics: true,
            hasLyricsfile: false
        };

        const summary = v2ItemToSummary(item);

        assert.deepEqual(summary, {
            id: 42,
            trackName: 'V2 Song',
            artistName: 'V2 Artist',
            albumName: 'V2 Album',
            duration: 200,
            instrumental: false,
            hasWordSync: true,
            hasPlainLyrics: true,
            hasSyncedLyrics: true,
            hasLyricsfile: false
        });
    });
});

describe('isV2Unsupported', () => {
    it('returns true for 404, 405, 501, or invalid response', () => {
        assert.equal(isV2Unsupported(404), true);
        assert.equal(isV2Unsupported(405), true);
        assert.equal(isV2Unsupported(501), true);
        assert.equal(isV2Unsupported(200, true), true);
    });

    it('returns false for other status codes', () => {
        assert.equal(isV2Unsupported(400), false);
        assert.equal(isV2Unsupported(429), false);
        assert.equal(isV2Unsupported(500), false);
        assert.equal(isV2Unsupported(503), false);
        assert.equal(isV2Unsupported(200), false);
    });
});

describe('searchLyrics', () => {
    it('returns empty array when search query has no search terms without calling fetch', async () => {
        let called = false;

        const mockFetch = async () => {
            called = true;

            return new Response('[]', { status: 200 });
        };

        const results = await searchLyrics({}, { fetchFn: mockFetch });
        assert.equal(called, false);
        assert.deepEqual(results, []);
    });

    it('returns v2 results when v2 search succeeds', async () => {
        const urlsCalled = [];

        const mockFetch = async (url) => {
            urlsCalled.push(url.toString());

            return new Response(
                JSON.stringify([
                    {
                        id: 1,
                        trackName: 'Song 1',
                        artistName: 'Artist 1',
                        albumName: 'Album 1',
                        duration: 150,
                        instrumental: false,
                        hasWordSync: false,
                        hasPlainLyrics: true,
                        hasSyncedLyrics: true,
                        hasLyricsfile: true
                    }
                ]),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        };

        const results = await searchLyrics({ q: 'Song 1' }, { fetchFn: mockFetch });

        assert.equal(results.length, 1);
        assert.equal(results[0].trackName, 'Song 1');
        assert.equal(results[0].hasSyncedLyrics, true);
        assert.equal(urlsCalled.length, 1);
        assert.match(urlsCalled[0], /\/api\/v2\/search\?q=Song\+1/);
    });

    it('falls back to v1 when v2 endpoint returns 404', async () => {
        const urlsCalled = [];

        const mockFetch = async (url) => {
            urlsCalled.push(url.toString());

            if (url.toString().includes('/api/v2/search')) {
                return new Response('Route not found', { status: 404 });
            }

            return new Response(
                JSON.stringify([
                    {
                        id: 2,
                        name: 'Song 2',
                        trackName: 'Song 2',
                        artistName: 'Artist 2',
                        albumName: 'Album 2',
                        duration: 210,
                        instrumental: false,
                        hasWordSync: false,
                        plainLyrics: 'some plain lyrics',
                        syncedLyrics: null,
                        lyricsfile: null
                    }
                ]),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        };

        const results = await searchLyrics({ q: 'Song 2' }, { fetchFn: mockFetch });

        assert.equal(results.length, 1);
        assert.equal(results[0].trackName, 'Song 2');
        assert.equal(results[0].hasPlainLyrics, true);
        assert.equal(results[0].hasSyncedLyrics, false);
        assert.equal(urlsCalled.length, 2);
        assert.match(urlsCalled[0], /\/api\/v2\/search/);
        assert.match(urlsCalled[1], /\/api\/search/);
    });

    it('falls back to v1 when v2 endpoint returns invalid JSON', async () => {
        const urlsCalled = [];

        const mockFetch = async (url) => {
            urlsCalled.push(url.toString());

            if (url.toString().includes('/api/v2/search')) {
                return new Response('<html>Not found or bad gateway</html>', { status: 200 });
            }

            return new Response(
                JSON.stringify([
                    {
                        id: 3,
                        trackName: 'Song 3',
                        artistName: 'Artist 3',
                        instrumental: false,
                        syncedLyrics: '[00:01.00] hello'
                    }
                ]),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        };

        const results = await searchLyrics({ track_name: 'Song 3' }, { fetchFn: mockFetch });

        assert.equal(results.length, 1);
        assert.equal(results[0].trackName, 'Song 3');
        assert.equal(results[0].hasSyncedLyrics, true);
        assert.equal(urlsCalled.length, 2);
        assert.match(urlsCalled[0], /\/api\/v2\/search/);
        assert.match(urlsCalled[1], /\/api\/search/);
    });

    it('surfaces 429 rate limit errors without falling back to v1', async () => {
        const urlsCalled = [];

        const mockFetch = async (url) => {
            urlsCalled.push(url.toString());

            return new Response(
                JSON.stringify({
                    message: 'Too many requests',
                    name: 'RateLimitExceeded',
                    statusCode: 429
                }),
                { status: 429 }
            );
        };

        await assert.rejects(
            async () => {
                await searchLyrics({ q: 'hello' }, { fetchFn: mockFetch });
            },
            {
                message: 'Too many requests'
            }
        );

        assert.equal(urlsCalled.length, 1);
        assert.match(urlsCalled[0], /\/api\/v2\/search/);
    });

    it('surfaces 503 server overloaded errors without falling back to v1', async () => {
        const urlsCalled = [];

        const mockFetch = async (url) => {
            urlsCalled.push(url.toString());

            return new Response(
                JSON.stringify({
                    message: 'Server overloaded',
                    name: 'ServerOverloaded',
                    statusCode: 503
                }),
                { status: 503 }
            );
        };

        await assert.rejects(
            async () => {
                await searchLyrics({ q: 'hello' }, { fetchFn: mockFetch });
            },
            {
                message: 'Server overloaded'
            }
        );

        assert.equal(urlsCalled.length, 1);
    });
});

describe('getLyricsById', () => {
    it('fetches track by id with correct endpoint and client header', async () => {
        let headersSent;
        let urlCalled;

        const mockFetch = async (url, init) => {
            urlCalled = url.toString();
            headersSent = init.headers;

            return new Response(
                JSON.stringify({
                    id: 123,
                    trackName: 'Test Song',
                    artistName: 'Test Artist',
                    instrumental: false,
                    plainLyrics: 'Some lyrics'
                }),
                { status: 200 }
            );
        };

        const lyrics = await getLyricsById(123, {
            fetchFn: mockFetch,
            clientUserAgent: 'TestAgent'
        });

        assert.equal(lyrics.id, 123);
        assert.equal(lyrics.trackName, 'Test Song');
        assert.equal(urlCalled, 'https://lrclib.net/api/get/123');
        assert.equal(headersSent['Lrclib-Client'], 'TestAgent');
    });

    it('throws error when track is not found', async () => {
        const mockFetch = async () => {
            return new Response(
                JSON.stringify({
                    message: 'Failed to find specified track',
                    name: 'TrackNotFound',
                    statusCode: 404
                }),
                { status: 404 }
            );
        };

        await assert.rejects(
            async () => {
                await getLyricsById(999, { fetchFn: mockFetch });
            },
            {
                message: 'Failed to find specified track'
            }
        );
    });
});
