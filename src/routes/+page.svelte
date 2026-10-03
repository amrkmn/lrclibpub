<script lang="ts">
    import { resolve } from "$app/paths";
    import Footer from "$lib/components/Footer.svelte";
    import LrcTab from "$lib/components/LrcTab.svelte";
    import LyricsfileTab from "$lib/components/LyricsfileTab.svelte";
    import { validateLyricsfileYaml } from "$lib/lyricsfile/validator";
    import { type ActiveSolve, startSolve } from "$lib/solver-pool";
    import type { Challenge, FormData } from "$lib/types";
    import { numify } from "numify";
    import { onDestroy, onMount } from "svelte";

    // Initialize form data with default values
    let formData = $state<FormData>({
        trackName: "",
        artistName: "",
        albumName: "",
        duration: "",
        plainLyrics: "",
        syncedLyrics: "",
        lyricsfile: "",
    });

    // Active publish format
    let activeFormat = $state<"lrc" | "lyricsfile">("lrc");

    // UI state variables
    let isSubmitting = $state(false);
    let error = $state<string | null>(null);
    let success = $state(false);
    let solveProgress = $state({
        attempts: 0,
        nonce: 0,
        startTime: 0,
        rate: 0,
        workers: 0,
    });
    let solveTime = $state(0);
    let solveAttempts = $state(0);

    // Timeouts for notifications
    let errorTimeout: number;
    let successTimeout: number;

    // Active PoW solve (cancelled on unmount to avoid leaking workers).
    let activeSolve: ActiveSolve | null = null;
    onDestroy(() => activeSolve?.cancel());

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
            solveProgress = {
                attempts: 0,
                nonce: 0,
                startTime: 0,
                rate: 0,
                workers: 0,
            };
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
            const response = await fetch("/api/request-challenge", {
                method: "POST",
            });

            if (!response.ok) {
                const errorData = await response
                    .json()
                    .catch(() => ({ message: "Failed to get challenge" }));
                throw new Error(errorData.message || "Failed to get challenge");
            }

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
        formData.lyricsfile = "";

        // Reset file inputs
        const fileInput = document.getElementById(
            "lrcFile",
        ) as HTMLInputElement;
        if (fileInput) {
            fileInput.value = "";
        }
        const lfFileInput = document.getElementById(
            "lfFile",
        ) as HTMLInputElement;
        if (lfFileInput) {
            lfFileInput.value = "";
        }
    }

    /**
     * Handle form submission
     */
    async function handleSubmit(event: Event) {
        event.preventDefault();

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

            if (activeFormat === "lyricsfile") {
                if (!formData.lyricsfile.trim()) {
                    setError("Lyricsfile content is required");
                    return;
                }
                const lfVal = validateLyricsfileYaml(
                    formData.lyricsfile.trim(),
                );
                if (lfVal.hasErrors) {
                    setError(
                        "Please fix Lyricsfile validation errors before publishing",
                    );
                    return;
                }
            } else {
                if (
                    !formData.plainLyrics.trim() &&
                    !formData.syncedLyrics.trim()
                ) {
                    if (
                        !confirm(
                            "No lyrics provided. Is this an instrumental track?",
                        )
                    ) {
                        setError(
                            "Please provide lyrics or confirm if this is an instrumental track",
                        );
                        return;
                    }
                }
            }

            // Get challenge
            const challenge = await requestChallenge();

            // Solve challenge using Web Worker
            solveProgress = {
                attempts: 0,
                nonce: 0,
                startTime: Date.now(),
                rate: 0,
                workers: 0,
            };

            // Solve the challenge with a strided worker pool (one worker
            // per core, first solution wins).
            activeSolve = startSolve(
                challenge.prefix,
                challenge.target,
                ({ attempts, rate, workers }) => {
                    solveProgress = {
                        rate,
                        attempts,
                        nonce: 0,
                        startTime: solveProgress.startTime || Date.now(),
                        workers,
                    };
                },
            );

            const { nonce, attempts, totalTime } = await activeSolve.promise;
            activeSolve = null;
            solveTime = totalTime;
            solveAttempts = attempts;

            const publishToken = `${challenge.prefix}:${nonce}`;

            // Submit lyrics through our API endpoint
            const payload: Record<string, unknown> = {
                trackName: formData.trackName.trim(),
                artistName: formData.artistName.trim(),
                albumName: formData.albumName?.trim() || "",
                duration: formData.duration
                    ? Number.parseInt(formData.duration, 10)
                    : undefined,
            };
            if (activeFormat === "lyricsfile") {
                payload.lyricsfile = formData.lyricsfile.trim();
            } else {
                payload.plainLyrics = formData.plainLyrics?.trim() || "";
                payload.syncedLyrics = formData.syncedLyrics?.trim() || "";
            }
            const response = await fetch("/api/publish", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Publish-Token": publishToken,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response
                    .json()
                    .catch(() => ({ message: "Failed to publish lyrics" }));
                throw new Error(
                    errorData.message || "Failed to publish lyrics",
                );
            }

            setSuccess();
            resetForm();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "An unknown error occurred",
            );
        } finally {
            isSubmitting = false;
            // Pool workers are terminated on settle; drop the handle.
            activeSolve = null;
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
        if (durationParam)
            formData.duration = decodeURIComponent(durationParam);
    });
</script>

