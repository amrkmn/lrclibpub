import { json } from "@sveltejs/kit";
import { USER_AGENT } from "$lib/types";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
    const { id } = params;

    if (!id || isNaN(Number(id))) {
        return json({ message: "Invalid lyrics ID", name: "ValidationError", statusCode: 400 }, { status: 400 });
    }

    try {
        const response = await fetch(`https://lrclib.net/api/get/${id}`, {
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
