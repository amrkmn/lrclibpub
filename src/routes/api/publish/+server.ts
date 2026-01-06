import { json } from "@sveltejs/kit";
import { USER_AGENT } from "$lib/types";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
    const publishToken = request.headers.get("X-Publish-Token");

    if (!publishToken) {
        return json({ message: "Missing publish token", name: "ValidationError", statusCode: 400 }, { status: 400 });
    }

    let body;
    try {
        body = await request.json();
    } catch (err) {
        return json({ message: "Invalid JSON body", name: "ValidationError", statusCode: 400 }, { status: 400 });
    }

    const { trackName, artistName, albumName, duration, plainLyrics, syncedLyrics } = body;

    // Validate required fields
    if (!trackName?.trim()) {
        return json({ message: "Track name is required", name: "ValidationError", statusCode: 400 }, { status: 400 });
    }
    if (!artistName?.trim()) {
        return json({ message: "Artist name is required", name: "ValidationError", statusCode: 400 }, { status: 400 });
    }

    // Build the request body for LRCLIB
    const lrclibBody: any = {
        trackName: trackName.trim(),
        artistName: artistName.trim(),
        albumName: "",
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
                "Lrclib-Client": USER_AGENT,
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
            const errorData = await response
                .json()
                .catch(() => ({
                    message: data.message || "Failed to publish lyrics",
                    name: "UnknownError",
                    statusCode: response.status,
                }));
            return json(errorData, { status: response.status });
        }

        return json(data);
    } catch (err) {
        if (err instanceof Error && err.message.includes("fetch")) {
            return json({ message: "Failed to connect to LRCLIB API", name: "UnknownError", statusCode: 503 }, { status: 503 });
        }
        return json({ message: "An unexpected error occurred", name: "UnknownError", statusCode: 500 }, { status: 500 });
    }
};
