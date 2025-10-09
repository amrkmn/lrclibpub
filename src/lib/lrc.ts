export interface ParsedLRC {
    title?: string;
    artist?: string;
    album?: string;
    duration?: string;
    syncedLyrics: string;
    plainLyrics: string;
}

export function parseLRCFile(content: string): ParsedLRC {
    const lines = content.split("\n");
    const metadata: Record<string, string> = {};
    const syncedLines: string[] = [];
    const plainLines: string[] = [];
    let duration = "";

    lines.forEach((line) => {
        line = line.replace(/\r$/, "").trim();
        if (!line) return;

        // Parse length
        const lengthMatch = line.match(/^\[length:\s*(\d{2}):(\d{2})\.(\d{2,3})\]$/);
        if (lengthMatch) {
            const [, minutes, seconds] = lengthMatch;
            duration = (parseInt(minutes) * 60 + parseInt(seconds)).toString();
            return;
        }

        // Parse metadata
        const metaMatch = line.match(/^\[(ti|ar|al):\s*(.+?)\]$/i);
        if (metaMatch) {
            const [, key, value] = metaMatch;
            metadata[key.toLowerCase()] = value.trim();
            return;
        }

        // Parse timed lyrics and convert to 2-digit ms format
        const timeMatch = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*?)$/);
        if (timeMatch) {
            const [, minutes, seconds, milliseconds, lyrics] = timeMatch;
            // Convert milliseconds to 2 digits
            const ms =
                milliseconds.length === 3
                    ? Math.round(parseInt(milliseconds) / 10)
                          .toString()
                          .padStart(2, "0")
                    : milliseconds;

            syncedLines.push(`[${minutes}:${seconds}.${ms}]${lyrics}`);
            plainLines.push(lyrics.trim());
        }
    });

    return {
        title: metadata["ti"],
        artist: metadata["ar"],
        album: metadata["al"],
        duration: duration,
        syncedLyrics: syncedLines.join("\n"),
        plainLyrics: plainLines.join("\n"),
    };
}

/**
 * Generate LRC format content from LyricResult data
 */
export function generateLRCContent(result: {
    trackName: string;
    artistName: string;
    albumName?: string;
    duration?: number;
    syncedLyrics?: string;
    plainLyrics?: string;
}): string {
    const lines: string[] = [];
    
    // Add metadata
    lines.push(`[ti:${result.trackName}]`);
    lines.push(`[ar:${result.artistName}]`);
    if (result.albumName) {
        lines.push(`[al:${result.albumName}]`);
    }
    if (result.duration) {
        const minutes = Math.floor(result.duration / 60);
        const seconds = Math.floor(result.duration % 60);
        lines.push(`[length:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`);
    }
    
    // Add offset (default to 0)
    lines.push(`[offset:0]`);
    
    // Add lyrics
    if (result.syncedLyrics) {
        // Use synced lyrics if available
        lines.push('');
        lines.push(result.syncedLyrics);
    } else if (result.plainLyrics) {
        // For plain lyrics, add them without timestamps
        lines.push('');
        const plainLines = result.plainLyrics.split('\n');
        plainLines.forEach(line => {
            if (line.trim()) {
                lines.push(line);
            }
        });
    }
    
    return lines.join('\n');
}

/**
 * Download content as a file
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Sanitize filename by removing invalid characters
 */
export function sanitizeFilename(filename: string): string {
    return filename
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
