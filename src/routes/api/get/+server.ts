import { json } from "@sveltejs/kit";
import { USER_AGENT } from "$lib/types";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
    const trackName = url.searchParams.get("track_name");
    const artistName = url.searchParams.get("artist_name");
    const albumName = url.searchParams.get("album_name");
    const duration = url.searchParams.get("duration");

    if (!trackName || !artistName || !albumName || !duration) {
        return json(
            {
                message: "Missing required parameters: track_name, artist_name, album_name, duration",
                name: "ValidationError",
                statusCode: 400,
            },
            { status: 400 }
        );
    }

    const params = new URLSearchParams({
        track_name: trackName,
        artist_name: artistName,
        album_name: albumName,
        duration: duration,
    });

    try {
        const response = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
            headers: {
                "Lrclib-Client": USER_AGENT,
            },
        });

        if (!response.ok) {
            const errorData = await response
                .json()
                .catch(() => ({ message: "Unknown error", name: "UnknownError", statusCode: response.status }));
            return json(errorData, { status: response.status });
        }

        const data = await response.json();
        return json(data);
    } catch (err) {
        if (err instanceof Error && err.message.includes("fetch")) {
            return json({ message: "Failed to connect to LRCLIB API", name: "UnknownError", statusCode: 503 }, { status: 503 });
        }
        return json({ message: "An unexpected error occurred", name: "UnknownError", statusCode: 500 }, { status: 500 });
    }
};
