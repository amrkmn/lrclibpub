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
