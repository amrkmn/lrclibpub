import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
    LRCLIB_APP_ID: { schema: (input) => input ?? '' },
    LRCLIB_API_KEY: { schema: (input) => input ?? '' }
});
