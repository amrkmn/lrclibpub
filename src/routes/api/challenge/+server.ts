import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async () => {
    try {
        const response = await fetch("https://lrclib.net/api/request-challenge", {
            method: "POST",
            headers: {
                "Lrclib-Client": "LRCLIBpub v1.0.0 (https://github.com/amrkmn/lrclibpub)",
            },
        });

        if (!response.ok) {
            throw new Error(`Challenge request failed: ${response.status}`);
        }

        const challenge = await response.json();
        return json(challenge);
    } catch (error) {
        console.error("Challenge request error:", error);
        return json({ error: "Failed to get challenge from LRCLIB" }, { status: 500 });
    }
};
