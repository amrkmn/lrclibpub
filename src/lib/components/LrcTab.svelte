<script lang="ts">
    import ValidationWarning from "$lib/components/ValidationWarning.svelte";
    import { normalizeAndSortLRC, stripELRCWordTimestamps } from "$lib/lrc/normalizer";
    import { parseLRCFile } from "$lib/lrc/parser";
    import { validateSyncedLyrics, type LRCValidationResult } from "$lib/lrc/validator";

    let {
        plainLyrics = $bindable(""),
        syncedLyrics = $bindable(""),
        trackName = $bindable(""),
        artistName = $bindable(""),
        albumName = $bindable(""),
        duration = $bindable(""),
    }: {
        plainLyrics: string;
        syncedLyrics: string;
        trackName: string;
        artistName: string;
        albumName: string;
        duration: string;
    } = $props();

    let validationResult = $state<LRCValidationResult | null>(null);
    let showValidationWarning = $state(false);
    let validationDismissed = $state(false);

    function runValidation() {
        if (!syncedLyrics.trim()) {
            validationResult = null;
            showValidationWarning = false;
            validationDismissed = false;
            return;
        }
        validationResult = validateSyncedLyrics(syncedLyrics);
        showValidationWarning = !validationResult.isValid && !validationDismissed;
    }

    function handleNormalize() {
        if (!validationResult) return;
        const result = normalizeAndSortLRC(syncedLyrics);
        syncedLyrics = result.normalized;
        runValidation();
    }

    function handleStripELRC() {
        if (!validationResult) return;
        const result = stripELRCWordTimestamps(syncedLyrics);
        syncedLyrics = result.stripped;
        runValidation();
    }

    function dismissValidation() {
        validationDismissed = true;
        showValidationWarning = false;
    }

    async function onFileChange(e: Event) {
        // SAFETY: onFileChange bound to <input type=file>, target is HTMLInputElement
        const file = (e.target as HTMLInputElement)?.files?.[0];
        if (!file) return;
        const content = await file.text();
        const parsed = parseLRCFile(content);
        if (parsed.title) trackName = parsed.title;
        if (parsed.artist) artistName = parsed.artist;
        if (parsed.album) albumName = parsed.album;
        if (parsed.duration) duration = parsed.duration;
        plainLyrics = parsed.plainLyrics;
        syncedLyrics = parsed.syncedLyrics;
        validationDismissed = false;
        runValidation();
    }
</script>

<div class="space-y-4">
    <div class="flex items-center gap-4 flex-wrap">
        <h3 class="text-lg font-semibold">LRC Input</h3>
        <label
            for="lrcFile"
            class="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-200/75 hover:bg-indigo-200 text-indigo-700 rounded-md cursor-pointer transition-colors"
        >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload .lrc file
        </label>
        <input type="file" id="lrcFile" accept=".lrc" class="hidden" onchange={onFileChange} />
    </div>

    <div>
        <label for="plainLyrics" class="block text-sm font-medium mb-1">Plain Lyrics</label>
        <textarea
            id="plainLyrics"
            bind:value={plainLyrics}
            rows="6"
            placeholder="Enter plain lyrics text here"
            class="w-full px-3 py-2 border border-indigo-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
        ></textarea>
        <p class="mt-1 text-sm text-indigo-600">Leave both lyrics fields empty for instrumental tracks</p>
    </div>

    <div>
        <label for="syncedLyrics" class="block text-sm font-medium mb-1">Synced Lyrics</label>
        <textarea
            id="syncedLyrics"
            bind:value={syncedLyrics}
            oninput={() => {
                validationDismissed = false;
                runValidation();
            }}
            rows="6"
            class="w-full px-3 py-2 border border-indigo-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            placeholder="[mm:ss.xx] Lyrics line"
        ></textarea>
    </div>

    {#if showValidationWarning && validationResult}
        <ValidationWarning
            {validationResult}
            onNormalize={handleNormalize}
            onStripELRC={handleStripELRC}
            onDismiss={dismissValidation}
        />
    {/if}
</div>
