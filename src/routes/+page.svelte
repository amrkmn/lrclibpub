<script lang="ts">
    import Footer from "$lib/components/Footer.svelte";
    import { parseLRCFile } from "$lib/lrc";
    import type { Challenge, FormData } from "$lib/types";
    import { numify } from "numify";
    import { onMount } from "svelte";

    // Initialize form data with default values
    let formData = $state<FormData>({
        trackName: "",
        artistName: "",
        albumName: "",
        duration: "",
        plainLyrics: "",
        syncedLyrics: "",
    });

    // UI state variables
    let isSubmitting = $state(false);
    let error = $state<string | null>(null);
    let success = $state(false);
    let solveProgress = $state({ attempts: 0, nonce: 0, startTime: 0, rate: 0 });
    let solveTime = $state(0);
    let solveAttempts = $state(0);

    // Timeouts for notifications
    let errorTimeout: number;
    let successTimeout: number;

    /**
     * Set an error message with auto-dismiss after 5 seconds
     */
    function setError(message: string) {
        error = message;
        if (errorTimeout) clearTimeout(errorTimeout);
        errorTimeout = setTimeout(() => {
            error = null;
        }, 5000) as unknown as number;
    }

    /**
     * Set success state with auto-dismiss after 5 seconds
     */
    function setSuccess() {
        success = true;
        if (successTimeout) clearTimeout(successTimeout);
        successTimeout = setTimeout(() => {
            success = false;
            solveProgress = { attempts: 0, nonce: 0, startTime: 0, rate: 0 };
        }, 5000) as unknown as number;
    }

    /**
     * Format solve time in human-readable format
     */
    function formatSolveTime(timeMs: number): string {
        if (timeMs < 1000) {
            return `${timeMs}ms`;
        } else if (timeMs < 60000) {
            return `${(timeMs / 1000).toFixed(1)}s`;
        } else {
            const minutes = Math.floor(timeMs / 60000);
            const seconds = Math.floor((timeMs % 60000) / 1000);
            return `${minutes}m ${seconds}s`;
        }
    }

    /**
     * Request a new challenge from the server
     */
    async function requestChallenge(): Promise<Challenge> {
        try {
            const response = await fetch("/api/challenge", {
                method: "POST",
            });
            return await response.json();
        } catch (err) {
            throw new Error("Failed to get challenge");
        }
    }

    /**
     * Reset the form to its initial state
     */
    function resetForm() {
        formData.trackName = "";
        formData.artistName = "";
        formData.albumName = "";
        formData.duration = "";
        formData.plainLyrics = "";
        formData.syncedLyrics = "";

        // Reset file input
        const fileInput = document.getElementById("lrcFile") as HTMLInputElement;
        if (fileInput) {
            fileInput.value = "";
        }
    }

    /**
     * Handle form submission
     */
    async function handleSubmit(event: Event) {
        event.preventDefault();
        let worker: Worker | null = null;

        try {
            // Reset state
            isSubmitting = true;
            error = null;
            success = false;

            // Validate required fields
            if (!formData.trackName.trim()) {
                setError("Track name is required");
                return;
            }
            if (!formData.artistName.trim()) {
                setError("Artist name is required");
                return;
            }

            // Check if at least one of the lyrics fields is filled for non-instrumental tracks
            if (!formData.plainLyrics.trim() && !formData.syncedLyrics.trim()) {
                if (!confirm("No lyrics provided. Is this an instrumental track?")) {
                    setError("Please provide lyrics or confirm if this is an instrumental track");
                    return;
                }
            }

            // Get challenge
            const challenge = await requestChallenge();

            // Solve challenge using Web Worker
            solveProgress = { attempts: 0, nonce: 0, startTime: Date.now(), rate: 0 };

            worker = new Worker(new URL("../lib/worker.ts", import.meta.url), {
                type: "module",
            });

            // Process the challenge with WebWorker
            const nonce = await new Promise<string>((resolve, reject) => {
                if (!worker) return;

                worker.onmessage = (e) => {
                    const { type, attempts, rate, nonce, error, finalAttempts, totalTime } = e.data;

                    if (type === "progress") {
                        solveProgress = {
                            rate,
                            attempts,
                            nonce: 0,
                            startTime: solveProgress.startTime || Date.now(),
                        };
                    } else if (type === "success") {
                        // Calculate solve time
                        solveTime = totalTime;
                        solveAttempts = finalAttempts;
                        resolve(nonce);
                    } else if (type === "error") {
                        reject(new Error(error));
                    }
                };

                worker.postMessage({
                    prefix: challenge.prefix,
                    target: challenge.target,
                });
            });

            const publishToken = `${challenge.prefix}:${nonce}`;

            // Submit lyrics through our API endpoint
            const response = await fetch("/api/publish", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Publish-Token": publishToken,
                },
                body: JSON.stringify({
                    trackName: formData.trackName.trim(),
                    artistName: formData.artistName.trim(),
                    albumName: formData.albumName?.trim() || "",
                    duration: formData.duration ? Number.parseInt(formData.duration, 10) : undefined,
                    plainLyrics: formData.plainLyrics?.trim() || "",
                    syncedLyrics: formData.syncedLyrics?.trim() || "",
                }),
            });

            // Handle API response
            let data;
            try {
                const responseText = await response.text();
                data = responseText ? JSON.parse(responseText) : { message: "No response content" };
            } catch (parseError) {
                data = { message: "Failed to parse response" };
            }

            if (!response.ok) {
                throw new Error(data.message || "Failed to publish lyrics");
            }

            setSuccess();
            resetForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred");
        } finally {
            isSubmitting = false;
            // Clean up worker
            if (worker) {
                worker.terminate();
                worker = null;
            }
        }
    }

    // Initialize form data from URL parameters if available
    onMount(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const titleParam = urlParams.get("title");
        const artistParam = urlParams.get("artist");
        const albumParam = urlParams.get("album");
        const durationParam = urlParams.get("duration");

        if (titleParam) formData.trackName = decodeURIComponent(titleParam);
        if (artistParam) formData.artistName = decodeURIComponent(artistParam);
        if (albumParam) formData.albumName = decodeURIComponent(albumParam);
        if (durationParam) formData.duration = decodeURIComponent(durationParam);
    });
