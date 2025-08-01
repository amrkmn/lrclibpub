export interface FormData {
    trackName: string;
    artistName: string;
    albumName: string;
    duration: string;
    plainLyrics: string;
    syncedLyrics: string;
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
    trackName: string;
    artistName: string;
    albumName?: string;
    duration?: number;
    plainLyrics?: string;
    syncedLyrics?: string;
    instrumental: boolean;
}
