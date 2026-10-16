import { env } from '$env/dynamic/private';
import { USER_AGENT } from '$lib/types';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
    const publishToken = request.headers.get('X-Publish-Token');

    if (!publishToken) {
        return json(
            {
                message: 'Missing publish token',
                name: 'ValidationError',
                statusCode: 400
            },
            { status: 400 }
        );
    }

    let body;

    try {
        body = await request.json();
    } catch {
        return json(
            {
                message: 'Invalid JSON body',
                name: 'ValidationError',
                statusCode: 400
            },
            { status: 400 }
        );
    }

    const { trackId, content } = body;

    if (!Number.isInteger(trackId)) {
        return json(
            {
                message: 'trackId (integer) is required',
                name: 'ValidationError',
                statusCode: 400
            },
            { status: 400 }
        );
    }

    // request.json() is untyped; narrow fields through a predicate.
    function isNonEmptyString(v: unknown): v is string {
        return typeof v === 'string' && v.trim().length > 0;
    }

    type FlagBody = {
        trackId: number;
        content?: string;
    };

    const lrclibBody: FlagBody = { trackId };

    if (isNonEmptyString(content)) {
        lrclibBody.content = content.trim();
    }

    try {
        const headers = new Headers({
            'Content-Type': 'application/json',
            'X-Publish-Token': publishToken,
            'Lrclib-Client': USER_AGENT
        });

        if (env.LRCLIB_APP_ID) {
            headers.set('Lrclib-App-Id', env.LRCLIB_APP_ID);
        }

        if (env.LRCLIB_API_KEY) {
            headers.set('Lrclib-Api-Key', env.LRCLIB_API_KEY);
        }

        const response = await fetch('https://lrclib.net/api/flag', {
            method: 'POST',
            headers,
            body: JSON.stringify(lrclibBody)
        });

        // Upstream answers 201 with an empty body on success.
        if (response.status === 201) {
            return json({ message: 'Flag submitted' }, { status: 201 });
        }

        const errorData = await response.json().catch(() => ({
            message: 'Failed to flag lyrics',
            name: 'UnknownError',
            statusCode: response.status
        }));

        return json(errorData, { status: response.status });
    } catch (err) {
        if (err instanceof Error && err.message.includes('fetch')) {
            return json(
                {
                    message: 'Failed to connect to LRCLIB API',
                    name: 'UnknownError',
                    statusCode: 503
                },
                { status: 503 }
            );
        }

        return json(
            {
                message: 'An unexpected error occurred',
                name: 'UnknownError',
                statusCode: 500
            },
            { status: 500 }
        );
    }
};
