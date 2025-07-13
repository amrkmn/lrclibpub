import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
    const publishToken = request.headers.get("X-Publish-Token");

    if (!publishToken) {
        throw error(400, "Missing publish token");
    }

    let body;
    try {
        body = await request.json();
    } catch (err) {
        throw error(400, "Invalid JSON body");
    }

    const { trackName, artistName, albumName, duration, plainLyrics, syncedLyrics } = body;

    // Validate required fields
    if (!trackName?.trim()) {
        throw error(400, "Track name is required");
    }
    if (!artistName?.trim()) {
        throw error(400, "Artist name is required");
    }

    // Build the request body for LRCLIB
    const lrclibBody: any = {
        trackName: trackName.trim(),
        artistName: artistName.trim(),
    };

    if (albumName?.trim()) {
        lrclibBody.albumName = albumName.trim();
    }
    if (duration && Number.isInteger(duration) && duration > 0) {
        lrclibBody.duration = duration;
    }
    if (plainLyrics?.trim()) {
        lrclibBody.plainLyrics = plainLyrics.trim();
    }
    if (syncedLyrics?.trim()) {
        lrclibBody.syncedLyrics = syncedLyrics.trim();
    }

    try {
        const response = await fetch("https://lrclib.net/api/publish", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Publish-Token": publishToken,
                "Lrclib-Client": "LRCLIBpub v1.0.0 (https://github.com/amrkmn/lrclibpub)",
            },
            body: JSON.stringify(lrclibBody),
        });

        let data;
        try {
            const responseText = await response.text();
            data = responseText ? JSON.parse(responseText) : { message: "No response content" };
        } catch (parseError) {
            data = { message: "Failed to parse response" };
        }

        if (!response.ok) {
            throw error(response.status, data.message || "Failed to publish lyrics");
        }

        return json(data);
    } catch (err) {
        if (err instanceof Error && err.message.includes("fetch")) {
            throw error(503, "Failed to connect to LRCLIB API");
        }
        throw err;
    }
};
