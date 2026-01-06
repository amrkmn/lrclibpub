import { json } from "@sveltejs/kit";
import { USER_AGENT } from "$lib/types";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async () => {
    try {
        const response = await fetch("https://lrclib.net/api/request-challenge", {
            method: "POST",
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

        const challenge = await response.json();
        return json(challenge);
    } catch (error) {
        if (error instanceof Error && error.message.includes("fetch")) {
            return json({ message: "Failed to connect to LRCLIB API", name: "UnknownError", statusCode: 503 }, { status: 503 });
        }
        return json({ message: "Failed to get challenge from LRCLIB", name: "UnknownError", statusCode: 500 }, { status: 500 });
    }
};