</script>

<div class="min-h-screen bg-[#E0E7FF] text-indigo-900 p-6">
    <div class="max-w-2xl mx-auto">
        <!-- Header -->
        <header class="flex md:items-center items-start justify-between mb-8 md:flex-row flex-col gap-6">
            <h1 class="text-3xl font-bold flex items-center gap-2">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="size-8"
                >
                    <path stroke-linecap="round" stroke-linejoin="round" d="m9 9 6-6m0 0 6 6m-6-6v12a6 6 0 0 1-12 0v-3" />
                </svg>
                LRCLIBpub
            </h1>
            <a
                href="/search"
                class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="size-4"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                    />
                </svg>
                Search Lyrics
            </a>
        </header>

        <!-- Introduction -->
        <div class="text-indigo-800 mb-6">
            <p>
                Welcome to LRCLIBpub - a simple web interface to publish lyrics to the
                <a href="https://lrclib.net" target="_blank" rel="noopener noreferrer" class="underline">LRCLIB</a>
                lyrics database.
            </p>
            <p class="mt-3">
                Please be mindful of the quality and accuracy of the lyrics you submit. This is a crowd-sourced effort, and your
                contributions enhance the database for everyone.
            </p>
        </div>

        <form onsubmit={handleSubmit} class="space-y-6 rounded-lg shadow-xs">
            <!-- Notifications container -->
            {#if error || success || isSubmitting}
                <div class="fixed bottom-4 right-4 flex flex-col gap-2 z-10">
                    <!-- Error notification -->
                    {#if error}
                        <div
                            class="bg-white p-4 rounded-lg shadow-lg border border-red-200 flex items-center gap-2 text-red-700 animate-fade-in pr-5"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="2"
                                stroke="currentColor"
                                class="size-5"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                                />
                            </svg>
                            {error}
                        </div>
                    {/if}

                    <!-- Success notification -->
                    {#if success}
                        <div
                            class="bg-white p-4 rounded-lg shadow-lg border border-green-200 flex items-center gap-2 text-green-700 animate-fade-in pr-5"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="2"
                                stroke="currentColor"
                                class="size-5"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                                />
                            </svg>
                            <div>
                                <div class="font-medium">Lyrics published successfully!</div>
                                {#if solveTime > 0}
                                    <div class="text-sm text-green-600">
                                        Proof-of-work solved in {formatSolveTime(solveTime)} with {solveAttempts} attempts.
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/if}

                    <!-- Progress notification -->
                    {#if isSubmitting}
                        <div class="bg-white p-4 rounded-lg shadow-lg border border-indigo-200 pr-5">
                            <div class="flex items-center gap-3">
                                <div class="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent"></div>
                                <div class="flex flex-col">
                                    {#if solveProgress.attempts > 0}
                                        <p class="text-sm font-medium text-indigo-800">Solving proof of work...</p>
                                        <div class="flex gap-2 text-xs text-indigo-600 justify-between">
                                            <span>{((Date.now() - solveProgress.startTime) / 1000).toFixed(1)}s</span>
                                            <span>•</span>
                                            <span>{numify(solveProgress.rate)} hashes/s</span>
                                            <span>•</span>
                                            <span>Attempts: {solveProgress.attempts}</span>
                                        </div>
                                    {:else}
                                        <p class="text-sm font-medium text-indigo-800">Publishing...</p>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}

            <!-- Song metadata section -->
            <div class="space-y-4">
                <!-- Track Name -->
                <div>
                    <label for="trackName" class="block text-sm font-medium mb-1">Track Name *</label>
                    <input
                        type="text"
                        id="trackName"
                        bind:value={formData.trackName}
                        required
                        placeholder="Enter track name"
                        class="w-full px-3 py-2 border border-indigo-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <!-- Artist Name -->
                <div>
                    <label for="artistName" class="block text-sm font-medium mb-1">Artist Name *</label>
                    <input
                        type="text"
                        id="artistName"
                        bind:value={formData.artistName}
                        required
                        placeholder="Enter artist name"
                        class="w-full px-3 py-2 border border-indigo-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <!-- Album Name -->
                <div>
                    <label for="albumName" class="block text-sm font-medium mb-1">Album Name</label>
                    <input
                        type="text"
                        id="albumName"
                        bind:value={formData.albumName}
                        placeholder="Enter album name (optional)"
                        class="w-full px-3 py-2 border border-indigo-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <!-- Duration -->
                <div>
                    <label for="duration" class="block text-sm font-medium mb-1">Duration (seconds)</label>
                    <input
                        type="number"
                        id="duration"
                        bind:value={formData.duration}
                        min="0"
                        placeholder="Song duration in seconds (optional)"
                        class="w-full px-3 py-2 border border-indigo-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <!-- Lyrics input section -->
                <div class="space-y-4 p-4 border border-dashed border-indigo-300 rounded-lg bg-indigo-50/50">
                    <div class="flex items-center gap-4 flex-wrap">
                        <h3 class="text-lg font-semibold">Lyrics Input</h3>
                        <!-- LRC file upload -->
                        <label
                            for="lrcFile"
                            class="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-200/75 hover:bg-indigo-200 text-indigo-700 rounded-md cursor-pointer transition-colors"
                        >
                            <svg
                                class="w-4 h-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            Upload .lrc file
                        </label>
                        <input
                            type="file"
                            id="lrcFile"
                            accept=".lrc"
                            class="hidden"
                            onchange={async (e) => {
                                const file = (e.target as HTMLInputElement)?.files?.[0];
                                if (!file) return;

                                const content = await file.text();
                                const parsed = parseLRCFile(content);

                                if (parsed.title) formData.trackName = parsed.title;
                                if (parsed.artist) formData.artistName = parsed.artist;
                                if (parsed.album) formData.albumName = parsed.album;
                                if (parsed.duration) formData.duration = parsed.duration;
                                formData.plainLyrics = parsed.plainLyrics;
                                formData.syncedLyrics = parsed.syncedLyrics;
                            }}
                        />
                    </div>

                    <!-- Plain lyrics input -->
                    <div>
                        <label for="plainLyrics" class="block text-sm font-medium mb-1">Plain Lyrics</label>
                        <textarea
                            id="plainLyrics"
                            bind:value={formData.plainLyrics}
                            rows="6"
                            placeholder="Enter plain lyrics text here"
                            class="w-full px-3 py-2 border border-indigo-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        ></textarea>
                        <p class="mt-1 text-sm text-indigo-600">Leave both lyrics fields empty for instrumental tracks</p>
                    </div>

                    <!-- Synced lyrics input -->
                    <div>
                        <label for="syncedLyrics" class="block text-sm font-medium mb-1">Synced Lyrics</label>
                        <div class="relative">
                            <textarea
                                id="syncedLyrics"
                                bind:value={formData.syncedLyrics}
                                rows="6"
                                class="w-full px-3 py-2 border border-indigo-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                                placeholder="[mm:ss.xx] Lyrics line"
                            ></textarea>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Warning message -->
            <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 rounded-md">
                <p class="text-sm text-yellow-800">
                    <strong>Note:</strong> Publishing involves solving a proof-of-work challenge. This process may take several minutes
                    and could slow down your browser or device.
                </p>
            </div>

            <!-- Submit button -->
            <button
                type="submit"
                disabled={isSubmitting || !formData.trackName.trim() || !formData.artistName.trim()}
                class="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:cursor-pointer hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                {isSubmitting ? "Publishing, this might take a while..." : "Publish Lyrics"}
            </button>
        </form>

        <Footer />
    </div>
</div>
