import { LRCLIB_APP_ID, LRCLIB_API_KEY } from '$app/env/private';

import { validateLRC } from '#lib/lrc/validator.js';
import { validateLyricsfileYaml } from '#lib/lyricsfile/validator.js';
import { USER_AGENT } from '#lib/types.js';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
    const publishToken = request.headers.get('X-Publish-Token');

    if (!publishToken) {
        return Response.json(
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
        return Response.json(
            {
                message: 'Invalid JSON body',
                name: 'ValidationError',
                statusCode: 400
            },
            { status: 400 }
        );
    }

    const { trackName, artistName, albumName, duration, plainLyrics, syncedLyrics, lyricsfile } =
        body;

    // Validate required fields
    if (!trackName?.trim()) {
        return Response.json(
            {
                message: 'Track name is required',
                name: 'ValidationError',
                statusCode: 400
            },
            { status: 400 }
        );
    }

    if (!artistName?.trim()) {
        return Response.json(
            {
                message: 'Artist name is required',
                name: 'ValidationError',
                statusCode: 400
            },
            { status: 400 }
        );
    }

    // request.json() is untyped; narrow string fields through a predicate.
    function isNonEmptyString(v: unknown): v is string {
        return typeof v === 'string' && v.trim().length > 0;
    }

    const hasLyricsfile = isNonEmptyString(body?.lyricsfile);

    // Validate lyricsfile if provided (takes precedence)
    if (hasLyricsfile) {
        const lfValidation = validateLyricsfileYaml(lyricsfile.trim());

        if (lfValidation.hasErrors) {
            const errorMessages = lfValidation.issues
                .filter((i) => i.severity === 'error')
                .map((i) => `${i.path}: ${i.message}`)
                .join('; ');

            return Response.json(
                {
                    message: `Lyricsfile validation failed: ${errorMessages}`,
                    name: 'ValidationError',
                    statusCode: 400,
                    validationIssues: lfValidation.issues
                },
                { status: 400 }
            );
        }
    } else if (syncedLyrics?.trim()) {
        const validation = validateLRC(syncedLyrics.trim());

        if (validation.hasErrors) {
            const errorMessages = validation.issues
                .filter((issue) => issue.severity === 'error')
                .map((issue) => `Line ${issue.line}: ${issue.message}`)
                .join('; ');

            return Response.json(
                {
                    message: `LRC validation failed: ${errorMessages}`,
                    name: 'ValidationError',
                    statusCode: 400,
                    validationIssues: validation.issues
                },
                { status: 400 }
            );
        }
    }

    // Build the request body for LRCLIB
    const lrclibBody: any = {
        trackName: trackName.trim(),
        artistName: artistName.trim(),
        albumName: ''
    };

    if (albumName?.trim()) {
        lrclibBody.albumName = albumName.trim();
    }

    if (duration && Number.isInteger(duration) && duration > 0) {
        lrclibBody.duration = duration;
    }

    if (hasLyricsfile) {
        lrclibBody.lyricsfile = lyricsfile.trim();
    } else {
        if (plainLyrics?.trim()) {
            lrclibBody.plainLyrics = plainLyrics.trim();
        }

        if (syncedLyrics?.trim()) {
            lrclibBody.syncedLyrics = syncedLyrics.trim();
        }
    }

    try {
        const headers = new Headers({
            'Content-Type': 'application/json',
            'X-Publish-Token': publishToken,
            'Lrclib-Client': USER_AGENT
        });

        // Application ID from the developer portal (server-side registration).
        // Always sent together with the API key; upstream rejects it alone.
        if (LRCLIB_APP_ID) {
            headers.set('Lrclib-App-Id', LRCLIB_APP_ID);
        }

        if (LRCLIB_API_KEY) {
            headers.set('Lrclib-Api-Key', LRCLIB_API_KEY);
        }

        const response = await fetch('https://lrclib.net/api/publish', {
            method: 'POST',
            headers,
            body: JSON.stringify(lrclibBody)
        });

        let data;

        try {
            const responseText = await response.text();
            data = responseText ? JSON.parse(responseText) : { message: 'No response content' };
        } catch {
            data = { message: 'Failed to parse response' };
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({
                message: data.message || 'Failed to publish lyrics',
                name: 'UnknownError',
                statusCode: response.status
            }));

            return Response.json(errorData, { status: response.status });
        }

        return Response.json(data);
    } catch (err) {
        if (err instanceof Error && err.message.includes('fetch')) {
            return Response.json(
                {
                    message: 'Failed to connect to LRCLIB API',
                    name: 'UnknownError',
                    statusCode: 503
                },
                { status: 503 }
            );
        }

        return Response.json(
            {
                message: 'An unexpected error occurred',
                name: 'UnknownError',
                statusCode: 500
            },
            { status: 500 }
        );
    }
};
