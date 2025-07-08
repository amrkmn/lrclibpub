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
