export interface FormData {
    trackName: string;
    artistName: string;
    albumName: string;
    duration: string;
    plainLyrics: string;
    syncedLyrics: string;
    lyricsfile: string;
}

export interface Challenge {
    prefix: string;
    target: string;
}

export interface PublishResponse {
    code?: number;
    name?: string;
    message?: string;
}

export interface SearchParams {
    q?: string;
    track_name?: string;
    artist_name?: string;
    album_name?: string;
    duration?: number;
    page?: number;
}

export interface LyricResult {
    id: number;
    name?: string;
    trackName: string;
    artistName: string;
    albumName?: string;
    duration?: number;
    plainLyrics?: string;
    syncedLyrics?: string;
    lyricsfile?: string | null;
    instrumental: boolean;
    hasWordSync?: boolean;
}

export interface TrackSummary {
    id: number;
    trackName: string;
    artistName: string;
    albumName?: string | null;
    duration?: number | null;
    instrumental: boolean;
    hasWordSync: boolean;
    hasPlainLyrics: boolean;
    hasSyncedLyrics: boolean;
    hasLyricsfile: boolean;
    plainLyrics?: string | null;
    syncedLyrics?: string | null;
    lyricsfile?: string | null;
}

export const USER_AGENT = 'LRCLIBpub v1.0.0 (https://github.com/amrkmn/lrclibpub)';
