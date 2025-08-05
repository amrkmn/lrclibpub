<script lang="ts">
    import Footer from "$lib/components/Footer.svelte";
    import type { LyricResult, SearchParams } from "$lib/types";
    import { onMount } from "svelte";

    // Search form state
    let searchParams = $state<SearchParams>({
        q: "",
        track_name: "",
        artist_name: "",
        album_name: "",
        duration: undefined,
        page: 1,
    });

    // UI state
    let isSearching = $state(false);
    let error = $state<string | null>(null);
    let success = $state<string | null>(null);
    let results = $state<LyricResult[]>([]);
    let hasSearched = $state(false);
    let currentPage = $state(1);
    let searchMode = $state<"general" | "specific">("general");
    let viewingLyrics = $state<LyricResult | null>(null);
    let wasAutoSwitched = $state(false);
    let copiedStates = $state<{ [key: string]: boolean }>({});
    let activeTab = $state<"synced" | "plain">("synced");

    // Timeouts for notifications
    let errorTimeout: number;
    let successTimeout: number;
    let copyTimeouts: { [key: string]: number } = {};

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
     * Set success message with auto-dismiss after 3 seconds
     */
    function setSuccess(message: string) {
        success = message;
        if (successTimeout) clearTimeout(successTimeout);
        successTimeout = setTimeout(() => {
            success = null;
        }, 3000) as unknown as number;
    }

    /**
     * View full lyrics in a modal
     */
    function viewLyrics(result: LyricResult) {
        viewingLyrics = result;
        // Set default tab based on available lyrics
        if (result.syncedLyrics) {
            activeTab = "synced";
        } else if (result.plainLyrics) {
            activeTab = "plain";
        }
    }

    /**
     * Close lyrics viewer
     */
    function closeLyricsViewer() {
        viewingLyrics = null;
    }

    /**
     * Copy text to clipboard
     */
    async function copyToClipboard(text: string, type: string, buttonKey: string) {
        try {
            await navigator.clipboard.writeText(text);
            setSuccess(`${type} copied to clipboard!`);

            // Set copied state for this specific button
            copiedStates[buttonKey] = true;

            // Clear any existing timeout for this button
            if (copyTimeouts[buttonKey]) {
                clearTimeout(copyTimeouts[buttonKey]);
            }

            // Reset button text after 2 seconds
            copyTimeouts[buttonKey] = setTimeout(() => {
                copiedStates[buttonKey] = false;
                delete copyTimeouts[buttonKey];
            }, 2000) as unknown as number;
        } catch (err) {
            setError(`Failed to copy ${type.toLowerCase()}`);
        }
    }

    /**
     * Reset the search form
     */
    function resetForm() {
        searchParams = {
            q: "",
            track_name: "",
            artist_name: "",
            album_name: "",
            duration: undefined,
            page: 1,
        };
        results = [];
        hasSearched = false;
        currentPage = 1;
        error = null;
        wasAutoSwitched = false;
        // Reset to general mode when resetting form
        searchMode = "general";
    }

    /**
     * Perform search against LRCLIB API
     */
    async function performSearch(page: number = 1) {
        if (!searchParams.q && !searchParams.track_name) {
            setError("Please provide either a search term or track name");
            return;
        }

        isSearching = true;
        error = null;

        try {
            // Build query parameters
            const params = new URLSearchParams();
            if (searchParams.q) params.append("q", searchParams.q);
            if (searchParams.track_name) params.append("track_name", searchParams.track_name);
            if (searchParams.artist_name) params.append("artist_name", searchParams.artist_name);
            if (searchParams.album_name) params.append("album_name", searchParams.album_name);
            if (searchParams.duration) params.append("duration", (searchParams.duration * 1000).toString());
            params.append("page", page.toString());

            const response = await fetch(`https://lrclib.net/api/search?${params.toString()}`, {
                method: "GET",
                headers: {
                    "Lrclib-Client": "LRCLIBpub v1.0.0 (https://github.com/amrkmn/lrclibpub)",
                },
            });

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status} ${response.statusText}`);
            }

            const data: LyricResult[] = await response.json();
            results = data;
            hasSearched = true;
            currentPage = page;
        } catch (err) {
            console.error("Search error:", err);
            setError(err instanceof Error ? err.message : "Failed to search lyrics");
            results = [];
        } finally {
            isSearching = false;
        }
    }

    /**
     * Handle form submission
     */
    async function handleSubmit(event: SubmitEvent) {
        event.preventDefault();
        await performSearch(1);
    }

    /**
     * Handle pagination
     */
    async function changePage(newPage: number) {
        if (newPage < 1) return;
        await performSearch(newPage);
    }

    /**
     * Format duration from seconds to MM:SS
     */
    function formatDuration(duration?: number): string {
        if (!duration) return "Unknown";
        const minutes = Math.floor(duration / 60);
        const remainingSeconds = duration % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    }

    /**
     * Truncate text to specified length
     */
    function truncateText(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + "...";
    }

    // Reactive logic to auto-switch search mode
    $effect(() => {
        // Only auto-switch if user is in general mode and adds specific search criteria
        if (searchMode === "general" && (searchParams.artist_name || searchParams.album_name || searchParams.duration)) {
            searchMode = "specific";
            wasAutoSwitched = true;
            // When auto-switching to specific, move q to track_name if track_name is empty
            if (!searchParams.track_name && searchParams.q) {
                searchParams.track_name = searchParams.q;
                searchParams.q = "";
            }
        } else if (
            searchMode === "specific" &&
            wasAutoSwitched &&
            !searchParams.artist_name &&
            !searchParams.album_name &&
            !searchParams.duration
        ) {
            // Auto-switch back to general if all specific criteria are cleared (but only if it was auto-switched)
            searchMode = "general";
            wasAutoSwitched = false;
            // When auto-switching back to general, move track_name to q if q is empty
            if (!searchParams.q && searchParams.track_name) {
                searchParams.q = searchParams.track_name;
                searchParams.track_name = "";
            }
        }
    });

    // Load search parameters from URL on mount
    onMount(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const qParam = urlParams.get("q");
        const trackParam = urlParams.get("track");
        const artistParam = urlParams.get("artist");
        const albumParam = urlParams.get("album");
        const durationParam = urlParams.get("duration");

        if (qParam) {
            searchParams.q = decodeURIComponent(qParam);
            searchMode = "general";
        }
        if (trackParam) {
            searchParams.track_name = decodeURIComponent(trackParam);
            searchMode = "specific";
        }
        if (artistParam) searchParams.artist_name = decodeURIComponent(artistParam);
        if (albumParam) searchParams.album_name = decodeURIComponent(albumParam);
        if (durationParam) searchParams.duration = parseInt(decodeURIComponent(durationParam));

        // Auto-search if parameters are present
        if (qParam || trackParam) {
            performSearch();
        }
    });
</script>

<svelte:head>
    <title>Search Lyrics - LRCLIBpub</title>
    <meta name="description" content="Search for lyrics in the LRCLIB database" />
</svelte:head>

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
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                    />
                </svg>
                Search Lyrics
            </h1>
            <a
                href="/"
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
                    <path stroke-linecap="round" stroke-linejoin="round" d="m9 9 6-6m0 0 6 6m-6-6v12a6 6 0 0 1-12 0v-3" />
                </svg>
                Publish Lyrics
            </a>
        </header>

        <!-- Introduction -->
        <div class="text-indigo-800 mb-6">
            <p>
                Search the <a href="https://lrclib.net" target="_blank" rel="noopener noreferrer" class="underline">LRCLIB</a>
                lyrics database to find synchronized and plain lyrics for your favorite songs.
            </p>
        </div>

        <!-- Search Form -->
        <form onsubmit={handleSubmit} class="bg-white p-6 rounded-lg shadow-sm border border-indigo-200 mb-8">
            <!-- Search Mode Toggle -->
            <div class="mb-6">
                <div class="flex items-center gap-4 mb-4">
                    <span class="text-sm font-medium text-indigo-900">Search Mode:</span>
                    <div class="flex gap-2">
                        <button
                            type="button"
                            onclick={() => {
                                searchMode = "general";
                                wasAutoSwitched = false;
                                // When switching to general, move track_name to q if q is empty
                                if (!searchParams.q && searchParams.track_name) {
                                    searchParams.q = searchParams.track_name;
                                }
                                searchParams.track_name = "";
                            }}
                            class="px-3 py-1 text-sm rounded-md transition-colors {searchMode === 'general'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}"
                        >
                            General Search
                        </button>
                        <button
                            type="button"
                            onclick={() => {
                                searchMode = "specific";
                                wasAutoSwitched = false;
                                // When switching to specific, move q to track_name if track_name is empty
                                if (!searchParams.track_name && searchParams.q) {
                                    searchParams.track_name = searchParams.q;
                                }
                                searchParams.q = "";
                            }}
                            class="px-3 py-1 text-sm rounded-md transition-colors {searchMode === 'specific'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}"
                        >
                            Specific Track
                        </button>
                    </div>
                </div>
                {#if wasAutoSwitched}
                    <div class="text-xs text-indigo-600 bg-indigo-50 px-3 py-2 rounded-md border border-indigo-200">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                            class="size-4 inline mr-1"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                            />
                        </svg>
                        Automatically switched to Specific Track mode because you added detailed search criteria.
                    </div>
                {/if}
            </div>

            <div class="space-y-4">
                {#if searchMode === "general"}
                    <!-- General Search -->
                    <div>
                        <label for="searchTerm" class="block text-sm font-medium mb-1">Search Term *</label>
                        <input
                            type="text"
                            id="searchTerm"
                            bind:value={searchParams.q}
                            required
                            placeholder="Search for lyrics, artist, or track name"
                            class="w-full px-3 py-2 border border-indigo-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                {:else}
                    <!-- Specific Track Search -->
                    <div>
                        <label for="trackName" class="block text-sm font-medium mb-1">Track Name *</label>
                        <input
                            type="text"
                            id="trackName"
                            bind:value={searchParams.track_name}
                            required
                            placeholder="Enter exact track name"
                            class="w-full px-3 py-2 border border-indigo-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                {/if}

                <!-- Optional Fields -->
                <div class="grid md:grid-cols-2 gap-4">
                    <div>
                        <label for="artistName" class="block text-sm font-medium mb-1">Artist Name</label>
                        <input
                            type="text"
                            id="artistName"
                            bind:value={searchParams.artist_name}
                            placeholder="Enter artist name (optional)"
                            class="w-full px-3 py-2 border border-indigo-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label for="albumName" class="block text-sm font-medium mb-1">Album Name</label>
                        <input
                            type="text"
                            id="albumName"
                            bind:value={searchParams.album_name}
                            placeholder="Enter album name (optional)"
                            class="w-full px-3 py-2 border border-indigo-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                <div>
                    <label for="duration" class="block text-sm font-medium mb-1">Duration (seconds)</label>
                    <input
                        type="number"
                        id="duration"
                        bind:value={searchParams.duration}
                        min="0"
                        placeholder="Song duration in seconds (optional)"
                        class="w-full px-3 py-2 border border-indigo-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
            </div>

            <!-- Form Actions -->
            <div class="flex gap-3 mt-6">
                <button
                    type="submit"
                    disabled={isSearching}
                    class="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                    {#if isSearching}
                        <svg class="animate-spin size-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path
                                class="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                        </svg>
                        Searching...
                    {:else}
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
                        Search
                    {/if}
                </button>
                <button
                    type="button"
                    onclick={resetForm}
                    class="px-4 py-2 border border-indigo-300 text-indigo-700 rounded-md hover:bg-indigo-50 transition-colors"
                >
                    Reset
                </button>
            </div>
        </form>

        <!-- Search Results -->
        {#if hasSearched}
            <div class="bg-white rounded-lg shadow-sm border border-indigo-200">
                <div class="p-6 border-b border-indigo-200">
                    <h2 class="text-xl font-semibold text-indigo-900">
                        Search Results
                        {#if results.length > 0}
                            <span class="text-sm font-normal text-indigo-600">({results.length} found)</span>
                        {/if}
                    </h2>
                </div>

                {#if results.length === 0}
                    <div class="p-8 text-center text-indigo-600">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                            class="size-12 mx-auto mb-4 text-indigo-400"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                            />
                        </svg>
                        <p class="text-lg mb-2">No lyrics found</p>
                        <p class="text-sm">Try adjusting your search terms or using different keywords.</p>
                    </div>
                {:else}
                    <div class="divide-y divide-indigo-100">
                        {#each results as result}
                            <div class="p-6 hover:bg-indigo-50/50 transition-colors">
                                <!-- Track Info -->
                                <div class="flex justify-between items-start mb-3">
                                    <div class="flex-1">
                                        <h3 class="font-semibold text-lg text-indigo-900 mb-1">{result.trackName}</h3>
                                        <p class="text-indigo-700">
                                            <span class="font-medium">by {result.artistName}</span>
                                            {#if result.albumName}
                                                <span class="text-indigo-500"> • {result.albumName}</span>
                                            {/if}
                                        </p>
                                        <div class="flex items-center gap-4 mt-2 text-sm text-indigo-600">
                                            <span>Duration: {formatDuration(result.duration)}</span>
                                            {#if result.instrumental}
                                                <span class="px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-xs"
                                                    >Instrumental</span
                                                >
                                            {/if}
                                        </div>
                                    </div>
                                    {#if !result.instrumental && (result.plainLyrics || result.syncedLyrics)}
                                        <button
                                            onclick={() => viewLyrics(result)}
                                            class="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition-colors"
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
                                                    d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                                                />
                                                <path
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                                                />
                                            </svg>
                                            View Full
                                        </button>
                                    {/if}
                                </div>

                                <!-- Lyrics Preview -->
                                {#if !result.instrumental}
                                    <div class="space-y-3">
                                        {#if result.syncedLyrics}
                                            <div>
                                                <h4 class="text-sm font-medium text-indigo-800 mb-2 flex items-center gap-1">
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
                                                            d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                                                        />
                                                    </svg>
                                                    Synced Lyrics (LRC Format)
                                                </h4>
                                                <pre
                                                    class="text-sm bg-indigo-50 p-3 rounded-md border border-indigo-200 overflow-x-auto">{truncateText(
                                                        result.syncedLyrics,
                                                        200
                                                    )}</pre>
                                            </div>
                                        {/if}
                                        {#if result.plainLyrics}
                                            <div>
                                                <h4 class="text-sm font-medium text-indigo-800 mb-2 flex items-center gap-1">
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
                                                            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0-1.125.504-1.125 1.125V11.25a9 9 0 0 0-9-9Z"
                                                        />
                                                    </svg>
                                                    Plain Lyrics
                                                </h4>
                                                <div class="text-sm bg-gray-50 p-3 rounded-md border border-gray-200">
                                                    {truncateText(result.plainLyrics, 200)}
                                                </div>
                                            </div>
                                        {/if}
                                    </div>
                                {:else}
                                    <div class="text-center py-4 text-indigo-600">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke-width="1.5"
                                            stroke="currentColor"
                                            class="size-8 mx-auto mb-2 text-indigo-400"
                                        >
                                            <path
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                                d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z"
                                            />
                                        </svg>
                                        <p class="text-sm">This track is marked as instrumental</p>
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>

                    <!-- Pagination -->
                    {#if results.length === 10}
                        <div class="p-6 border-t border-indigo-200">
                            <div class="flex justify-between items-center">
                                <button
                                    onclick={() => changePage(currentPage - 1)}
                                    disabled={currentPage <= 1 || isSearching}
                                    class="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke-width="1.5"
                                        stroke="currentColor"
                                        class="size-4"
                                    >
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                                    </svg>
                                    Previous
                                </button>

                                <span class="text-indigo-700 font-medium">Page {currentPage}</span>

                                <button
                                    onclick={() => changePage(currentPage + 1)}
                                    disabled={isSearching}
                                    class="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors"
                                >
                                    Next
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke-width="1.5"
                                        stroke="currentColor"
                                        class="size-4"
                                    >
                                        <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    {/if}
                {/if}
            </div>
        {/if}

        <!-- Notifications -->
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
                    {success}
                </div>
            {/if}
        </div>

        <Footer />
    </div>
</div>

<!-- Lyrics Viewer Modal -->
{#if viewingLyrics}
    <div class="fixed inset-0 bg-black/50 bg-opacity-75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div
            class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-indigo-200"
        >
            <!-- Modal Header -->
            <div class="flex items-center justify-between p-6 border-b border-indigo-200 bg-indigo-50">
                <div>
                    <h2 class="text-xl font-bold text-indigo-900">{viewingLyrics.trackName}</h2>
                    <p class="text-indigo-700">by {viewingLyrics.artistName}</p>
                </div>
                <button
                    onclick={closeLyricsViewer}
                    aria-label="Close lyrics viewer"
                    class="p-2 hover:bg-indigo-100 rounded-lg transition-colors text-indigo-700"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="size-6"
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- Tabs -->
            {#if viewingLyrics.syncedLyrics && viewingLyrics.plainLyrics}
                <div class="flex border-b border-indigo-200 bg-white">
                    <button
                        onclick={() => (activeTab = "synced")}
                        class="flex-1 px-6 py-3 text-sm font-medium transition-colors border-b-2 {activeTab === 'synced'
                            ? 'text-indigo-600 border-indigo-600 bg-indigo-50'
                            : 'text-indigo-700 border-transparent hover:text-indigo-600 hover:bg-indigo-50'}"
                    >
                        <div class="flex items-center justify-center gap-2">
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
                                    d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                                />
                            </svg>
                            Synced Lyrics
                        </div>
                    </button>
                    <button
                        onclick={() => (activeTab = "plain")}
                        class="flex-1 px-6 py-3 text-sm font-medium transition-colors border-b-2 {activeTab === 'plain'
                            ? 'text-indigo-600 border-indigo-600 bg-indigo-50'
                            : 'text-indigo-700 border-transparent hover:text-indigo-600 hover:bg-indigo-50'}"
                    >
                        <div class="flex items-center justify-center gap-2">
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
                                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0-1.125.504-1.125 1.125V11.25a9 9 0 0 0-9-9Z"
                                />
                            </svg>
                            Plain Lyrics
                        </div>
                    </button>
                </div>
            {/if}

            <!-- Modal Content -->
            <div class="p-6 overflow-y-auto flex-1">
                {#if activeTab === "synced" && viewingLyrics.syncedLyrics}
                    <div>
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-lg font-semibold text-indigo-900 flex items-center gap-2">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke-width="1.5"
                                    stroke="currentColor"
                                    class="size-5"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                                    />
                                </svg>
                                Synced Lyrics
                            </h3>
                            <button
                                onclick={() =>
                                    copyToClipboard(viewingLyrics!.syncedLyrics!, "Synced lyrics", `synced-${viewingLyrics!.id}`)}
                                class="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition-colors"
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
                                        d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
                                    />
                                </svg>
                                {copiedStates[`synced-${viewingLyrics!.id}`] ? "Copied" : "Copy"}
                            </button>
                        </div>
                        <pre
                            class="bg-indigo-50 p-4 rounded-lg border border-indigo-200 text-sm overflow-x-auto whitespace-pre-wrap text-indigo-900">{viewingLyrics.syncedLyrics}</pre>
                    </div>
                {:else if activeTab === "plain" && viewingLyrics.plainLyrics}
                    <div>
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-lg font-semibold text-indigo-900 flex items-center gap-2">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke-width="1.5"
                                    stroke="currentColor"
                                    class="size-5"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0-1.125.504-1.125 1.125V11.25a9 9 0 0 0-9-9Z"
                                    />
                                </svg>
                                Plain Lyrics
                            </h3>
                            <button
                                onclick={() =>
                                    copyToClipboard(viewingLyrics!.plainLyrics!, "Plain lyrics", `plain-${viewingLyrics!.id}`)}
                                class="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition-colors"
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
                                        d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
                                    />
                                </svg>
                                {copiedStates[`plain-${viewingLyrics!.id}`] ? "Copied" : "Copy"}
                            </button>
                        </div>
                        <div class="bg-indigo-50 p-4 rounded-lg border border-indigo-200 text-sm whitespace-pre-wrap text-indigo-900">
                            {viewingLyrics.plainLyrics}
                        </div>
                    </div>
                {:else if viewingLyrics.syncedLyrics && !viewingLyrics.plainLyrics}
                    <!-- Only synced lyrics available -->
                    <div>
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-lg font-semibold text-indigo-900 flex items-center gap-2">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke-width="1.5"
                                    stroke="currentColor"
                                    class="size-5"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                                    />
                                </svg>
                                Synced Lyrics (LRC Format)
                            </h3>
                            <button
                                onclick={() =>
                                    copyToClipboard(viewingLyrics!.syncedLyrics!, "Synced lyrics", `synced-${viewingLyrics!.id}`)}
                                class="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition-colors"
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
                                        d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
                                    />
                                </svg>
                                {copiedStates[`synced-${viewingLyrics!.id}`] ? "Copied" : "Copy"}
                            </button>
                        </div>
                        <pre
                            class="bg-indigo-50 p-4 rounded-lg border border-indigo-200 text-sm overflow-x-auto whitespace-pre-wrap text-indigo-900">{viewingLyrics.syncedLyrics}</pre>
                    </div>
                {:else if viewingLyrics.plainLyrics && !viewingLyrics.syncedLyrics}
                    <!-- Only plain lyrics available -->
                    <div>
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-lg font-semibold text-indigo-900 flex items-center gap-2">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke-width="1.5"
                                    stroke="currentColor"
                                    class="size-5"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0-1.125.504-1.125 1.125V11.25a9 9 0 0 0-9-9Z"
                                    />
                                </svg>
                                Plain Lyrics
                            </h3>
                            <button
                                onclick={() =>
                                    copyToClipboard(viewingLyrics!.plainLyrics!, "Plain lyrics", `plain-${viewingLyrics!.id}`)}
                                class="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition-colors"
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
                                        d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
                                    />
                                </svg>
                                {copiedStates[`plain-${viewingLyrics!.id}`] ? "Copied" : "Copy"}
                            </button>
                        </div>
                        <div class="bg-indigo-50 p-4 rounded-lg border border-indigo-200 text-sm whitespace-pre-wrap text-indigo-900">
                            {viewingLyrics.plainLyrics}
                        </div>
                    </div>
                {:else}
                    <!-- No lyrics available -->
                    <div class="text-center py-8 text-indigo-600">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                            class="size-12 mx-auto mb-4 text-indigo-400"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0-1.125.504-1.125 1.125V11.25a9 9 0 0 0-9-9Z"
                            />
                        </svg>
                        <p class="text-lg mb-2">No lyrics available</p>
                        <p class="text-sm">This track doesn't have any lyrics in the database.</p>
                    </div>
                {/if}
            </div>

            <!-- Modal Footer -->
            <div class="flex justify-end p-6 border-t border-indigo-200 bg-indigo-50 flex-shrink-0"></div>
        </div>
    </div>
{/if}