<div class="min-h-screen bg-[#E0E7FF] text-indigo-900 p-6">
    <div class="max-w-2xl mx-auto">
        <!-- Header -->
        <header
            class="flex md:items-center items-start justify-between mb-8 md:flex-row flex-col gap-6"
        >
            <h1 class="text-3xl font-bold flex items-center gap-2">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="size-8"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="m9 9 6-6m0 0 6 6m-6-6v12a6 6 0 0 1-12 0v-3"
                    />
                </svg>
                LRCLIBpub
            </h1>
            <a
                href={resolve("/search")}
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
                Welcome to LRCLIBpub - a simple web interface to publish lyrics
                to the
                <a
                    href="https://lrclib.net"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="underline">LRCLIB</a
                >
                lyrics database.
            </p>
            <p class="mt-3">
                Please be mindful of the quality and accuracy of the lyrics you
                submit. This is a crowd-sourced effort, and your contributions
                enhance the database for everyone.
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
                                <div class="font-medium">
                                    Lyrics published successfully!
                                </div>
                                {#if solveTime > 0}
                                    <div class="text-sm text-green-600">
                                        Proof-of-work solved in {formatSolveTime(
                                            solveTime,
                                        )} with {solveAttempts} attempts.
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/if}

                    <!-- Progress notification -->
                    {#if isSubmitting}
                        <div
                            class="bg-white p-4 rounded-lg shadow-lg border border-indigo-200 pr-5"
                        >
                            <div class="flex items-center gap-3">
                                <div
                                    class="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent"
                                ></div>
                                <div class="flex flex-col">
                                    {#if solveProgress.attempts > 0}
                                        <p
                                            class="text-sm font-medium text-indigo-800"
                                        >
                                            Solving proof of work...
                                        </p>
                                        <div
                                            class="flex gap-2 text-xs text-indigo-600 justify-between"
                                        >
                                            <span
                                                >{(
                                                    (Date.now() -
                                                        solveProgress.startTime) /
                                                    1000
                                                ).toFixed(1)}s</span
                                            >
                                            <span>•</span>
                                            <span>
                                                {numify(solveProgress.rate)} hashes/s{#if solveProgress.workers > 1}{" · "}{solveProgress.workers} workers{/if}
                                            </span>
                                            <span>•</span>
                                            <span
                                                >Attempts: {solveProgress.attempts}</span
                                            >
                                        </div>
                                    {:else}
                                        <p
                                            class="text-sm font-medium text-indigo-800"
                                        >
                                            Publishing...
                                        </p>
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
                    <label
                        for="trackName"
                        class="block text-sm font-medium mb-1"
                        >Track Name *</label
                    >
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
                    <label
                        for="artistName"
                        class="block text-sm font-medium mb-1"
                        >Artist Name *</label
                    >
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
                    <label
                        for="albumName"
                        class="block text-sm font-medium mb-1">Album Name</label
                    >
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
                    <label for="duration" class="block text-sm font-medium mb-1"
                        >Duration (seconds)</label
                    >
                    <input
                        type="number"
                        id="duration"
                        bind:value={formData.duration}
                        min="0"
                        placeholder="Song duration in seconds (optional)"
                        class="w-full px-3 py-2 border border-indigo-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <!-- Format tabs -->
                <div class="flex gap-2">
                    <button
                        type="button"
                        onclick={() => (activeFormat = "lrc")}
                        class="px-4 py-2 rounded-md text-sm font-medium border {activeFormat ===
                        'lrc'
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'}"
                    >
                        LRC
                    </button>
                    <button
                        type="button"
                        onclick={() => (activeFormat = "lyricsfile")}
                        class="px-4 py-2 rounded-md text-sm font-medium border {activeFormat ===
                        'lyricsfile'
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'}"
                    >
                        Lyricsfile (YAML)
                    </button>
                </div>

                <!-- Lyrics input — tab content -->
                <div
                    class="p-4 border border-dashed border-indigo-300 rounded-lg bg-indigo-50/50"
                >
                    {#if activeFormat === "lrc"}
                        <LrcTab
                            bind:plainLyrics={formData.plainLyrics}
                            bind:syncedLyrics={formData.syncedLyrics}
                            bind:trackName={formData.trackName}
                            bind:artistName={formData.artistName}
                            bind:albumName={formData.albumName}
                            bind:duration={formData.duration}
                        />
                    {:else}
                        <LyricsfileTab
                            bind:lyricsfile={formData.lyricsfile}
                            bind:trackName={formData.trackName}
                            bind:artistName={formData.artistName}
                            bind:albumName={formData.albumName}
                            bind:duration={formData.duration}
                        />
                    {/if}
                </div>
            </div>

            <!-- Warning messages -->
            <div class="space-y-4">
                <!-- LRCLIB permanent submission warning -->
                <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                    <div class="flex items-start gap-3">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                            stroke="currentColor"
                            class="size-5 text-red-600 shrink-0 mt-0.5"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                            />
                        </svg>
                        <div class="text-sm text-red-800">
                            <p class="font-semibold mb-1">Before You Proceed</p>
                            <ul class="list-disc list-inside space-y-1">
                                <li>
                                    LRCLIB does not allow deletion or
                                    replacement of lyrics via their API.
                                </li>
                                <li>
                                    Once submitted, lyrics are permanent.
                                    Carefully verify all information before
                                    publishing.
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- Proof-of-work warning -->
                <div
                    class="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md"
                >
                    <p class="text-sm text-yellow-800">
                        <strong>Note:</strong> Publishing involves solving a proof-of-work
                        challenge. This process may take several minutes and could
                        slow down your browser or device.
                    </p>
                </div>
            </div>

            <!-- Submit button -->
            <button
                type="submit"
                disabled={isSubmitting ||
                    !formData.trackName.trim() ||
                    !formData.artistName.trim()}
                class="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:cursor-pointer hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                {isSubmitting
                    ? "Publishing, this might take a while..."
                    : "Publish Lyrics"}
            </button>
        </form>

        <Footer />
    </div>
</div>
