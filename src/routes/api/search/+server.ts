import { json } from "@sveltejs/kit";
import { USER_AGENT } from "$lib/types";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
    const q = url.searchParams.get("q");
    const trackName = url.searchParams.get("track_name");
    const artistName = url.searchParams.get("artist_name");
    const albumName = url.searchParams.get("album_name");

    if (!q && !trackName) {
        return json(
            { message: "At least one of 'q' or 'track_name' parameter is required", name: "ValidationError", statusCode: 400 },
            { status: 400 }
        );
    }

    const params = new URLSearchParams();
    if (q) params.append("q", q);
    if (trackName) params.append("track_name", trackName);
    if (artistName) params.append("artist_name", artistName);
    if (albumName) params.append("album_name", albumName);

    try {
        const response = await fetch(`https://lrclib.net/api/search?${params.toString()}`, {
            headers: {
                "Lrclib-Client": USER_AGENT,
            },
        });

        if (!response.ok) {
            const errorData = await response
                .json()
                .catch(() => ({ message: "Failed to search lyrics", name: "UnknownError", statusCode: response.status }));
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
